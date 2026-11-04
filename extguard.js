// extguard.js — only allowed browser extensions may run.
//
// Same idea as the website allowlist: extensions on the allow list run; everything
// else is switched off as soon as it's installed or switched on, and the person can
// ask for it. Extensions on the always-block list are switched off even if someone
// allows them; only a support team can make an exception.
//
// Uses chrome.management (an optional permission, granted when the feature is turned
// on). Never touched: this extension itself, themes, and extensions installed by the
// organization's policy (the browser doesn't allow it, and the organization chose them).
//
// Firefox only lets an add-on switch other add-ons off when it was itself installed by
// enterprise policy (Firefox 140+). Otherwise it still detects, logs, warns and sends
// requests, and the page offers to remove the extension.
import { LOG_CAPS, extensionRisk, extensionSource, normalizeExtId } from "./lib.js";

const PAGE = () => chrome.runtime.getURL("extensionblocked.html");
const PAGE_COOLDOWN_MS = 2 * 60e3;

export function makeExtensionGuard({ getEffective, getSettings, recordEvent, appendCapped, updateKey, notify, openSingleTab }) {
  const selfId = chrome.runtime.id;
  const lastPage = new Map(); // extension id -> when its page was last opened
  let listening = false;

  const available = () => !!chrome.management?.getAll;
  async function permitted() {
    try { return await chrome.permissions.contains({ permissions: ["management"] }); } catch { return available(); }
  }

  /** What's logged and sent to the team about an extension (no icons, no internal URLs). */
  function summarize(info) {
    const id = normalizeExtId(info.id) || String(info.id || "").slice(0, 100);
    const base = {
      id,
      name: String(info.name || id).slice(0, 100),
      version: String(info.version || "").slice(0, 40),
      description: String(info.description || "").slice(0, 300),
      type: String(info.type || "extension").slice(0, 30),
      installType: String(info.installType || "").slice(0, 20),
      permissions: (info.permissions || []).map(String).slice(0, 100),
      hostPermissions: (info.hostPermissions || []).map(String).slice(0, 100),
      homepageUrl: /^https?:\/\//i.test(info.homepageUrl || "") ? String(info.homepageUrl).slice(0, 300) : "",
      updateUrl: /^https?:\/\//i.test(info.updateUrl || "") ? String(info.updateUrl).slice(0, 300) : ""
    };
    return { ...base, source: extensionSource(base) };
  }

  /** self | theme | policy | allow | deny | block */
  function decide(info, eff) {
    if (info.id === selfId) return "self";
    if (info.type === "theme") return "theme";
    if (info.mayDisable === false || info.installType === "admin") return "policy";
    const id = normalizeExtId(info.id);
    const denied = eff.sets.extdeny.has(id) && !eff.extExceptions.has(id);
    if (denied) return "deny";
    if (eff.sets.extallow.has(id)) return "allow";
    return "block";
  }

  async function disabledByUs() {
    const { extDisabledByUs = [] } = await chrome.storage.local.get("extDisabledByUs");
    return new Set(extDisabledByUs);
  }
  const markDisabled = (id, on) => updateKey("extDisabledByUs", list => {
    const has = list.includes(id);
    if (on && !has) return [...list, id];
    if (!on && has) return list.filter(x => x !== id);
    return undefined;
  });

  /** Apply the lists to one extension. Returns the decision. */
  async function enforce(info, eff, { openPage = true, why = "check" } = {}) {
    const d = decide(info, eff);
    const id = normalizeExtId(info.id) || info.id;
    if (d === "self" || d === "theme" || d === "policy") return d;
    if (d === "allow") {
      // Allowed now (approved, or added to the list): switch back on what we switched off.
      if (!info.enabled && (await disabledByUs()).has(id)) {
        try {
          await chrome.management.setEnabled(info.id, true);
          await markDisabled(id, false);
          await recordEvent({ type: "extension_enabled", extension: summarize(info), why });
        } catch {}
      }
      return d;
    }
    if (!info.enabled) return d; // already off
    // Where it can't be switched off (Firefox without policy install), warn once a day, not on every check.
    const { extWarned = {} } = await chrome.storage.local.get("extWarned");
    if (extWarned[id] && Date.now() - extWarned[id] < 24 * 3600e3 && why !== "installed") return d;
    let stopped = false;
    try {
      await chrome.management.setEnabled(info.id, false);
      stopped = true;
      await markDisabled(id, true);
    } catch {
      stopped = false; // Firefox without policy install, or the browser refused
      await updateKey("extWarned", map => ({ ...map, [id]: Date.now() }), {});
    }
    const ext = summarize(info);
    const risk = extensionRisk(ext);
    const entry = {
      timestamp: new Date().toISOString(), ...ext, action: d === "deny" ? "always-blocked" : "not allowed", stopped,
      flags: risk.flags.map(f => f.code), why
    };
    await appendCapped("extensionLog", entry, LOG_CAPS.extensionLog);
    await recordEvent({ type: "extension_blocked", reason: d === "deny" ? "always-blocked" : "not on the allowed list", stopped, why,
      extension: ext, flags: entry.flags });
    if (openPage) await showPage(id, ext.name, stopped);
    return d;
  }

  async function showPage(id, name, stopped) {
    const t = Date.now();
    if (t - (lastPage.get(id) || 0) < PAGE_COOLDOWN_MS) return;
    lastPage.set(id, t);
    await openSingleTab("ggExtensionTab", `${PAGE()}?id=${encodeURIComponent(id)}`);
    notify(`gg-ext-${id}`, stopped ? "Extension turned off" : "Extension not allowed",
      stopped ? `"${name}" was turned off because it isn't on the allowed list. Click for details.`
        : `"${name}" isn't on the allowed list. Click for details.`);
  }

  /** Check every installed extension (start-up, lists changed, feature turned on). */
  async function sweep(why = "check") {
    const s = await getSettings();
    if (!s.extensionFilteringEnabled || !available() || !(await permitted())) return { ok: false };
    const eff = await getEffective();
    let all = [];
    try { all = await chrome.management.getAll(); } catch { return { ok: false }; }
    let pagesLeft = 1; // a sweep opens at most one page; the popup lists the rest
    const counts = {};
    for (const info of all) {
      const before = info.enabled;
      const d = await enforce(info, eff, { openPage: pagesLeft > 0, why });
      if (before && (d === "block" || d === "deny")) pagesLeft--;
      counts[d] = (counts[d] || 0) + 1;
    }
    return { ok: true, counts };
  }

  async function onChange(info, why) {
    const s = await getSettings();
    if (!s.extensionFilteringEnabled || !info) return;
    const eff = await getEffective();
    await enforce(info, eff, { why });
  }

  /** Listen for installs and re-enables (only possible once the permission is granted). */
  function listen() {
    if (listening || !available()) return;
    listening = true;
    chrome.management.onInstalled.addListener(info => onChange(info, "installed"));
    chrome.management.onEnabled.addListener(info => onChange(info, "switched on"));
  }

  /**
   * Turn the feature on. Extensions already installed are added to the allowed list,
   * except always-blocked ones, so nothing the person relies on stops without warning;
   * the caregiver reviews them in the Extensions tab.
   */
  async function turnOn() {
    if (!available() || !(await permitted())) return { ok: false, error: "The browser didn't give permission to manage extensions." };
    listen();
    const eff = await getEffective();
    const all = await chrome.management.getAll();
    const keep = all.filter(i => decide(i, eff) === "block").map(i => normalizeExtId(i.id)).filter(Boolean);
    if (keep.length) {
      await updateKey("allowedExtensions", list => [...new Set([...list, ...keep])]);
      await recordEvent({ type: "list_changed", kind: "extallow", change: "added", count: keep.length, values: keep.slice(0, 20), by: "turning on extension protection" });
    }
    await chrome.storage.local.set({ extensionFilteringEnabled: true });
    const r = await sweep("turned on");
    return { ok: true, keptAllowed: keep.length, ...r };
  }

  /** Turn it off: switch back on everything this extension switched off. */
  async function turnOff() {
    await chrome.storage.local.set({ extensionFilteringEnabled: false });
    const ids = await disabledByUs();
    let restored = 0;
    if (available()) {
      for (const info of await chrome.management.getAll().catch(() => [])) {
        if (ids.has(normalizeExtId(info.id)) && !info.enabled) {
          try { await chrome.management.setEnabled(info.id, true); restored++; } catch {}
        }
      }
    }
    await chrome.storage.local.set({ extDisabledByUs: [] });
    return { ok: true, restored };
  }

  /** Everything installed, with the decision and plain-language permissions (for the settings page). */
  async function list() {
    const s = await getSettings();
    const ok = available() && (await permitted());
    if (!ok) return { ok: true, permitted: false, enabled: !!s.extensionFilteringEnabled, items: [] };
    const eff = await getEffective();
    let self = null;
    try { self = await chrome.management.getSelf(); } catch {}
    const items = (await chrome.management.getAll()).filter(i => i.id !== selfId).map(i => {
      const ext = summarize(i);
      return { ...ext, enabled: i.enabled, decision: decide(i, eff), ...extensionRisk(ext) };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, permitted: true, enabled: !!s.extensionFilteringEnabled, selfInstallType: self?.installType || "", items };
  }

  async function info(id) {
    const nid = normalizeExtId(id);
    if (!nid || !available() || !(await permitted())) return null;
    const all = await chrome.management.getAll().catch(() => []);
    return all.find(i => normalizeExtId(i.id) === nid) || null;
  }

  return { available, permitted, listen, sweep, turnOn, turnOff, list, info, decide, summarize, enforce };
}
