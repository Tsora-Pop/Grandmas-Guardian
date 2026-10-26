// lib.js — shared constants and list helpers.
// Imported as an ES module by background.js and popup.js.
// content.js and blockpage.js do not import this file.

export const LIST_BASE = "https://tsora-pop.github.io/lists";

// Which storage key holds the hand-entered (manual) entries for each list kind.
export const MANUAL_KEYS = {
  allow: "allowlist",
  deny: "denylist",
  mime: "allowedMimeTypes",
  scam: "scamTerms"
};

export const KIND_LABELS = {
  allow: "Allowed websites",
  deny: "Always-blocked websites",
  mime: "Allowed file types",
  scam: "Scam words"
};

// Default subscriptions. `fallback` is a copy bundled inside the extension that is
// used when the remote copy cannot be fetched and nothing has been downloaded yet.
export const DEFAULT_SUBSCRIPTIONS = [
  {
    id: "default-allow",
    kind: "allow",
    name: "Default US websites",
    url: `${LIST_BASE}/domain/domainUSDefault.txt`,
    fallback: "lists/domain/domainUSDefault.txt"
  },
  {
    id: "default-deny",
    kind: "deny",
    name: "Remote-control and abused hosting sites",
    url: `${LIST_BASE}/domain/denyDefault.txt`,
    fallback: "lists/domain/denyDefault.txt"
  },
  {
    id: "default-mime",
    kind: "mime",
    name: "Common documents and pictures",
    url: `${LIST_BASE}/mime/mimeDefault.txt`,
    fallback: "lists/mime/mimeDefault.txt"
  },
  {
    id: "default-scam",
    kind: "scam",
    name: "Common scam phrases",
    url: `${LIST_BASE}/semantics/scamTermDefault.txt`,
    fallback: "lists/semantic/scamTermDefault.txt"
  }
];

// File-type groups bundled with the extension (Downloads tab). `group` becomes
// the heading in the menu. Each file is also published under LIST_BASE/mime/.
export const MIME_PRESETS = [
  { group: "Everyday", name: "Documents and pictures (default)", path: "lists/mime/mimeDefault.txt" },
  { group: "Everyday", name: "Plain text, CSV and rich text", path: "lists/mime/mimeText.txt" },
  { group: "Everyday", name: "Phone and camera photos (HEIC, AVIF, RAW)", path: "lists/mime/mimePhonePhotos.txt" },
  { group: "Everyday", name: "Calendar invites and contact cards", path: "lists/mime/mimeCalendarContacts.txt" },
  { group: "Everyday", name: "E-books (EPUB, Kindle)", path: "lists/mime/mimeEbooks.txt" },
  { group: "Everyday", name: "Music and audio", path: "lists/mime/mimeMusic.txt" },
  { group: "Everyday", name: "Video", path: "lists/mime/mimeVideo.txt" },
  { group: "Everyday", name: "Printing and scanning (XPS, TIFF)", path: "lists/mime/mimePrintScan.txt" },
  { group: "Office", name: "Older Office files (.doc, .xls, .ppt)", path: "lists/mime/mimeLegacyOffice.txt" },
  { group: "Office", name: "LibreOffice / OpenOffice files", path: "lists/mime/mimeOpenDocument.txt" },
  { group: "Office", name: "Apple Pages, Numbers, Keynote", path: "lists/mime/mimeAppleIWork.txt" },
  { group: "Office", name: "Saved emails (.eml, .msg)", path: "lists/mime/mimeEmail.txt" },
  { group: "Office", name: "Databases and spreadsheets", path: "lists/mime/mimDatabase.txt" },
  { group: "Home and hobbies", name: "Bank and tax downloads (OFX, QFX, QIF)", path: "lists/mime/mimeBankingTax.txt" },
  { group: "Home and hobbies", name: "Family history (GEDCOM)", path: "lists/mime/mimeGenealogy.txt" },
  { group: "Home and hobbies", name: "Medical images (DICOM)", path: "lists/mime/mimeMedical.txt" },
  { group: "Home and hobbies", name: "3D printing and CAD (STL, 3MF, STEP)", path: "lists/mime/mimeCad3D.txt" },
  { group: "Home and hobbies", name: "Fonts", path: "lists/mime/mimeFonts.txt" },
  { group: "Home and hobbies", name: "Artist / design files", path: "lists/mime/mimeArtist.txt" },
  { group: "Home and hobbies", name: "Music and video (combined, v1)", path: "lists/mime/mimeAudioVideo.txt" },
  { group: "Risky: only if needed", name: "Compressed folders (.zip, .rar)", path: "lists/mime/mimeArchives.txt" },
  { group: "Risky: only if needed", name: "Office macro files", path: "lists/mime/mimeofficepoweruser.txt" },
  { group: "Risky: only if needed", name: "Developer files (includes programs)", path: "lists/mime/mimeDeveloper.txt" },
  { group: "Risky: only if needed", name: "Sysadmin files (includes programs)", path: "lists/mime/mimesysadmin.txt" }
];

// Sites that are always blocked unless the exact host is on the allowlist.
// (Kept from v1 so behaviour does not change for existing installs.)
export const BUILTIN_DENY = [
  "remoteassistance.support.services.microsoft.com",
  "remotedesktop.google.com"
];

export const PROTECTION_KEYS = [
  "domainFilteringEnabled", "denyFilteringEnabled", "mimeFilteringEnabled", "filteringEnabled"
];

export const DEFAULT_SETTINGS = {
  filteringEnabled: true,        // scam words
  domainFilteringEnabled: true,  // website allowlist
  denyFilteringEnabled: true,    // always-block list
  mimeFilteringEnabled: true,    // download file types
  helperName: "",
  helperPhone: "",
  personName: "",                // who uses this computer, e.g. "Grandma Jean" (used in logs)
  setupComplete: false,
  // Log forwarding (any HTTPS endpoint: SIEM, log collector, automation)
  forwardEnabled: false,
  forwardUrl: "",
  forwardAuth: "",               // full Authorization header value, e.g. "Bearer abc" or "Splunk abc"
  forwardFormat: "json"          // json (array) | ndjson | splunk
};

// Settings an organisation can set by policy (chrome.storage.managed, see
// managed_schema.json). A managed value overrides the local one and is locked in the UI.
export const MANAGED_SETTING_KEYS = [
  "helperName", "helperPhone", "personName",
  "forwardEnabled", "forwardUrl", "forwardAuth", "forwardFormat"
];

export const REFRESH_MINUTES = 24 * 60;
export const LOG_CAPS = {
  blockedLog: 500, blockedDownloads: 200, pendingRequests: 50,
  scamLog: 500, auditLog: 300, forwardQueue: 2000
};

// ---------- normalisers ----------

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const SINK_IPS = new Set(["0.0.0.0", "127.0.0.1", "::1", "::", "255.255.255.255"]);

/**
 * Turn whatever a person (or a list) typed into a bare, lowercase, punycoded host.
 * Accepts: "example.com", "https://www.example.com/path", "*.example.com",
 * hosts-file lines ("0.0.0.0 example.com"), and adblock lines ("||example.com^").
 * Returns null when it is not a usable host name.
 * stripWww: drop a leading "www." (used for the allowlist, where example.com
 * already covers www.example.com). Not used for the block list, so a feed entry
 * like "www.example.com" never widens into blocking all of example.com.
 */
export function normalizeDomain(input, { stripWww = false } = {}) {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;

  // hosts-file format: "0.0.0.0 evil.com" / "127.0.0.1 evil.com"
  const parts = s.split(/\s+/);
  if (parts.length > 1) {
    if (SINK_IPS.has(parts[0]) || IPV4_RE.test(parts[0])) s = parts[1];
    else s = parts[0];
  }
  // adblock format
  if (s.startsWith("||")) s = s.slice(2);
  s = s.replace(/\^.*$/, "");
  if (s.startsWith("*.")) s = s.slice(2);
  if (s.startsWith(".")) s = s.slice(1);

  let host;
  try {
    host = new URL(s.includes("://") ? s : `http://${s}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "");
  if (stripWww && host.startsWith("www.") && host.split(".").length > 2) host = host.slice(4);
  if (SINK_IPS.has(host) || host === "localhost") return null;
  if (!HOST_RE.test(host)) return null;
  if (!host.includes(".")) return null;
  return host;
}

const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export function normalizeMime(input) {
  if (typeof input !== "string") return null;
  const s = input.split(";")[0].trim().toLowerCase();
  return MIME_RE.test(s) ? s : null;
}

/** Scam terms: lowercase, straight quotes, single spaces, 3–200 characters. */
export function normalizeTerm(input) {
  if (typeof input !== "string") return null;
  const s = input
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (s.length < 3 || s.length > 200) return null;
  return s;
}

export function normalizeFor(kind, value) {
  switch (kind) {
    case "allow": return normalizeDomain(value, { stripWww: true });
    case "deny": return normalizeDomain(value);
    case "mime": return normalizeMime(value);
    case "scam": return normalizeTerm(value);
    default: return null;
  }
}

/**
 * Parse a downloaded or imported .txt list.
 * Skips blank lines and comment lines (#, !, //, ;, ---). For domain lists a
 * trailing " # comment" is also removed.
 */
export function parseList(text, kind) {
  const valid = new Set();
  let considered = 0;
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    if (/^(#|!|\/\/|;|---|\[)/.test(line)) continue;
    if (kind === "allow" || kind === "deny" || kind === "mime") {
      line = line.replace(/\s+#.*$/, "").trim();
      if (!line) continue;
    }
    considered++;
    const v = normalizeFor(kind, line);
    if (v) valid.add(v);
  }
  return { entries: [...valid], considered, invalid: considered - valid.size };
}

/**
 * Decide whether a fetched list looks like the right kind of list.
 * Protects against captive portals, 404 pages and HTML being merged in.
 */
export function checkParsedList(parsed, kind) {
  if (parsed.entries.length === 0) return `No usable ${KIND_LABELS[kind].toLowerCase()} found in the file.`;
  if (parsed.considered >= 5 && parsed.entries.length / parsed.considered < 0.5) {
    return `This doesn't look like a list of ${KIND_LABELS[kind].toLowerCase()} (most lines were not valid).`;
  }
  return null;
}

export function looksLikeHtml(text, contentType = "") {
  if (/text\/html|application\/xhtml/i.test(contentType)) return true;
  return /^\s*(<!doctype html|<html|<head|<body)/i.test(String(text).slice(0, 512));
}

/** Does `host` equal or sit under any domain in `domainSet`? */
export function hostMatches(host, domainSet) {
  let h = host;
  while (h) {
    if (domainSet.has(h)) return true;
    const i = h.indexOf(".");
    if (i < 0) return false;
    h = h.slice(i + 1);
  }
  return false;
}

/** Random lowercase token (base36) of roughly `bytes * 1.6` characters. */
export function randomToken(bytes = 16) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a, b => b.toString(36).padStart(2, "0")).join("");
}

/** Merge local settings with managed (policy) settings. Managed wins. */
export function effectiveSettings(local = {}, managed = {}) {
  const s = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (local[k] !== undefined) s[k] = local[k];
  for (const k of MANAGED_SETTING_KEYS) if (managed[k] !== undefined) s[k] = managed[k];
  if (managed.forceProtectionsOn) for (const k of PROTECTION_KEYS) s[k] = true;
  return s;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
