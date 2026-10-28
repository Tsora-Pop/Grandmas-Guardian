// popup.js — popup, full-tab settings page and first-install setup guide.
import {
  DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTIONS, KIND_LABELS, MANAGED_SETTING_KEYS, MANUAL_KEYS, MIME_PRESETS,
  PROTECTION_KEYS, describeRequest, effectiveSettings, parseList
} from "./lib.js";

const $ = id => document.getElementById(id);
const send = (type, data = {}) => chrome.runtime.sendMessage({ type, ...data });

/** Tiny element helper: h("button", {class: "btn", onclick}, "Text") */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

function switchEl(checked, onchange, label) {
  return h("label", { class: "switch", title: label },
    h("input", { type: "checkbox", checked, "aria-label": label, onchange }),
    h("span", { class: "track" }));
}

/** A button that needs a second click within 4 seconds (instead of confirm()). */
function confirmButton(text, confirmText, onConfirm, cls = "btn small danger") {
  let armed = false;
  let timer;
  const btn = h("button", { class: cls, type: "button" }, text);
  btn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      btn.textContent = confirmText;
      timer = setTimeout(() => { armed = false; btn.textContent = text; }, 4000);
      return;
    }
    clearTimeout(timer);
    armed = false;
    btn.textContent = text;
    onConfirm();
  });
  return btn;
}

function ago(ts) {
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  if (!t) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const STATE_KEYS = [
  ...Object.keys(DEFAULT_SETTINGS), ...Object.values(MANUAL_KEYS),
  "subscriptions", "effectiveCounts", "blockedLog", "blockedDownloads",
  "pendingRequests", "pendingMimeRequests", "rulesStatus", "scamLog", "auditLog", "forwardStatus",
  "forwardQueue", "managedInfo"
];
let state = {};
let managed = {};
let settings = { ...DEFAULT_SETTINGS };
const setting = k => settings[k];
const isManaged = k => managed[k] !== undefined || (PROTECTION_KEYS.includes(k) && !!managed.forceProtectionsOn);

async function loadState() {
  state = await chrome.storage.local.get(STATE_KEYS);
  try { managed = (await chrome.storage.managed.get(null)) || {}; } catch { managed = {}; }
  settings = effectiveSettings(state, managed);
}

const tabMode = !!(await chrome.tabs.getCurrent());
document.body.classList.toggle("tab-mode", tabMode);
let incognitoAllowed = true;

// ---------------------------------------------------------------------------
// Header, alerts, toggles
// ---------------------------------------------------------------------------
const PROTECTIONS = [
  { key: "domainFilteringEnabled", short: "Websites", title: "Only allow chosen websites",
    desc: "Every website not on the allowed list is blocked." },
  { key: "denyFilteringEnabled", short: "Always-block list", title: "Always block dangerous sites",
    desc: "Remote-control tools and abused hosting sites stay blocked." },
  { key: "mimeFilteringEnabled", short: "Downloads", title: "Only allow safe file types",
    desc: "Programs and other risky downloads are stopped." },
  { key: "filteringEnabled", short: "Scam words", title: "Hide scam wording",
    desc: "Text with common scam phrases is hidden behind a notice." }
];

function renderHeader() {
  const off = PROTECTIONS.filter(p => !setting(p.key)).map(p => p.short);
  const line = $("statusLine");
  line.className = `status-line ${off.length ? "warn" : "ok"}`;
  line.textContent = off.length ? `⚠ Turned off: ${off.join(", ")}` : "✔ All protections are on";

  const name = setting("helperName");
  const phone = setting("helperPhone");
  const card = $("helperCard");
  card.hidden = !(name || phone);
  card.replaceChildren();
  if (!card.hidden) {
    card.append("Need help? Call ", h("strong", {}, name || "your helper"));
    if (phone) card.append(" at ", h("a", { href: `tel:${phone.replace(/[^\d+]/g, "")}` }, phone));
    card.append(".");
  }
}

function notice(kind, text, ...actions) {
  return h("div", { class: `notice ${kind}` }, h("span", {}, text), ...actions);
}

function renderAlerts() {
  const box = $("alerts");
  box.replaceChildren();

  if (!setting("setupComplete") && !tabMode) {
    box.append(notice("info", "Setup isn't finished yet.",
      h("button", { class: "btn small primary", type: "button", onclick: openSetupTab }, "Open setup")));
  }
  if (!incognitoAllowed) {
    box.append(notice("warn", "Private (Incognito) windows are NOT protected.",
      h("button", { class: "btn small", type: "button", onclick: openExtensionsPage }, "Fix")));
  }
  if (Object.keys(managed).length) {
    box.append(notice("info", "🔒 Some settings are managed by your organization."));
  }
  const rs = state.rulesStatus;
  if (rs && !rs.ok) box.append(notice("bad", `Website rules could not be updated: ${rs.error}`));
  if (rs && rs.ok && rs.warning) box.append(notice("warn", rs.warning));

  const counts = state.effectiveCounts;
  if (setting("domainFilteringEnabled") && counts && counts.allow === 0) {
    box.append(notice("warn", "No websites are allowed yet, so every website is blocked."));
  }
  const failing = (state.subscriptions || []).filter(s => s.enabled !== false && s.lastError && s.source !== "bundled");
  if (failing.length) {
    box.append(notice("warn", `${failing.length} online list${failing.length > 1 ? "s" : ""} could not be updated. The last good copy is still in use.`));
  }
}

function renderToggles() {
  document.querySelectorAll("input[data-setting]").forEach(input => {
    input.checked = !!setting(input.dataset.setting);
    input.disabled = isManaged(input.dataset.setting);
    input.closest(".switch").title = input.disabled ? "Set by your organization" : "";
  });
}

document.querySelectorAll("input[data-setting]").forEach(input => {
  input.addEventListener("change", () => {
    chrome.storage.local.set({ [input.dataset.setting]: input.checked });
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function selectTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  document.querySelectorAll(".panel").forEach(p => { p.hidden = p.dataset.panel !== name; });
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => selectTab(t.dataset.tab)));

// ---------------------------------------------------------------------------
// List editors (manual entries + online lists) — one per .editor[data-kind]
// ---------------------------------------------------------------------------
const PLACEHOLDERS = {
  allow: "Add a website, e.g. mybank.com",
  deny: "Block a website, e.g. anydesk.com",
  mime: "Add a file type, e.g. application/pdf",
  scam: "Add a scam phrase, e.g. buy gift cards"
};
const SHOW_MAX = 300;
const editors = {};

function buildEditor(root) {
  const kind = root.dataset.kind;
  let query = "";

  const count = h("span", { class: "count" });
  const search = h("input", { type: "search", placeholder: "Search…", "aria-label": `Search ${KIND_LABELS[kind]}` });
  const items = h("div", { class: "items", role: "list" });
  const input = h("input", { type: "text", placeholder: PLACEHOLDERS[kind], "aria-label": PLACEHOLDERS[kind] });
  const feedback = h("p", { class: "feedback", role: "status" });
  const fileInput = h("input", { type: "file", accept: ".txt,text/plain", hidden: true });

  function say(text, bad = false) {
    feedback.textContent = text;
    feedback.classList.toggle("bad", bad);
  }

  async function add(values, source = "") {
    const res = await send("addManual", { kind, values });
    if (!res?.ok) return say(res?.error || "Couldn't add that.", true);
    let msg = res.added ? `Added ${res.added}${source}.` : "Already on the list.";
    if (res.skippedDenied?.length) {
      msg += ` Not added (on the always-blocked list): ${res.skippedDenied.slice(0, 5).join(", ")}${res.skippedDenied.length > 5 ? "…" : ""}`;
    }
    say(msg, !!res.skippedDenied?.length && !res.added);
  }

  async function addFromInput() {
    const values = input.value.split(kind === "scam" ? /\n/ : /[\s,;]+/).map(v => v.trim()).filter(Boolean);
    if (!values.length) return;
    await add(values);
    input.value = "";
    input.focus();
  }
  input.addEventListener("keydown", e => { if (e.key === "Enter") addFromInput(); });
  search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); refresh(); });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (file.size > 25_000_000) return say("That file is too large.", true);
    const parsed = parseList(await file.text(), kind);
    if (!parsed.entries.length) return say("No usable entries found in that file.", true);
    await add(parsed.entries, parsed.invalid ? ` (${parsed.invalid} lines skipped)` : "");
  });

  // online lists
  const subList = h("div");
  const subSummary = h("summary");
  const subUrl = h("input", { type: "url", placeholder: "https://example.com/list.txt", "aria-label": "Online list address" });
  const subFeedback = h("p", { class: "feedback", role: "status" });
  const subs = h("details", { class: "subs" }, subSummary, subList,
    h("div", { class: "add-row" }, subUrl,
      h("button", {
        class: "btn", type: "button", onclick: async () => {
          if (!subUrl.value.trim()) return;
          subFeedback.textContent = "Downloading…";
          subFeedback.classList.remove("bad");
          const res = await send("addSubscription", { kind, url: subUrl.value.trim() });
          subFeedback.textContent = res?.ok ? "List added." : (res?.error || "Couldn't add that list.");
          subFeedback.classList.toggle("bad", !res?.ok);
          if (res?.ok) subUrl.value = "";
        }
      }, "Add list")),
    subFeedback);

  root.append(
    h("div", { class: "editor-tools" }, search, count),
    items,
    h("div", { class: "add-row" }, input,
      h("button", { class: "btn", type: "button", onclick: addFromInput }, "Add")),
    feedback,
    h("div", { class: "editor-actions" },
      h("button", { class: "btn small", type: "button", onclick: () => fileInput.click() }, "Import .txt file"),
      confirmButton("Remove all added here", "Click again to remove all", async () => {
        await send("clearManual", { kind });
        say("Removed all entries added here. Online lists are unchanged.");
      }),
      fileInput),
    subs);

  const restoreBtn = h("button", {
    class: "btn small", type: "button", hidden: true, onclick: async () => {
      restoreBtn.disabled = true;
      subFeedback.textContent = "Restoring the default list…";
      subFeedback.classList.remove("bad");
      const res = await send("restoreDefaultSubscriptions", { kind });
      subFeedback.textContent = res?.ok ? "Default list restored." : (res?.error || "Couldn't restore it.");
      restoreBtn.disabled = false;
    }
  }, "↺ Restore default list");
  const restoreNote = h("span", { class: "muted small" });
  root.querySelector(".editor-actions").append(restoreBtn);
  subs.insertBefore(h("div", { class: "restore-row" }, restoreNote), subList);

  function renderSubs() {
    const mine = (state.subscriptions || []).filter(s => s.kind === kind);
    const active = mine.filter(s => s.enabled !== false).length;
    subSummary.textContent = `Online lists (${active} on)`;
    // The default list for this section is missing or switched off: offer to put it back.
    const def = DEFAULT_SUBSCRIPTIONS.find(d => d.kind === kind);
    const cur = def && mine.find(s => s.id === def.id);
    const needsRestore = !!def && (!cur || cur.enabled === false);
    restoreBtn.hidden = !needsRestore;
    restoreNote.textContent = needsRestore ? `The default list "${def.name}" is ${cur ? "turned off" : "removed"}.` : "";
    if (needsRestore && !subs.open) subs.open = true;
    subList.replaceChildren(...(mine.length ? mine.map(s => {
      let meta;
      if (s.enabled === false) meta = h("span", { class: "meta" }, "Turned off");
      else if (s.lastError && s.source !== "bundled") {
        meta = h("span", { class: "meta bad" }, `⚠ ${s.lastError}${s.lastSync ? ` · last good copy ${ago(s.lastSync)}` : ""}`);
      } else if (s.lastSync) {
        meta = h("span", { class: "meta" },
          `${(s.count || 0).toLocaleString()} entries · ${s.source === "bundled" ? "built-in copy" : `updated ${ago(s.lastSync)}`}`);
      } else meta = h("span", { class: "meta" }, "Not downloaded yet");

      const isDefault = DEFAULT_SUBSCRIPTIONS.some(d => d.id === s.id);
      return h("div", { class: "sub" },
        h("span", { class: "name" }, s.name || s.url,
          isDefault ? h("span", { class: "pill" }, "default") : null,
          s.managed ? h("span", { class: "pill lock" }, "🔒 organization") : null),
        h("span", { class: "url" }, s.url),
        meta,
        h("span", { class: "controls" },
          s.managed ? null : switchEl(s.enabled !== false, e => send("toggleSubscription", { id: s.id, enabled: e.target.checked }), `Use ${s.name}`),
          h("button", {
            class: "icon-btn", type: "button", title: "Update now", "aria-label": `Update ${s.name}`,
            onclick: async e => { e.target.disabled = true; await send("syncOne", { id: s.id }); e.target.disabled = false; }
          }, "↻"),
          s.managed ? null : confirmButton("✕", isDefault ? "Remove default?" : "Remove?", () => send("removeSubscription", { id: s.id }), "icon-btn")));
    }) : [h("p", { class: "muted small" }, "No online lists.")]));
  }

  function refresh() {
    const list = state[MANUAL_KEYS[kind]] || [];
    const total = state.effectiveCounts?.[kind];
    count.textContent = `${list.length} added here` + (total != null ? ` · ${total.toLocaleString()} in use` : "");
    const shown = query ? list.filter(v => v.toLowerCase().includes(query)) : list;
    const rows = shown.slice(0, SHOW_MAX).map(v => h("div", { class: "item", role: "listitem" },
      h("span", { class: "label" }, v),
      h("button", {
        class: "icon-btn", type: "button", title: "Remove", "aria-label": `Remove ${v}`,
        onclick: () => send("removeManual", { kind, value: v })
      }, "✕")));
    if (!rows.length) rows.push(h("div", { class: "empty" }, query ? "No matches." : "Nothing added here yet."));
    if (shown.length > SHOW_MAX) rows.push(h("div", { class: "more" }, `Showing ${SHOW_MAX} of ${shown.length}. Use search to find others.`));
    items.replaceChildren(...rows);
    renderSubs();
  }

  editors[kind] = { refresh, add, say };
}

document.querySelectorAll(".editor[data-kind]").forEach(buildEditor);

// Most-visited sites
async function topSiteDomains() {
  const sites = await chrome.topSites.get();
  return sites.map(s => s.url).filter(u => /^https?:/i.test(u));
}
$("topSitesBtn").addEventListener("click", async () => {
  editors.allow.add(await topSiteDomains(), " from your most-visited sites");
});

// File-type presets
{
  const groups = new Map();
  MIME_PRESETS.forEach((p, i) => {
    if (!groups.has(p.group)) groups.set(p.group, h("optgroup", { label: p.group }));
    groups.get(p.group).append(h("option", { value: String(i) }, p.name));
  });
  $("mimePreset").replaceChildren(...groups.values());
}
$("mimePresetAdd").addEventListener("click", async () => {
  const preset = MIME_PRESETS[Number($("mimePreset").value)];
  const text = await (await fetch(chrome.runtime.getURL(preset.path))).text();
  await editors.mime.add(parseList(text, "mime").entries, ` from "${preset.name}"`);
});

// ---------------------------------------------------------------------------
// Requests and activity
// ---------------------------------------------------------------------------
function renderRequests() {
  const reqs = state.pendingRequests || [];
  $("requestsCard").hidden = !reqs.length;
  $("requestBadge").hidden = !reqs.length;
  $("requestBadge").textContent = String(reqs.length);
  $("requestList").replaceChildren(...reqs.slice().reverse().map(r => h("div", { class: "rowi" },
    h("span", { class: "what" }, h("strong", {}, r.domain)),
    h("span", { class: "when" }, ago(r.timestamp)),
    h("button", {
      class: "btn small primary", type: "button",
      onclick: async () => {
        const res = await send("approveRequest", { domain: r.domain });
        if (res?.skippedDenied?.length) editors.allow.say(`${r.domain} is on the always-blocked list and can't be allowed.`, true);
      }
    }, "Allow"),
    h("button", { class: "btn small", type: "button", onclick: () => send("dismissRequest", { domain: r.domain }) }, "Dismiss"))));

  // File-type requests (Downloads tab)
  const mreqs = state.pendingMimeRequests || [];
  $("mimeRequestsCard").hidden = !mreqs.length;
  $("mimeRequestBadge").hidden = !mreqs.length;
  $("mimeRequestBadge").textContent = String(mreqs.length);
  $("mimeRequestList").replaceChildren(...mreqs.slice().reverse().map(r => {
    // 2.3 requests hold one `mime`; 2.4 requests hold `mimes` (all types for an extension).
    const types = Array.isArray(r.mimes) && r.mimes.length ? r.mimes : [r.mime];
    const kind = describeRequest(types, r.ext);
    const approve = () => send("approveMimeRequest", { mimes: types });
    let allowBtn;
    if (kind.level === "unknown") {
      // octet-stream: lets almost anything through. Two clicks, worded plainly.
      allowBtn = confirmButton("Allow", "Allow ALL unknown files?", approve, "btn small danger");
    } else if (kind.level === "program") {
      // Programs need a second click, so they are never allowed by accident.
      allowBtn = confirmButton("Allow", "Allow programs?", approve, "btn small danger");
    } else {
      allowBtn = h("button", { class: "btn small primary", type: "button", onclick: approve }, "Allow");
    }
    let host = "";
    try { host = new URL(r.sourceUrl).hostname.replace(/^www\./, ""); } catch {}
    const basisLine = r.basis === "extension"
      ? `The site sent no real type, so it was checked by its name (.${r.ext}).`
      : r.basis === "unknown"
        ? `The site sent no real type and the name (${r.ext ? "." + r.ext : "no extension"}) doesn't say what it is.`
        : null;
    return h("div", { class: "rowi" },
      h("span", { class: "what" },
        h("strong", {}, kind.name),
        kind.level === "program" ? h("span", { class: "tag deny", style: "margin-left:6px" }, "Program") : null,
        kind.level === "unknown" ? h("span", { class: "tag deny", style: "margin-left:6px" }, "Any file") : null,
        h("span", { class: "type-list" }, ...types.map(t => h("code", {}, t))),
        h("span", { class: "excerpt" }, `${r.filename || "file"}${host ? ` from ${host}` : ""}`),
        basisLine ? h("span", { class: "excerpt" }, basisLine) : null,
        kind.level === "program" ? h("span", { class: "excerpt warn-text" }, "Programs can change the computer. Scammers ask people to download these.") : null,
        kind.level === "unknown" ? h("span", { class: "excerpt warn-text" }, "Allowing unknown files lets almost ANY download through, including programs. Only allow this if you trust everything this person downloads. It's safer to download the file for them.") : null),
      h("span", { class: "when" }, ago(r.timestamp)),
      allowBtn,
      h("button", { class: "btn small", type: "button", onclick: () => send("dismissMimeRequest", { mimes: types }) }, "Dismiss"));
  }));
}

function renderLogs() {
  const sites = (state.blockedLog || []).slice(-100).reverse();
  $("blockedLogList").replaceChildren(...(sites.length ? sites.map(e => h("div", { class: "rowi" },
    h("span", { class: `tag ${e.reason === "deny" ? "deny" : ""}` }, e.reason === "deny" ? "Dangerous" : "Not allowed"),
    h("span", { class: "what" }, e.url),
    h("span", { class: "when" }, ago(e.timestamp)))) : [h("div", { class: "empty" }, "Nothing blocked yet.")]));

  const dls = (state.blockedDownloads || []).slice(-100).reverse();
  $("blockedDownloadsList").replaceChildren(...(dls.length ? dls.map(e => h("div", { class: "rowi" },
    h("span", { class: "what" }, h("strong", {}, e.filename), " ", h("span", { class: "muted small" }, `(${e.mimeType})`),
      h("br"), h("span", { class: "muted small" }, e.sourceUrl)),
    h("span", { class: "when" }, ago(e.timestamp)))) : [h("div", { class: "empty" }, "No downloads stopped yet.")]));

  const scam = (state.scamLog || []).slice(-100).reverse();
  $("scamLogList").replaceChildren(...(scam.length ? scam.map(e => h("div", { class: "rowi" },
    h("span", { class: `tag ${e.action === "revealed" ? "deny" : ""}` }, e.action === "revealed" ? "Shown anyway" : "Hidden"),
    h("span", { class: "what" }, h("strong", {}, `“${e.term}”`), " ", h("span", { class: "muted small" }, shortHost(e.url)),
      e.excerpt ? h("span", { class: "excerpt" }, e.excerpt) : null),
    h("span", { class: "when" }, ago(e.timestamp)))) : [h("div", { class: "empty" }, "No scam text seen yet.")]));

  const audit = (state.auditLog || []).slice(-100).reverse();
  $("auditLogList").replaceChildren(...(audit.length ? audit.map(e => h("div", { class: "rowi" },
    h("span", { class: `tag ${e.type === "protection_off" ? "deny" : ""}` }, AUDIT_LABELS[e.type] || e.type),
    h("span", { class: "what" }, describeAudit(e)),
    h("span", { class: "when" }, ago(e.time)))) : [h("div", { class: "empty" }, "No changes yet.")]));
}

const AUDIT_LABELS = {
  protection_on: "Turned on", protection_off: "Turned off", protection_change_blocked: "Kept on (policy)",
  list_changed: "List", subscription_changed: "Online list", site_requested: "Request",
  request_approved: "Allowed", request_dismissed: "Dismissed",
  mime_requested: "File request", mime_request_approved: "File type allowed", mime_request_dismissed: "Dismissed"
};
function shortHost(u) {
  try { return new URL(u).hostname; } catch { return u || ""; }
}
function describeAudit(e) {
  switch (e.type) {
    case "protection_on": case "protection_off": case "protection_change_blocked": return e.label || e.setting;
    case "list_changed": return `${KIND_LABELS[e.kind] || e.kind}: ${e.change} ${e.count}${e.values?.length ? ` (${e.values.slice(0, 3).join(", ")}${e.count > 3 ? "…" : ""})` : ""}`;
    case "subscription_changed": return `${KIND_LABELS[e.kind] || e.kind || ""} ${e.name || e.url || ""}: ${e.change}`.trim();
    case "site_requested": return e.domain;
    case "request_approved": case "request_dismissed": return `${e.domain} (by ${e.by})`;
    case "mime_requested": return `${(e.mimes || [e.mime]).join(", ")} (${e.filename || "file"}${e.basis === "extension" ? `, by name .${e.ext}` : ""})`;
    case "mime_request_approved": case "mime_request_dismissed": return `${(e.mimes || [e.mime]).join(", ")} (by ${e.by})`;
    default: return JSON.stringify(e);
  }
}

// ---------- export ----------
function exportRows() {
  const rows = [];
  for (const e of state.blockedLog || []) rows.push({ time: e.timestamp, type: e.reason === "deny" ? "dangerous_site_blocked" : "site_blocked", detail: e.url, extra: "" });
  for (const e of state.blockedDownloads || []) rows.push({ time: e.timestamp, type: "download_blocked", detail: e.filename, extra: `${e.mimeType} from ${e.sourceUrl}` });
  for (const e of state.scamLog || []) rows.push({ time: e.timestamp, type: e.action === "revealed" ? "scam_text_revealed" : "scam_text_hidden", detail: e.term, extra: `${e.url} | ${e.excerpt || ""}` });
  for (const e of state.auditLog || []) rows.push({ time: e.time, type: e.type, detail: describeAudit(e), extra: e.by || "" });
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return rows;
}
function csvCell(v) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // stop spreadsheet formula injection
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
async function exportLog(kind) {
  const rows = exportRows();
  const person = (setting("personName") || "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `grandmas-guardian-${person ? person + "-" : ""}${stamp}`;
  let data, type, ext;
  if (kind === "csv") {
    data = "\uFEFF" + ["time,type,detail,extra", ...rows.map(r => [r.time, r.type, r.detail, r.extra].map(csvCell).join(","))].join("\r\n");
    type = "text/csv"; ext = "csv";
  } else {
    data = JSON.stringify({
      exported: new Date().toISOString(), person: setting("personName") || null, version: chrome.runtime.getManifest().version,
      blockedSites: state.blockedLog || [], blockedDownloads: state.blockedDownloads || [],
      scamText: state.scamLog || [], changes: state.auditLog || []
    }, null, 2);
    type = "application/json"; ext = "json";
  }
  // A data: URL survives the popup closing while the download starts.
  const url = `data:${type};charset=utf-8,${encodeURIComponent(data)}`;
  try {
    await chrome.downloads.download({ url, filename: `${base}.${ext}`, saveAs: false });
    $("exportStatus").textContent = `Saved ${base}.${ext} to Downloads (${rows.length} entries).`;
  } catch (e) {
    $("exportStatus").textContent = `Couldn't save: ${e.message}`;
  }
}
$("exportCsv").addEventListener("click", () => exportLog("csv"));
$("exportJson").addEventListener("click", () => exportLog("json"));

document.querySelectorAll("[data-clear]").forEach(b => b.addEventListener("click", () => send("clearLog", { key: b.dataset.clear })));

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------
const TEXT_SETTINGS = ["helperName", "helperPhone", "personName", "forwardUrl", "forwardAuth", "forwardFormat"];
function renderSettings() {
  for (const id of TEXT_SETTINGS) {
    const el = $(id);
    if (document.activeElement !== el) el.value = setting(id) || (id === "forwardFormat" ? "json" : "");
    el.disabled = isManaged(id);
    if (el.disabled) el.title = "Set by your organization";
  }
  $("forwardEnabled").checked = !!setting("forwardEnabled");
  $("forwardEnabled").disabled = isManaged("forwardEnabled");
  $("forwardDetails").hidden = !setting("forwardEnabled");
  const fs = state.forwardStatus;
  const queued = (state.forwardQueue || []).length;
  if (!$("forwardStatusText").dataset.busy) {
    $("forwardStatusText").textContent = fs
      ? (fs.ok ? `Last delivery ${ago(fs.at)}. ${queued} waiting.` : `Delivery failed ${ago(fs.at)}: ${fs.error} ${queued} waiting.`)
      : (queued ? `${queued} events waiting.` : "");
  }
  $("incognitoStatus").textContent = incognitoAllowed
    ? "✅ Private windows are protected."
    : "⚠ Private windows are NOT protected. Open extension settings and turn on “Allow in Incognito”.";
  $("version").textContent = `Version ${chrome.runtime.getManifest().version}`;
}

$("saveHelper").addEventListener("click", async () => {
  await chrome.storage.local.set({
    helperName: $("helperName").value.trim().slice(0, 60),
    helperPhone: $("helperPhone").value.trim().slice(0, 40),
    personName: $("personName").value.trim().slice(0, 60)
  });
  $("helperSaved").textContent = "Saved.";
  setTimeout(() => { $("helperSaved").textContent = ""; }, 2500);
});

$("syncAll").addEventListener("click", async () => {
  $("syncStatus").textContent = "Updating…";
  await send("syncAll");
  $("syncStatus").textContent = "Done.";
});
$("restoreDefaults").addEventListener("click", async () => {
  $("syncStatus").textContent = "Restoring default lists…";
  await send("restoreDefaultSubscriptions");
  $("syncStatus").textContent = "Default lists restored.";
});

function flash(id, text) {
  const el = $(id);
  el.dataset.busy = "1";
  el.textContent = text;
  setTimeout(() => { delete el.dataset.busy; }, 4000);
}
// ---------- log forwarding ----------
$("forwardEnabled").addEventListener("change", e => chrome.storage.local.set({ forwardEnabled: e.target.checked }));
$("saveForward").addEventListener("click", async () => {
  const url = $("forwardUrl").value.trim();
  if (url && !/^https:\/\//i.test(url)) return flash("forwardStatusText", "The collector address must start with https://");
  const patch = {};
  if (!isManaged("forwardUrl")) patch.forwardUrl = url;
  if (!isManaged("forwardAuth")) patch.forwardAuth = $("forwardAuth").value.trim();
  if (!isManaged("forwardFormat")) patch.forwardFormat = $("forwardFormat").value;
  await chrome.storage.local.set(patch);
  flash("forwardStatusText", "Saved.");
});
$("testForward").addEventListener("click", async () => {
  flash("forwardStatusText", "Sending…");
  const res = await send("testForward");
  flash("forwardStatusText", res?.ok ? "Test event delivered." : (res?.error || "Couldn't deliver."));
});

function openExtensionsPage() {
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
}
function openSetupTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?setup=1") });
  if (!tabMode) window.close();
}
$("openExtPage").addEventListener("click", openExtensionsPage);
$("rerunSetup").addEventListener("click", () => (tabMode ? showSetup(true) : openSetupTab()));
$("openTab").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  window.close();
});

async function checkIncognito() {
  try {
    incognitoAllowed = await chrome.extension.isAllowedIncognitoAccess();
  } catch {
    incognitoAllowed = true;
  }
}

// ---------------------------------------------------------------------------
// First-time setup guide
// ---------------------------------------------------------------------------
const STEPS = 5;
let step = 1;

function showSetup(show) {
  $("setup").hidden = !show;
  $("app").hidden = show;
  if (show) {
    step = 1;
    renderSetup();
  }
}

function renderSetupToggles() {
  $("setupToggles").replaceChildren(...PROTECTIONS.map(p => h("div", { class: "toggle-row" },
    h("div", { class: "text" }, h("strong", {}, p.title), h("span", { class: "desc" }, p.desc)),
    switchEl(!!setting(p.key), e => chrome.storage.local.set({ [p.key]: e.target.checked }), p.title))));
}

function renderSetup() {
  document.querySelectorAll(".step").forEach(s => s.classList.toggle("active", Number(s.dataset.step) === step));
  $("stepDots").replaceChildren(...Array.from({ length: STEPS }, (_, i) => h("li", { class: i < step ? "done" : "" })));
  $("setupBack").hidden = step === 1;
  $("setupNext").textContent = step === STEPS ? "Finish" : "Next";

  if (step === 1) {
    $("setupHelperName").value = setting("helperName") || "";
    $("setupHelperPhone").value = setting("helperPhone") || "";
    $("setupPersonName").value = setting("personName") || "";
  }
  if (step === 2) {
    renderSetupToggles();
    const c = state.effectiveCounts;
    $("setupListStatus").textContent = c && (c.allow || c.mime || c.scam)
      ? `Lists loaded: ${c.allow} websites, ${c.deny} always-blocked sites, ${c.mime} file types, ${c.scam} scam phrases.`
      : "Downloading the default lists…";
  }
  if (step === 3) {
    const n = (state[MANUAL_KEYS.allow] || []).length;
    $("setupDomainStatus").textContent = n ? `${n} website${n === 1 ? "" : "s"} added so far (plus the default list).` : "";
  }
  if (step === 4) {
    $("setupIncognitoOk").hidden = !incognitoAllowed;
    $("setupIncognitoBad").hidden = incognitoAllowed;
  }
}

async function setupAdd(values, label) {
  const res = await send("addManual", { kind: "allow", values });
  let msg = res?.ok ? `Added ${res.added} ${label}.` : (res?.error || "Couldn't add that.");
  if (res?.skippedDenied?.length) msg += ` Skipped (always-blocked): ${res.skippedDenied.join(", ")}.`;
  $("setupDomainStatus").textContent = msg;
}

$("setupTopSites").addEventListener("click", async () => setupAdd(await topSiteDomains(), "most-visited websites"));
$("setupDomainAdd").addEventListener("click", async () => {
  const v = $("setupDomainInput").value.trim();
  if (!v) return;
  await setupAdd(v.split(/[\s,;]+/), "website(s)");
  $("setupDomainInput").value = "";
});
$("setupDomainInput").addEventListener("keydown", e => { if (e.key === "Enter") $("setupDomainAdd").click(); });
$("setupOpenExt").addEventListener("click", openExtensionsPage);
$("setupCheckIncognito").addEventListener("click", async () => { await checkIncognito(); renderSetup(); renderAll(); });

$("setupBack").addEventListener("click", () => { step = Math.max(1, step - 1); renderSetup(); });
$("setupNext").addEventListener("click", async () => {
  if (step === 1) {
    await chrome.storage.local.set({
      helperName: $("setupHelperName").value.trim().slice(0, 60),
      helperPhone: $("setupHelperPhone").value.trim().slice(0, 40),
      personName: $("setupPersonName").value.trim().slice(0, 60)
    });
  }
  if (step < STEPS) {
    step++;
    if (step === 4) await checkIncognito();
    renderSetup();
    return;
  }
  await chrome.storage.local.set({ setupComplete: true });
  history.replaceState(null, "", location.pathname);
  showSetup(false);
});

// ---------------------------------------------------------------------------
// Render + live updates
// ---------------------------------------------------------------------------
function renderAll() {
  renderHeader();
  renderAlerts();
  renderToggles();
  renderRequests();
  renderLogs();
  renderSettings();
  Object.values(editors).forEach(e => e.refresh());
}

let renderTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.keys(changes).some(k => STATE_KEYS.includes(k))) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    await loadState();
    renderAll();
    if (!$("setup").hidden && step === 2) renderSetup();
  }, 100);
});

await Promise.all([loadState(), checkIncognito()]);
renderAll();

const wantsSetup = new URLSearchParams(location.search).has("setup");
if (tabMode && (wantsSetup || !setting("setupComplete"))) showSetup(true);
if ((state.pendingRequests || []).length) selectTab("sites");
else if ((state.pendingMimeRequests || []).length) selectTab("downloads");
