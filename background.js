// background.js — Grandma's Guardian service worker (ES module).
import {
  BUILTIN_DENY, DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTIONS, LOG_CAPS, MANUAL_KEYS,
  PROTECTION_KEYS, REFRESH_MINUTES, checkParsedList, chunk, effectiveSettings, hostMatches,
  OCTET, downloadAllowed, looksLikeHtml, mimeRequestFor, normalizeDomain, normalizeFor, normalizeMime, parseList, randomToken
} from "./lib.js";

const BLOCKPAGE = chrome.runtime.getURL("blockpage.html");
const DOWNLOAD_PAGE = chrome.runtime.getURL("downloadblocked.html");
const UI_PAGE = chrome.runtime.getURL("popup.html");
const ICON = chrome.runtime.getURL("Guardian128.png");
const VERSION = chrome.runtime.getManifest().version;
const ALARM = "gg-refresh-lists";
const FLUSH_ALARM = "gg-flush-logs";
const MATCH_ALL = "^(https?://.*)$";
const DOMAINS_PER_RULE = 2000;

// Storage keys whose change means the blocking rules / effective lists must be rebuilt.
const REBUILD_KEYS = new Set([
  ...Object.values(MANUAL_KEYS),
  "subscriptions", "domainFilteringEnabled", "denyFilteringEnabled"
]);

const PROTECTION_LABELS = {
  domainFilteringEnabled: "Website allowlisting",
  denyFilteringEnabled: "Always-block list",
  mimeFilteringEnabled: "Download file-type filter",
  filteringEnabled: "Scam word filter"
};

// ---------------------------------------------------------------------------
// Serialised read-modify-write. Every write to a shared array (logs, requests,
// subscriptions, manual lists) goes through here so two events at the same
// moment cannot overwrite each other's changes.
// ---------------------------------------------------------------------------
let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function updateKey(key, mutate, fallback = []) {
  return serialized(async () => {
    const { [key]: current = fallback } = await chrome.storage.local.get(key);
    const next = await mutate(structuredClone(current));
    if (next !== undefined) await chrome.storage.local.set({ [key]: next });
    return next;
  });
}

function appendCapped(key, entry, cap, isDuplicate) {
  return updateKey(key, list => {
    if (isDuplicate && isDuplicate(list)) return undefined;
    list.push(entry);
    if (list.length > cap) list.splice(0, list.length - cap);
    return list;
  });
}

// ---------------------------------------------------------------------------
// Managed (policy) configuration — chrome.storage.managed, see managed_schema.json
// ---------------------------------------------------------------------------
let managed = {};
async function loadManaged() {
  try {
    managed = (await chrome.storage.managed.get(null)) || {};
  } catch {
    managed = {};
  }
  return managed;
}
let managedReady = loadManaged();

async function getSettings() {
  await managedReady;
  return effectiveSettings(await chrome.storage.local.get(null), managed);
}

// Policy-provided lists become locked subscriptions with stable ids.
function managedSubId(kind, url) {
  let h = 0;
  for (const c of `${kind}|${url}`) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `managed-${(h >>> 0).toString(36)}`;
}

async function applyManagedSubscriptions() {
  await managedReady;
  const wanted = (Array.isArray(managed.subscriptions) ? managed.subscriptions : [])
    .filter(s => s && MANUAL_KEYS[s.kind] && validListUrl(s.url))
    .map(s => ({ id: managedSubId(s.kind, s.url), kind: s.kind, url: validListUrl(s.url), name: s.name || "Organization list", enabled: true, managed: true }));
  const added = [];
  await updateKey("subscriptions", subs => {
    const keep = subs.filter(s => !s.managed || wanted.some(w => w.id === s.id));
    for (const w of wanted) {
      const cur = keep.find(s => s.id === w.id);
      if (cur) Object.assign(cur, { name: w.name, enabled: true, managed: true });
      else { keep.push(w); added.push(w.id); }
    }
    return keep;
  });
  for (const id of added) await syncSubscription(id);
}

async function enforceForcedProtections() {
  await managedReady;
  if (!managed.forceProtectionsOn) return;
  const cur = await chrome.storage.local.get(PROTECTION_KEYS);
  const fix = {};
  for (const k of PROTECTION_KEYS) if (cur[k] === false) fix[k] = true;
  if (Object.keys(fix).length) await chrome.storage.local.set(fix);
}

// ---------------------------------------------------------------------------
// Effective lists = manual entries + enabled subscriptions (+ built-in blocks)
// ---------------------------------------------------------------------------
let cache = null; // { settings, sets }

function computeEffective(all) {
  const settings = effectiveSettings(all, managed);
  const sets = { allow: new Set(), deny: new Set(), mime: new Set(), scam: new Set() };
  for (const [kind, key] of Object.entries(MANUAL_KEYS)) {
    for (const v of all[key] || []) {
      const n = normalizeFor(kind, v);
      if (n) sets[kind].add(n);
    }
  }
  for (const sub of all.subscriptions || []) {
    if (sub.enabled === false || !sets[sub.kind]) continue;
    for (const v of all[`sub:${sub.id}`] || []) sets[sub.kind].add(v);
  }
  return { settings, sets };
}

function denyListFor({ settings, sets }) {
  // Built-in remote-control sites: blocked unless the exact host is allowlisted
  // (same rule as v1). They stay blocked while website allowlisting is on, even
  // if the always-block list is switched off.
  const builtin = BUILTIN_DENY.filter(d => !sets.allow.has(d));
  if (settings.denyFilteringEnabled) return [...new Set([...sets.deny, ...builtin])];
  if (settings.domainFilteringEnabled) return builtin;
  return [];
}

async function getEffective() {
  await managedReady;
  if (!cache) cache = computeEffective(await chrome.storage.local.get(null));
  return cache;
}

// ---------------------------------------------------------------------------
// declarativeNetRequest rules
// ---------------------------------------------------------------------------
function redirectTo(reason) {
  return {
    type: "redirect",
    // The original URL goes in the #fragment so '&' and '#' in it survive intact.
    redirect: { regexSubstitution: `${BLOCKPAGE}?r=${reason}#\\1` }
  };
}

function buildRules(eff) {
  const rules = [];
  let id = 1;
  const deny = denyListFor(eff).sort();
  const regexBudget = (chrome.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES || 1000) - 1;
  let truncated = false;

  // 1) Always-block list. Priority 200 beats every allow rule.
  let denyChunks = chunk(deny, DOMAINS_PER_RULE);
  if (denyChunks.length > regexBudget) {
    denyChunks = denyChunks.slice(0, regexBudget);
    truncated = true;
  }
  for (const part of denyChunks) {
    rules.push({
      id: id++, priority: 200, action: redirectTo("deny"),
      condition: { requestDomains: part, regexFilter: MATCH_ALL, resourceTypes: ["main_frame"] }
    });
    rules.push({
      id: id++, priority: 200, action: { type: "block" },
      condition: { requestDomains: part, resourceTypes: ["sub_frame"] }
    });
  }

  // 2) Allowlist. requestDomains matches the real host name and its subdomains only,
  //    never text elsewhere in the URL (fixes the ?r=https://google.com/ bypass).
  if (eff.settings.domainFilteringEnabled) {
    for (const part of chunk([...eff.sets.allow].sort(), DOMAINS_PER_RULE)) {
      rules.push({
        id: id++, priority: 100, action: { type: "allow" },
        condition: { requestDomains: part, resourceTypes: ["main_frame"] }
      });
    }
    // 3) Everything else goes to the block page.
    rules.push({
      id: id++, priority: 50, action: redirectTo("allow"),
      condition: { regexFilter: MATCH_ALL, resourceTypes: ["main_frame"] }
    });
  }
  return { rules, truncated };
}

async function applyRules(eff) {
  const { rules, truncated } = buildRules(eff);
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: old.map(r => r.id),
      addRules: rules
    });
    await chrome.storage.local.set({
      rulesStatus: {
        ok: true,
        at: Date.now(),
        ruleCount: rules.length,
        warning: truncated ? "The always-block list is too large; part of it was not applied." : null
      }
    });
  } catch (e) {
    // updateDynamicRules is all-or-nothing: the previous rules stay in force.
    console.error("Grandma's Guardian: rule update failed", e);
    await chrome.storage.local.set({
      rulesStatus: { ok: false, at: Date.now(), error: String(e?.message || e) }
    });
  }
}

function sameArray(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let rebuildChain = Promise.resolve();
function rebuild() {
  rebuildChain = rebuildChain.then(async () => {
    await managedReady;
    const all = await chrome.storage.local.get(null);
    cache = computeEffective(all);
    await applyRules(cache);

    // Publish the lists content scripts and the download filter read.
    const scam = [...cache.sets.scam].sort();
    const mime = [...cache.sets.mime].sort();
    const counts = {
      allow: cache.sets.allow.size, deny: denyListFor(cache).length,
      mime: mime.length, scam: scam.length
    };
    const patch = {};
    if (!sameArray(all.effectiveScamTerms, scam)) patch.effectiveScamTerms = scam;
    if (!sameArray(all.effectiveMimeTypes, mime)) patch.effectiveMimeTypes = mime;
    if (JSON.stringify(all.effectiveCounts) !== JSON.stringify(counts)) patch.effectiveCounts = counts;
    const managedInfo = { forced: !!managed.forceProtectionsOn, keys: Object.keys(managed) };
    if (JSON.stringify(all.managedInfo) !== JSON.stringify(managedInfo)) patch.managedInfo = managedInfo;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  }).catch(e => console.error("Grandma's Guardian: rebuild failed", e));
  return rebuildChain;
}

let rebuildTimer = null;
function scheduleRebuild() {
  cache = null;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 150);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "managed") {
    managedReady = loadManaged();
    managedReady.then(async () => {
      await applyManagedSubscriptions();
      await enforceForcedProtections();
      scheduleRebuild();
    });
    return;
  }
  if (area !== "local") return;
  if (Object.keys(changes).some(k => REBUILD_KEYS.has(k) || k.startsWith("sub:"))) scheduleRebuild();

  // Audit: protections switched on/off.
  for (const k of PROTECTION_KEYS) {
    const c = changes[k];
    if (!c || c.oldValue === undefined || c.oldValue === c.newValue) continue;
    if (managed.forceProtectionsOn && c.newValue === false) {
      chrome.storage.local.set({ [k]: true });
      recordEvent({ type: "protection_change_blocked", setting: k, label: PROTECTION_LABELS[k] });
      continue;
    }
    recordEvent({ type: c.newValue ? "protection_on" : "protection_off", setting: k, label: PROTECTION_LABELS[k] });
  }
});

// ---------------------------------------------------------------------------
// Events: one pipeline for local logs and log forwarding
// ---------------------------------------------------------------------------
const AUDIT_TYPES = new Set([
  "protection_on", "protection_off", "protection_change_blocked", "list_changed",
  "subscription_changed", "request_approved", "request_dismissed", "site_requested",
  "mime_requested", "mime_request_approved", "mime_request_dismissed"
]);

async function recordEvent(evt) {
  const event = { id: randomToken(8), time: new Date().toISOString(), ...evt };
  try {
    if (AUDIT_TYPES.has(event.type)) {
      await appendCapped("auditLog", event, LOG_CAPS.auditLog);
    }
    await enqueueForward(event);
  } catch (e) {
    console.error("Grandma's Guardian: event failed", e);
  }
  return event;
}

// ---------- requests to allow a site ----------
async function approveRequest(domain, by) {
  const res = await addManual("allow", [domain], by);
  await updateKey("pendingRequests", list => list.filter(r => r.domain !== domain));
  await recordEvent({ type: "request_approved", domain, by, ok: !!res.added, skippedDenied: res.skippedDenied });
  return res;
}

async function dismissRequest(domain, by) {
  await updateKey("pendingRequests", list => list.filter(r => r.domain !== domain));
  await recordEvent({ type: "request_dismissed", domain, by });
  return { ok: true };
}

// ---------- requests to allow a file type ----------
// A request holds one or several types (e.g. all the types used for ".exe").
// Requests saved by 2.3 had a single `mime`; both shapes are read.
const requestTypes = r => (Array.isArray(r.mimes) && r.mimes.length ? r.mimes : [r.mime]).filter(Boolean);
const requestKey = types => [...new Set(types)].sort().join(" ");

async function approveMimeRequest(types, by) {
  const key = requestKey(types);
  const res = await addManual("mime", types, by);
  await updateKey("pendingMimeRequests", list => list.filter(r => requestKey(requestTypes(r)) !== key));
  await recordEvent({ type: "mime_request_approved", mimes: types, by, ok: !!res.added });
  return res;
}

async function dismissMimeRequest(types, by) {
  const key = requestKey(types);
  await updateKey("pendingMimeRequests", list => list.filter(r => requestKey(requestTypes(r)) !== key));
  await recordEvent({ type: "mime_request_dismissed", mimes: types, by });
  return { ok: true };
}

function typesFromMessage(msg) {
  const raw = Array.isArray(msg.mimes) ? msg.mimes : [msg.mime];
  return [...new Set(raw.map(t => normalizeMime(t || "")).filter(Boolean))].slice(0, 20);
}

// ---------- log forwarding (SIEM / collector / automation) ----------
async function enqueueForward(evt) {
  const s = await getSettings();
  if (!s.forwardEnabled || !s.forwardUrl) return;
  const { installId } = await chrome.storage.local.get("installId");
  const envelope = {
    ...evt,
    product: "grandmas-guardian",
    version: VERSION,
    person: s.personName || undefined,
    installId
  };
  await appendCapped("forwardQueue", envelope, LOG_CAPS.forwardQueue);
  scheduleFlush();
}

let flushTimer = null;
function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushForward(), 5000);
}

function formatBatch(batch, format) {
  if (format === "ndjson") {
    return { body: batch.map(e => JSON.stringify(e)).join("\n") + "\n", type: "application/x-ndjson" };
  }
  if (format === "splunk") {
    return {
      body: batch.map(e => JSON.stringify({
        time: Date.parse(e.time) / 1000, host: e.person || e.installId, source: "grandmas-guardian",
        sourcetype: "grandmas_guardian:event", event: e
      })).join("\n"),
      type: "application/json"
    };
  }
  return { body: JSON.stringify(batch), type: "application/json" };
}

let flushing = null;
function flushForward() {
  if (flushing) return flushing;
  flushing = (async () => {
    const s = await getSettings();
    if (!s.forwardEnabled || !s.forwardUrl) return { ok: false, error: "Log forwarding is off." };
    const url = validCollectorUrl(s.forwardUrl);
    if (!url) {
      await chrome.storage.local.set({ forwardStatus: { ok: false, at: Date.now(), error: "The collector address must start with https://" } });
      return { ok: false };
    }
    let result = { ok: true, sent: 0 };
    for (let round = 0; round < 10; round++) {
      const { forwardQueue = [] } = await chrome.storage.local.get("forwardQueue");
      if (!forwardQueue.length) break;
      const batch = forwardQueue.slice(0, 200);
      const { body, type } = formatBatch(batch, s.forwardFormat);
      const headers = { "Content-Type": type };
      if (s.forwardAuth) headers.Authorization = s.forwardAuth;
      try {
        const res = await fetch(url, { method: "POST", headers, body, credentials: "omit" });
        if (!res.ok) { result = { ok: false, error: `Collector answered ${res.status}.` }; break; }
      } catch {
        result = { ok: false, error: "Could not reach the collector." };
        break;
      }
      const sent = new Set(batch.map(e => e.id));
      await updateKey("forwardQueue", q => q.filter(e => !sent.has(e.id)));
      result.sent += batch.length;
    }
    const { forwardQueue = [] } = await chrome.storage.local.get("forwardQueue");
    await chrome.storage.local.set({ forwardStatus: { ...result, at: Date.now(), queued: forwardQueue.length } });
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}

function validCollectorUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" ? x.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// List subscriptions (remote or bundled .txt lists, refreshed on a schedule)
// ---------------------------------------------------------------------------
async function fetchList(url, kind) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { cache: "no-cache", credentials: "omit", signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: `The server answered "${res.status}".` };
    const text = await res.text();
    if (text.length > 25_000_000) return { ok: false, error: "The list is too large (over 25 MB)." };
    if (looksLikeHtml(text, res.headers.get("content-type") || "")) {
      return { ok: false, error: "That address returned a web page, not a .txt list." };
    }
    const parsed = parseList(text, kind);
    const problem = checkParsedList(parsed, kind);
    if (problem) return { ok: false, error: problem };
    return { ok: true, entries: parsed.entries, invalid: parsed.invalid };
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "Timed out." : "Could not reach that address." };
  } finally {
    clearTimeout(timer);
  }
}

function patchSubscription(id, patch) {
  return updateKey("subscriptions", subs => {
    const s = subs.find(x => x.id === id);
    if (s) Object.assign(s, patch);
    return subs;
  });
}

async function syncSubscription(id) {
  const { subscriptions = [] } = await chrome.storage.local.get("subscriptions");
  const sub = subscriptions.find(s => s.id === id);
  if (!sub) return { ok: false, error: "Unknown list." };

  const key = `sub:${id}`;
  const remote = await fetchList(sub.url, sub.kind);
  if (remote.ok) {
    await chrome.storage.local.set({ [key]: remote.entries });
    await patchSubscription(id, {
      lastSync: Date.now(), lastError: null, count: remote.entries.length,
      invalid: remote.invalid, source: "remote"
    });
    return { ok: true };
  }

  // Remote failed. Use the bundled copy if we have nothing yet, or if the bundled
  // copy is what we were already using (picks up updates shipped with the extension).
  const { [key]: existing = [] } = await chrome.storage.local.get(key);
  if (sub.fallback && (!existing.length || sub.source === "bundled")) {
    const local = await fetchList(chrome.runtime.getURL(sub.fallback), sub.kind);
    if (local.ok) {
      await chrome.storage.local.set({ [key]: local.entries });
      await patchSubscription(id, {
        lastSync: Date.now(), count: local.entries.length, source: "bundled",
        lastError: `Using the copy built into the extension (online copy: ${remote.error})`
      });
      return { ok: true, warning: remote.error };
    }
  }
  await patchSubscription(id, { lastError: remote.error, lastTry: Date.now() });
  return { ok: false, error: remote.error };
}

let syncing = null;
function syncAll() {
  if (syncing) return syncing;
  syncing = (async () => {
    const { subscriptions = [] } = await chrome.storage.local.get("subscriptions");
    for (const s of subscriptions) {
      if (s.enabled !== false) await syncSubscription(s.id);
    }
  })().finally(() => { syncing = null; });
  return syncing;
}

/** Put back missing default lists (all kinds, or just one) and switch them on. */
async function restoreDefaults(kind) {
  const restored = [];
  await updateKey("subscriptions", subs => {
    for (const d of DEFAULT_SUBSCRIPTIONS) {
      if (kind && d.kind !== kind) continue;
      const cur = subs.find(s => s.id === d.id);
      if (!cur) { subs.push({ ...d, enabled: true }); restored.push(d.id); }
      else if (cur.enabled === false || cur.url !== d.url) {
        Object.assign(cur, { url: d.url, fallback: d.fallback, name: d.name, enabled: true });
        restored.push(d.id);
      }
    }
    return subs;
  });
  for (const id of restored) await syncSubscription(id);
  if (restored.length) await recordEvent({ type: "subscription_changed", change: "restored", ids: restored, kind: kind || "all" });
  return { ok: true, restored: restored.length };
}

async function ensureAlarms() {
  if (!(await chrome.alarms.get(ALARM))) {
    await chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_MINUTES, delayInMinutes: 5 });
  }
  if (!(await chrome.alarms.get(FLUSH_ALARM))) {
    await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 5 });
  }
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) syncAll();
  else if (alarm.name === FLUSH_ALARM) flushForward();
});

function validListUrl(url) {
  try {
    const u = new URL(url);
    return ["https:", "http:", "file:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Install / update / startup
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await chrome.storage.local.get(null);
  const patch = {};
  // Only fill in settings that don't exist yet; never overwrite the caregiver's choices.
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[k] === undefined) patch[k] = v;
  }
  if (!current.installId) patch.installId = randomToken(12);
  if (reason === "install") {
    patch.subscriptions = DEFAULT_SUBSCRIPTIONS.map(s => ({ ...s, enabled: true }));
  } else if (reason === "update" && !Array.isArray(current.subscriptions)) {
    // Upgrade from v1: existing lists are kept as manual entries. Turn on the new
    // always-block list and the scam phrase list; leave website and file-type
    // subscriptions off so entries the caregiver removed don't come back.
    patch.subscriptions = DEFAULT_SUBSCRIPTIONS.map(s => ({
      ...s, enabled: s.kind === "deny" || s.kind === "scam"
    }));
    patch.setupComplete = true;
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);

  await managedReady;
  // A computer configured entirely by policy doesn't need the setup guide.
  if (reason === "install" && !managed.forceProtectionsOn) chrome.tabs.create({ url: `${UI_PAGE}?setup=1` });
  if (reason === "install" && managed.forceProtectionsOn) await chrome.storage.local.set({ setupComplete: true });

  await ensureAlarms();
  await enforceForcedProtections();
  await rebuild();
  await applyManagedSubscriptions();
  await syncAll();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  await enforceForcedProtections();
  await rebuild();
  flushForward();
});

// ---------------------------------------------------------------------------
// Downloads: only allowed file types. onDeterminingFilename holds the download
// until we answer, so it cannot finish before it is cancelled.
// ---------------------------------------------------------------------------
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  handleDownload(item, suggest).catch(e => {
    console.error("Grandma's Guardian: download check failed", e);
    try { suggest(); } catch {}
  });
  return true; // we will call suggest() asynchronously
});

async function handleDownload(item, suggest) {
  // The extension's own log exports (data: files it builds itself) are always allowed.
  // A "Download again" started from the download-stopped page is checked like any other.
  if (item.byExtensionId === chrome.runtime.id && /^data:/i.test(item.url || "")) {
    suggest();
    return;
  }
  const s = await getSettings();
  const { effectiveMimeTypes = [] } = await chrome.storage.local.get("effectiveMimeTypes");

  const mime = normalizeMime(item.mime || "") || "";
  let urlName = "";
  try { urlName = decodeURIComponent((item.finalUrl || item.url || "").split(/[?#]/)[0].split("/").pop() || ""); } catch {}
  const name = (item.filename || "").split(/[\\/]/).pop() || urlName || "file";

  // Real types are checked as sent. Generic types (octet-stream, none, …) are
  // judged by the extension of the name the file will be saved under.
  if (!s.mimeFilteringEnabled || downloadAllowed(mime, name, effectiveMimeTypes)) {
    suggest();
    return;
  }

  try { await chrome.downloads.cancel(item.id); } catch {}
  try { suggest(); } catch {}

  const entry = {
    id: randomToken(8),
    filename: name,
    mimeType: mime || "unknown",
    timestamp: new Date().toISOString(),
    sourceUrl: item.finalUrl || item.url || "unknown",
    // Original address, used by "Download again" (finalUrl can be a short-lived redirect).
    url: item.url || item.finalUrl || "",
    // The page the download was started from, for "Go back".
    referrer: item.referrer || ""
  };
  await appendCapped("blockedDownloads", entry, LOG_CAPS.blockedDownloads);

  // Show the person what happened and how to ask for it, in a tab they can't miss.
  await openDownloadPage(entry.id);

  // Some browsers (notably on Android) have no notification support: never let that
  // stop the rest of the handling.
  try {
    if (chrome.notifications?.create) {
      chrome.notifications.create(`gg-download-${entry.id}`, {
        type: "basic",
        iconUrl: ICON,
        title: "Download stopped",
        message: `"${name}" was stopped because this kind of file is not allowed. Click for details.`,
        priority: 1
      }, () => void chrome.runtime.lastError);
    }
  } catch {}

  await recordEvent({ type: "download_blocked", filename: entry.filename, mimeType: entry.mimeType, sourceUrl: entry.sourceUrl });
}

// One "Download stopped" tab is reused, so a site that starts many downloads
// can't flood the browser with tabs.
async function openDownloadPage(id) {
  const url = `${DOWNLOAD_PAGE}?id=${encodeURIComponent(id)}`;
  let tabId = null;
  try {
    ({ ggDownloadTab: tabId = null } = (await chrome.storage.session?.get("ggDownloadTab")) || {});
  } catch {}
  if (tabId != null) {
    try {
      const tab = await chrome.tabs.update(tabId, { url, active: true });
      if (tab?.windowId != null) chrome.windows?.update(tab.windowId, { focused: true }).catch(() => {});
      return;
    } catch {
      // the tab was closed
    }
  }
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    await chrome.storage.session?.set({ ggDownloadTab: tab.id });
  } catch (e) {
    console.error("Grandma's Guardian: could not open the download page", e);
  }
}

if (chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener(nid => {
    if (!nid.startsWith("gg-download-")) return;
    openDownloadPage(nid.slice("gg-download-".length));
    chrome.notifications.clear(nid);
  });
}

// ---------------------------------------------------------------------------
// Manual list edits (shared by the UI and remote approvals)
// ---------------------------------------------------------------------------
async function addManual(kind, rawValues, by = "settings page") {
  const key = MANUAL_KEYS[kind];
  if (!key) return { ok: false, error: "Unknown list." };
  const values = (Array.isArray(rawValues) ? rawValues : [rawValues])
    .map(v => normalizeFor(kind, v)).filter(Boolean);
  if (!values.length) return { ok: false, error: "That entry isn't valid." };

  let skippedDenied = [];
  let toAdd = values;
  if (kind === "allow") {
    const deny = new Set(denyListFor(await getEffective()));
    skippedDenied = values.filter(v => hostMatches(v, deny));
    toAdd = values.filter(v => !hostMatches(v, deny));
  }
  const addedValues = [];
  if (toAdd.length) {
    await updateKey(key, list => {
      const set = new Set(list);
      for (const v of toAdd) if (!set.has(v)) { set.add(v); addedValues.push(v); }
      return [...set];
    });
  }
  if (addedValues.length) {
    await recordEvent({ type: "list_changed", kind, change: "added", count: addedValues.length, values: addedValues.slice(0, 20), by });
  }
  return { ok: true, added: addedValues.length, skippedDenied };
}

// ---------------------------------------------------------------------------
// Messages from the block page, content scripts and the settings page
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== "string") return;
  const url = sender.url || "";
  const ctx = {
    // Only a top-level block page counts, so other sites can't iframe it to spam the log.
    blockPage: url.startsWith(BLOCKPAGE) && sender.frameId === 0,
    downloadPage: url.startsWith(DOWNLOAD_PAGE) && sender.frameId === 0,
    ui: url.startsWith(UI_PAGE),
    // Our content script running in a web page.
    content: !!sender.tab && /^https?:/i.test(url || sender.tab.url || "") && !url.startsWith("chrome-extension:"),
    pageUrl: /^https?:/i.test(url) ? url : (sender.tab?.url || "")
  };
  handleMessage(msg, ctx)
    .then(sendResponse)
    .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});

function cleanUrl(u) {
  return typeof u === "string" ? u.slice(0, 2048) : "";
}
function cleanText(t, n = 200) {
  return typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, n) : "";
}

async function handleMessage(msg, ctx) {
  // --- from the content script ---
  if (msg.type === "scamHidden" && ctx.content) {
    const url = cleanUrl(ctx.pageUrl);
    const items = (Array.isArray(msg.items) ? msg.items : []).slice(0, 50)
      .map(i => ({ term: cleanText(i.term, 120), excerpt: cleanText(i.excerpt) }))
      .filter(i => i.term);
    if (!items.length) return { ok: false };
    const now = Date.now();
    const fresh = [];
    await updateKey("scamLog", list => {
      for (const i of items) {
        // one entry per page + phrase per minute
        const dup = list.some(e => e.url === url && e.term === i.term && e.action === "hidden" && now - Date.parse(e.timestamp) < 60_000);
        if (dup) continue;
        list.push({ timestamp: new Date(now).toISOString(), url, term: i.term, excerpt: i.excerpt, action: "hidden" });
        fresh.push(i);
      }
      if (list.length > LOG_CAPS.scamLog) list.splice(0, list.length - LOG_CAPS.scamLog);
      return fresh.length ? list : undefined;
    });
    if (fresh.length) {
      await recordEvent({ type: "scam_hidden", url, terms: fresh.map(i => i.term), excerpts: fresh.map(i => i.excerpt) });
    }
    return { ok: true };
  }

  if (msg.type === "scamRevealed" && ctx.content) {
    const url = cleanUrl(ctx.pageUrl);
    const term = cleanText(msg.term, 120);
    const excerpt = cleanText(msg.excerpt);
    await appendCapped("scamLog", { timestamp: new Date().toISOString(), url, term, excerpt, action: "revealed" }, LOG_CAPS.scamLog);
    await recordEvent({ type: "scam_revealed", url, term, excerpt });
    return { ok: true };
  }

  // --- from the block page ---
  if (msg.type === "logBlocked" && ctx.blockPage) {
    const url = cleanUrl(msg.url);
    if (!/^https?:\/\//i.test(url)) return { ok: false };
    const reason = msg.reason === "deny" ? "deny" : "allow";
    const now = Date.now();
    let logged = false;
    await appendCapped("blockedLog", {
      url, reason, timestamp: new Date(now).toISOString()
    }, LOG_CAPS.blockedLog, list => {
      const last = list[list.length - 1];
      const dup = last && last.url === url && now - Date.parse(last.timestamp) < 10_000;
      logged = !dup;
      return dup;
    });
    if (logged) await recordEvent({ type: "site_blocked", url, reason });
    return { ok: true };
  }

  // --- from the download-stopped page ---
  if (msg.type === "requestMime" && ctx.downloadPage) {
    const { blockedDownloads = [] } = await chrome.storage.local.get("blockedDownloads");
    const d = blockedDownloads.find(e => e.id === msg.id);
    if (!d) return { ok: false, error: "That download is no longer in the list." };
    // Decided here, from the stored download, never from what the page sends.
    const plan = mimeRequestFor(d.mimeType, d.filename);
    const { effectiveMimeTypes = [] } = await chrome.storage.local.get("effectiveMimeTypes");
    if (downloadAllowed(d.mimeType, d.filename, effectiveMimeTypes)) {
      return { ok: true, nowAllowed: true, mimes: [] };
    }
    // Only ask for what isn't allowed yet (octet-stream only ever as the last resort).
    const types = plan.mimes.filter(t => !effectiveMimeTypes.includes(t));
    const req = {
      mimes: types, mime: types[0], basis: plan.basis, ext: plan.ext,
      filename: d.filename, sourceUrl: d.sourceUrl, downloadId: d.id, timestamp: new Date().toISOString()
    };
    const key = requestKey(types);
    let isNew = false;
    await appendCapped("pendingMimeRequests", req, LOG_CAPS.pendingMimeRequests, list => {
      const dup = list.some(r => requestKey(requestTypes(r)) === key);
      isNew = !dup;
      return dup;
    });
    if (isNew) {
      await recordEvent({ type: "mime_requested", mimes: types, basis: plan.basis, ext: plan.ext, filename: d.filename, sourceUrl: d.sourceUrl });
    }
    return { ok: true, mimes: types, basis: plan.basis, ext: plan.ext, alreadyRequested: !isNew };
  }

  if (msg.type === "checkMime" && ctx.downloadPage) {
    const { blockedDownloads = [], effectiveMimeTypes = [], pendingMimeRequests = [] } =
      await chrome.storage.local.get(["blockedDownloads", "effectiveMimeTypes", "pendingMimeRequests"]);
    const d = blockedDownloads.find(e => e.id === msg.id);
    if (!d) return { ok: false };
    const s = await getSettings();
    const plan = mimeRequestFor(d.mimeType, d.filename);
    const missing = plan.mimes.filter(t => !effectiveMimeTypes.includes(t));
    return {
      ok: true,
      allowed: !s.mimeFilteringEnabled || downloadAllowed(d.mimeType, d.filename, effectiveMimeTypes),
      pending: pendingMimeRequests.some(r => requestKey(requestTypes(r)) === requestKey(missing)),
      basis: plan.basis, ext: plan.ext, mimes: missing,
      octetAllowed: effectiveMimeTypes.includes(OCTET)
    };
  }

  if (msg.type === "retryDownload" && ctx.downloadPage) {
    const { blockedDownloads = [] } = await chrome.storage.local.get("blockedDownloads");
    const d = blockedDownloads.find(e => e.id === msg.id);
    let url = null;
    try {
      const u = new URL(d?.url || "");
      if (u.protocol === "http:" || u.protocol === "https:") url = u.href;
    } catch {}
    if (!url) return { ok: false, error: "This file can't be downloaded again from here. Go back to the page and click the download again." };
    try {
      // Goes through the normal file-type check (see handleDownload).
      await chrome.downloads.download({ url, filename: d.filename || undefined });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "The download couldn't be started. Go back to the page and click the download again." };
    }
  }

  if (msg.type === "checkSite" && ctx.blockPage) {
    // Lets an open block page notice that its site has since been allowed.
    let host;
    try {
      const u = new URL(cleanUrl(msg.url));
      if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
      host = u.hostname.toLowerCase();
    } catch {
      return { ok: false };
    }
    const eff = await getEffective();
    const denied = hostMatches(host, new Set(denyListFor(eff)));
    const allowed = !denied && (!eff.settings.domainFilteringEnabled || hostMatches(host, eff.sets.allow));
    return { ok: true, allowed, denied };
  }

  if (msg.type === "requestSite" && ctx.blockPage) {
    const url = cleanUrl(msg.url);
    const domain = normalizeDomain(url, { stripWww: true });
    if (!domain) return { ok: false, error: "That address can't be added." };
    const eff = await getEffective();
    if (hostMatches(domain, new Set(denyListFor(eff)))) {
      return { ok: false, error: "This site is on the always-blocked list." };
    }
    const req = { domain, url, timestamp: new Date().toISOString() };
    let isNew = false;
    await appendCapped("pendingRequests", req, LOG_CAPS.pendingRequests, list => {
      const dup = list.some(r => r.domain === domain);
      isNew = !dup;
      return dup;
    });
    if (isNew) await recordEvent({ type: "site_requested", domain, url });
    return { ok: true, domain };
  }

  if (!ctx.ui) return { ok: false, error: "Not allowed." };

  // --- from the settings page / popup ---
  switch (msg.type) {
    case "syncAll":
      await syncAll();
      return { ok: true };

    case "syncOne":
      return syncSubscription(msg.id);

    case "addSubscription": {
      const url = validListUrl(msg.url);
      if (!url || !MANUAL_KEYS[msg.kind]) return { ok: false, error: "Please enter a full web address (https://…)." };
      const id = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      let duplicate = false;
      const name = (msg.name || "").slice(0, 80) || new URL(url).hostname;
      await updateKey("subscriptions", subs => {
        if (subs.some(s => s.kind === msg.kind && s.url === url)) { duplicate = true; return undefined; }
        subs.push({ id, kind: msg.kind, url, enabled: true, name });
        return subs;
      });
      if (duplicate) return { ok: false, error: "That list is already added." };
      await recordEvent({ type: "subscription_changed", change: "added", kind: msg.kind, url, name });
      return syncSubscription(id);
    }

    case "removeSubscription": {
      let removed = null;
      await updateKey("subscriptions", subs => {
        removed = subs.find(s => s.id === msg.id && !s.managed) || null;
        return removed ? subs.filter(s => s !== removed) : undefined;
      });
      if (!removed) return { ok: false, error: "This list is set by your organization and can't be removed." };
      await chrome.storage.local.remove(`sub:${msg.id}`);
      await recordEvent({ type: "subscription_changed", change: "removed", kind: removed.kind, url: removed.url, name: removed.name });
      return { ok: true };
    }

    case "toggleSubscription": {
      const { subscriptions = [] } = await chrome.storage.local.get("subscriptions");
      const sub = subscriptions.find(s => s.id === msg.id);
      if (!sub) return { ok: false };
      if (sub.managed) return { ok: false, error: "This list is set by your organization." };
      await patchSubscription(msg.id, { enabled: !!msg.enabled });
      await recordEvent({ type: "subscription_changed", change: msg.enabled ? "enabled" : "disabled", kind: sub.kind, url: sub.url, name: sub.name });
      if (msg.enabled) await syncSubscription(msg.id);
      return { ok: true };
    }

    case "restoreDefaultSubscriptions":
      return restoreDefaults(MANUAL_KEYS[msg.kind] ? msg.kind : null);

    case "addManual":
      return addManual(msg.kind, msg.values);

    case "removeManual": {
      const key = MANUAL_KEYS[msg.kind];
      if (!key) return { ok: false };
      await updateKey(key, list => list.filter(v => v !== msg.value));
      await recordEvent({ type: "list_changed", kind: msg.kind, change: "removed", count: 1, values: [msg.value], by: "settings page" });
      return { ok: true };
    }

    case "clearManual": {
      const key = MANUAL_KEYS[msg.kind];
      if (!key) return { ok: false };
      const { [key]: before = [] } = await chrome.storage.local.get(key);
      await chrome.storage.local.set({ [key]: [] });
      if (before.length) await recordEvent({ type: "list_changed", kind: msg.kind, change: "cleared", count: before.length, by: "settings page" });
      return { ok: true };
    }

    case "approveRequest":
      return approveRequest(msg.domain, "settings page");

    case "dismissRequest":
      return dismissRequest(msg.domain, "settings page");

    case "approveMimeRequest": {
      const types = typesFromMessage(msg);
      if (!types.length) return { ok: false, error: "Nothing to allow." };
      return approveMimeRequest(types, "settings page");
    }

    case "dismissMimeRequest":
      return dismissMimeRequest(typesFromMessage(msg), "settings page");

    case "clearLog":
      if (!["blockedLog", "blockedDownloads", "scamLog", "auditLog"].includes(msg.key)) return { ok: false };
      await chrome.storage.local.set({ [msg.key]: [] });
      return { ok: true };

    case "testForward": {
      const s = await getSettings();
      if (!s.forwardUrl) return { ok: false, error: "Enter a collector address first." };
      if (!validCollectorUrl(s.forwardUrl)) return { ok: false, error: "The collector address must start with https://" };
      const { installId } = await chrome.storage.local.get("installId");
      const test = { id: randomToken(8), time: new Date().toISOString(), type: "test", product: "grandmas-guardian", version: VERSION, person: s.personName || undefined, installId };
      const { body, type } = formatBatch([test], s.forwardFormat);
      const headers = { "Content-Type": type };
      if (s.forwardAuth) headers.Authorization = s.forwardAuth;
      try {
        const res = await fetch(validCollectorUrl(s.forwardUrl), { method: "POST", headers, body, credentials: "omit" });
        return res.ok ? { ok: true } : { ok: false, error: `Collector answered ${res.status}.` };
      } catch {
        return { ok: false, error: "Could not reach the collector." };
      }
    }

    case "flushForward":
      return flushForward();

    case "rebuild":
      await rebuild();
      return { ok: true };

    default:
      return { ok: false, error: "Unknown request." };
  }
}
