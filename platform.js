// platform.js — the few places where Chrome and Firefox differ.
// Everything else uses the shared chrome.* API, which both browsers provide
// (Firefox's chrome.* returns promises in Manifest V3, like Chrome's).

/** True in Firefox (desktop or Android). Chrome, Edge and other Chromium browsers have no getBrowserInfo. */
export const IS_FIREFOX = typeof globalThis.browser !== "undefined" && typeof globalThis.browser?.runtime?.getBrowserInfo === "function";

/** True where the download is held until the extension answers (Chromium). */
export const CAN_HOLD_DOWNLOADS = !!globalThis.chrome?.downloads?.onDeterminingFilename;

// Firefox asks people to agree before an extension sends data off the computer
// (manifest: browser_specific_settings.gecko.data_collection_permissions).
// Grandma's Guardian only sends data when someone turns on one of these:
export const SUPPORT_DATA = ["browsingActivity", "personallyIdentifyingInfo"];             // support team: sites/files asked for + person's name
export const FORWARD_DATA = ["browsingActivity", "websiteContent", "personallyIdentifyingInfo"]; // log forwarding: also blocked scam text

/** Does the person allow sending these kinds of data? Always true outside Firefox. */
export async function hasDataConsent(kinds) {
  if (!IS_FIREFOX) return true;
  try {
    const all = await chrome.permissions.getAll();
    const granted = all.data_collection || [];
    return kinds.every(k => granted.includes(k));
  } catch {
    return true; // an older Firefox without data-collection permissions
  }
}

/**
 * Ask for consent. MUST be the first thing a click handler awaits: Firefox only shows
 * the prompt during the click itself.
 */
export async function requestDataConsent(kinds) {
  if (!IS_FIREFOX) return true;
  try {
    return await chrome.permissions.request({ data_collection: kinds });
  } catch {
    return hasDataConsent(kinds);
  }
}

/** Firefox lets people take away "access to all websites"; without it, block pages can't be shown. */
export async function hasSiteAccess() {
  if (!IS_FIREFOX) return true;
  try { return await chrome.permissions.contains({ origins: ["<all_urls>"] }); } catch { return true; }
}
export async function requestSiteAccess() {
  try { return await chrome.permissions.request({ origins: ["<all_urls>"] }); } catch { return false; }
}

export const CONSENT_ERROR = "Firefox needs your OK before this computer sends anything to the support team or a collector. Open Grandma's Guardian's settings and click Connect (or Save) again to allow it.";

/**
 * Which browser account this is, for support-team licensing. A license is one browser
 * account on one kind of device: the same browser signed in to the same account (with
 * sync on) shares a random ID through chrome.storage.sync, so its computers count once.
 * The ID is random, created only when connecting to a support team, and says nothing
 * about the person. A phone or tablet, or another browser, is a separate license.
 */
export async function browserIdentity() {
  let id = null;
  try {
    ({ ggAccountId: id = null } = await chrome.storage.sync.get("ggAccountId"));
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await chrome.storage.sync.set({ ggAccountId: id });
    }
  } catch {
    id = null; // no synced storage: this browser counts as its own license
  }
  let browser = "chromium";
  if (IS_FIREFOX) browser = "firefox";
  else {
    const brands = (globalThis.navigator?.userAgentData?.brands || []).map(b => b.brand).join(" ");
    const ua = globalThis.navigator?.userAgent || "";
    if (/Edge/i.test(brands) || /Edg(A|iOS)?\//.test(ua)) browser = "edge";
    else if (/Brave/i.test(brands) || globalThis.navigator?.brave) browser = "brave";
    else if (/Opera/i.test(brands) || /OPR\//.test(ua)) browser = "opera";
    else if (/Vivaldi/i.test(ua)) browser = "vivaldi";
    else if (/Google Chrome/i.test(brands) || /Chrome\//.test(ua)) browser = "chrome";
  }
  let formFactor = "desktop";
  try {
    const { os } = await chrome.runtime.getPlatformInfo();
    if (os === "android" || os === "ios") formFactor = "mobile";
  } catch {
    if (globalThis.navigator?.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/i.test(globalThis.navigator?.userAgent || "")) formFactor = "mobile";
  }
  return { id, browser, formFactor };
}
