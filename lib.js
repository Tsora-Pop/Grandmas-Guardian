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
  scamLog: 500, auditLog: 300, forwardQueue: 2000, pendingMimeRequests: 50
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

// ---------------------------------------------------------------------------
// File types: plain-language names and risk levels (download-stopped page, popup)
// ---------------------------------------------------------------------------
const MIME_NAMES = {
  "application/pdf": "PDF document",
  "application/msword": "Word document (old .doc)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document (.docx)",
  "application/vnd.ms-excel": "Excel spreadsheet (old .xls)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel spreadsheet (.xlsx)",
  "application/vnd.ms-powerpoint": "PowerPoint presentation (old .ppt)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint presentation (.pptx)",
  "application/rtf": "Rich text document (.rtf)",
  "text/plain": "Plain text file (.txt)",
  "text/csv": "Spreadsheet data (.csv)",
  "text/calendar": "Calendar invite (.ics)",
  "text/vcard": "Contact card (.vcf)",
  "application/epub+zip": "E-book (.epub)",
  "image/jpeg": "Photo (.jpg)",
  "image/png": "Picture (.png)",
  "image/gif": "Animated picture (.gif)",
  "image/webp": "Picture (.webp)",
  "image/heic": "iPhone photo (.heic)",
  "image/heif": "iPhone photo (.heif)",
  "image/svg+xml": "Drawing (.svg)",
  "audio/mpeg": "Music or audio (.mp3)",
  "audio/mp4": "Music or audio (.m4a)",
  "audio/wav": "Sound recording (.wav)",
  "video/mp4": "Video (.mp4)",
  "video/quicktime": "Video (.mov)",
  "application/zip": "Compressed folder (.zip)",
  "application/x-zip-compressed": "Compressed folder (.zip)",
  "application/x-7z-compressed": "Compressed folder (.7z)",
  "application/x-rar-compressed": "Compressed folder (.rar)",
  "application/vnd.rar": "Compressed folder (.rar)",
  "application/x-msdownload": "Windows program (.exe)",
  "application/x-msdos-program": "Windows program (.exe)",
  "application/vnd.microsoft.portable-executable": "Windows program (.exe)",
  "application/x-msi": "Windows installer (.msi)",
  "application/x-ms-installer": "Windows installer (.msi)",
  "application/x-apple-diskimage": "Mac installer (.dmg)",
  "application/vnd.apple.installer+xml": "Mac installer (.pkg)",
  "application/vnd.android.package-archive": "Android app (.apk)",
  "application/x-sh": "Script (.sh)",
  "application/x-shellscript": "Script (.sh)",
  "application/x-bat": "Windows script (.bat)",
  "application/x-powershell": "PowerShell script (.ps1)",
  "application/hta": "HTML application (.hta)",
  "application/x-java-archive": "Java program (.jar)",
  "application/java-archive": "Java program (.jar)",
  "application/x-ms-shortcut": "Windows shortcut (.lnk)",
  "application/x-dosexec": "Windows program (.exe)",
  "application/msix": "Windows app installer (.msix)",
  "application/x-vbscript": "Windows script (.vbs)",
  "application/javascript": "Script (.js)",
  "application/x-iso9660-image": "Disc image (.iso)",
  "application/vnd.oasis.opendocument.text": "LibreOffice document (.odt)",
  "application/vnd.oasis.opendocument.spreadsheet": "LibreOffice spreadsheet (.ods)",
  "application/vnd.oasis.opendocument.presentation": "LibreOffice presentation (.odp)",
  "application/vnd.oasis.opendocument.graphics": "LibreOffice drawing (.odg)",
  "application/vnd.apple.pages": "Apple Pages document",
  "application/vnd.apple.numbers": "Apple Numbers spreadsheet",
  "application/vnd.apple.keynote": "Apple Keynote presentation",
  "message/rfc822": "Saved e-mail (.eml)",
  "application/vnd.ms-outlook": "Saved Outlook e-mail (.msg)",
  "application/vnd.ms-xpsdocument": "Printable document (.xps)",
  "application/oxps": "Printable document (.oxps)",
  "image/tiff": "Scanned picture (.tiff)",
  "image/bmp": "Picture (.bmp)",
  "image/avif": "Picture (.avif)",
  "audio/aac": "Audio (.aac)",
  "audio/ogg": "Audio (.ogg)",
  "audio/flac": "Music (.flac)",
  "video/webm": "Video (.webm)",
  "video/x-msvideo": "Video (.avi)",
  "video/x-matroska": "Video (.mkv)",
  "application/x-ofx": "Bank download (.ofx)",
  "application/vnd.intu.qfx": "Quicken bank download (.qfx)",
  "application/vnd.intu.qbo": "QuickBooks bank download (.qbo)",
  "application/qif": "Bank download (.qif)",
  "application/x-gedcom": "Family tree file (.ged)",
  "application/dicom": "Medical image (.dcm)",
  "model/stl": "3D model (.stl)",
  "model/3mf": "3D print file (.3mf)",
  "font/ttf": "Font (.ttf)",
  "font/otf": "Font (.otf)",
  "application/json": "Data file (.json)",
  "application/xml": "Data file (.xml)",
  "application/octet-stream": "Unknown kind of file"
};

// Types that can run code on the computer. Scammers ask victims to download these.
const RISKY_MIME = new Set([
  "application/x-msdownload", "application/x-msdos-program", "application/vnd.microsoft.portable-executable",
  "application/x-msi", "application/x-ms-installer", "application/x-apple-diskimage",
  "application/vnd.apple.installer+xml", "application/vnd.android.package-archive", "application/x-sh",
  "application/x-shellscript", "application/x-bat", "application/x-powershell", "application/hta",
  "application/x-java-archive", "application/java-archive", "application/x-ms-shortcut",
  "application/x-executable", "application/x-elf", "application/x-mach-binary",
  "application/x-dosexec", "application/msix", "application/appx", "application/x-debian-package",
  "application/x-vbscript", "application/javascript", "application/x-bash", "application/x-csh",
  "application/x-python", "application/x-perl", "application/x-ruby", "application/x-php",
  "application/x-iso9660-image", "application/x-vhd"
]);

/**
 * Describe a MIME type for people.
 * level: "unknown" (no type / octet-stream: allowing it would let almost anything
 * through), "program" (can run code), or "ordinary".
 */
export function describeMime(mime) {
  const m = (mime || "").toLowerCase();
  if (!m || m === "unknown" || m === "application/octet-stream") {
    return { name: "Unknown kind of file", level: "unknown" };
  }
  if (RISKY_MIME.has(m) || /macroenabled/i.test(m)) {
    return { name: MIME_NAMES[m] || (/macroenabled/i.test(m) ? "Office file with macros" : "Program"), level: "program" };
  }
  if (MIME_NAMES[m]) return { name: MIME_NAMES[m], level: "ordinary" };
  const [top] = m.split("/");
  const generic = { image: "Picture", audio: "Audio file", video: "Video", text: "Text file", font: "Font" }[top];
  return { name: generic || "File", level: "ordinary" };
}

// ---------------------------------------------------------------------------
// Generic types and file extensions (v2.4)
// Many sites send programs and other files as "application/octet-stream" (or no
// type at all). For those, the file is judged by its extension instead.
// ---------------------------------------------------------------------------
export const OCTET = "application/octet-stream";

// Types that say nothing about what the file is.
const GENERIC_MIME = new Set([
  "", "unknown", OCTET, "binary/octet-stream", "application/binary", "application/unknown",
  "application/x-unknown", "application/download", "application/x-download",
  "application/force-download", "application/x-force-download", "application/x-octet-stream"
]);

export function isGenericMime(mime) {
  return GENERIC_MIME.has(String(mime || "").split(";")[0].trim().toLowerCase());
}

// Extension -> the real types servers use for it. The first entry is the usual
// one (used for the friendly name). Includes every type in the bundled groups.
const EXT_MIME = {
  // documents
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  docm: ["application/vnd.ms-word.document.macroEnabled.12"],
  dotm: ["application/vnd.ms-word.template.macroEnabled.12"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  xlsm: ["application/vnd.ms-excel.sheet.macroEnabled.12"],
  xlsb: ["application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
  xltm: ["application/vnd.ms-excel.template.macroEnabled.12"],
  xlam: ["application/vnd.ms-excel.addin.macroEnabled.12"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  pptm: ["application/vnd.ms-powerpoint.presentation.macroEnabled.12"],
  ppsm: ["application/vnd.ms-powerpoint.slideshow.macroEnabled.12"],
  potm: ["application/vnd.ms-powerpoint.template.macroEnabled.12"],
  ppam: ["application/vnd.ms-powerpoint.addin.macroEnabled.12"],
  mpp: ["application/vnd.ms-project"],
  wri: ["application/x-mswrite"],
  odt: ["application/vnd.oasis.opendocument.text"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  odp: ["application/vnd.oasis.opendocument.presentation"],
  odg: ["application/vnd.oasis.opendocument.graphics"],
  pages: ["application/vnd.apple.pages", "application/x-iwork-pages-sffpages"],
  numbers: ["application/vnd.apple.numbers", "application/x-iwork-numbers-sffnumbers"],
  key: ["application/vnd.apple.keynote", "application/x-iwork-keynote-sffkey"],
  rtf: ["application/rtf", "text/rtf"],
  txt: ["text/plain"],
  csv: ["text/csv"],
  tsv: ["text/tab-separated-values"],
  ics: ["text/calendar"],
  vcf: ["text/vcard", "text/x-vcard", "text/directory"],
  eml: ["message/rfc822"],
  msg: ["application/vnd.ms-outlook"],
  xps: ["application/vnd.ms-xpsdocument"],
  oxps: ["application/oxps"],
  epub: ["application/epub+zip"],
  mobi: ["application/x-mobipocket-ebook"],
  azw: ["application/vnd.amazon.ebook"],
  azw3: ["application/vnd.amazon.ebook"],
  fb2: ["application/x-fictionbook+xml"],
  djvu: ["image/vnd.djvu"],
  json: ["application/json"],
  xml: ["application/xml"],
  sql: ["application/sql", "application/x-sql"],
  // money, family history, medical
  ofx: ["application/x-ofx", "application/ofx"],
  qfx: ["application/vnd.intu.qfx", "application/x-qfx"],
  qbo: ["application/vnd.intu.qbo"],
  qif: ["application/qif", "application/x-qif"],
  ged: ["application/x-gedcom", "text/vnd.familysearch.gedcom"],
  dcm: ["application/dicom"],
  // pictures
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], jpe: ["image/jpeg"],
  png: ["image/png"], gif: ["image/gif"], webp: ["image/webp"], bmp: ["image/bmp"],
  tif: ["image/tiff"], tiff: ["image/tiff"],
  heic: ["image/heic", "image/heic-sequence"], heif: ["image/heif", "image/heif-sequence"],
  avif: ["image/avif"], jxl: ["image/jxl"], svg: ["image/svg+xml"],
  dng: ["image/x-adobe-dng"], cr2: ["image/x-canon-cr2"], cr3: ["image/x-canon-cr3"],
  nef: ["image/x-nikon-nef"], arw: ["image/x-sony-arw"],
  psd: ["image/vnd.adobe.photoshop", "application/x-photoshop"],
  ai: ["application/vnd.adobe.illustrator"], cdr: ["application/x-coreldraw"],
  kra: ["application/x-krita"], xcf: ["application/x-gimp"], sketch: ["application/x-sketch"],
  // audio and video
  mp3: ["audio/mpeg"], m4a: ["audio/mp4", "audio/x-m4a"], aac: ["audio/aac"],
  wav: ["audio/wav", "audio/x-wav"], flac: ["audio/flac"], ogg: ["audio/ogg"], oga: ["audio/ogg"],
  opus: ["audio/opus"], weba: ["audio/webm"], aif: ["audio/x-aiff"], aiff: ["audio/x-aiff"],
  m3u: ["audio/x-mpegurl"], ra: ["audio/vnd.rn-realaudio"],
  mp4: ["video/mp4"], m4v: ["video/mp4"], mov: ["video/quicktime"], webm: ["video/webm"],
  avi: ["video/x-msvideo"], mkv: ["video/x-matroska"], mpg: ["video/mpeg"], mpeg: ["video/mpeg"],
  "3gp": ["video/3gpp"], ogv: ["video/ogg"], wmv: ["video/x-ms-wmv"], flv: ["video/x-flv"],
  // 3D, fonts
  stl: ["model/stl", "application/sla"],
  "3mf": ["model/3mf", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"],
  obj: ["model/obj"], step: ["model/step", "application/step"], stp: ["model/step", "application/step"],
  dxf: ["image/vnd.dxf", "application/dxf"],
  ttf: ["font/ttf", "application/x-font-ttf"], otf: ["font/otf", "application/x-font-otf"],
  woff: ["font/woff", "application/font-woff"], woff2: ["font/woff2"],
  // compressed folders
  zip: ["application/zip", "application/x-zip-compressed"],
  "7z": ["application/x-7z-compressed"],
  rar: ["application/vnd.rar", "application/x-rar-compressed"],
  gz: ["application/gzip"], tgz: ["application/gzip"], tar: ["application/x-tar"],
  bz: ["application/x-bzip"], bz2: ["application/x-bzip2"],
  // databases
  mdb: ["application/x-msaccess", "application/msaccess"], accdb: ["application/x-msaccess", "application/msaccess"],
  dbf: ["application/x-dbf"], db: ["application/x-db"], sqlite: ["application/x-sqlite3"],
  // programs, installers and scripts
  exe: ["application/x-msdownload", "application/vnd.microsoft.portable-executable", "application/x-msdos-program", "application/x-dosexec", "application/x-executable"],
  com: ["application/x-msdownload", "application/x-msdos-program"],
  scr: ["application/x-msdownload"],
  dll: ["application/x-msdownload"],
  msi: ["application/x-msi", "application/x-ms-installer", "application/x-msdownload"],
  msix: ["application/msix"], appx: ["application/appx"],
  dmg: ["application/x-apple-diskimage"],
  pkg: ["application/vnd.apple.installer+xml"],
  apk: ["application/vnd.android.package-archive"],
  deb: ["application/x-debian-package"],
  jar: ["application/java-archive", "application/x-java-archive"],
  bat: ["application/x-bat"], cmd: ["application/x-bat"],
  ps1: ["application/x-powershell"],
  vbs: ["application/x-vbscript"], js: ["application/javascript"], hta: ["application/hta"],
  lnk: ["application/x-ms-shortcut"],
  sh: ["application/x-sh", "application/x-shellscript"], bash: ["application/x-bash", "application/x-sh"],
  csh: ["application/x-csh"], py: ["application/x-python"], pl: ["application/x-perl"],
  rb: ["application/x-ruby"], php: ["application/x-php"],
  iso: ["application/x-iso9660-image"], vhd: ["application/x-vhd"], vmdk: ["application/x-vmdk"],
  qcow2: ["application/x-qcow"]
};

// Extensions that run code, even if a type for them isn't in RISKY_MIME.
const RISKY_EXT = new Set([
  "exe", "com", "scr", "dll", "msi", "msix", "appx", "dmg", "pkg", "apk", "deb", "jar", "bat", "cmd",
  "ps1", "vbs", "js", "hta", "lnk", "sh", "bash", "csh", "py", "pl", "rb", "php", "iso", "vhd",
  "docm", "dotm", "xlsm", "xlsb", "xltm", "xlam", "pptm", "ppsm", "potm", "ppam"
]);

/**
 * The extension of the name the file will be saved under, lowercase, or "".
 * Trailing dots and spaces are ignored because Windows drops them when saving
 * ("Support.exe." is saved as "Support.exe").
 */
export function fileExtension(name) {
  const base = String(name || "").split(/[\\/]/).pop().replace(/[.\s]+$/, "");
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  const ext = base.slice(i + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export function typesForExtension(ext) {
  return EXT_MIME[ext] ? [...EXT_MIME[ext]] : [];
}

/**
 * What a stopped download should ask for.
 *  basis "type":      the site sent a real type; ask for that type.
 *  basis "extension": the site sent a generic type; ask for the real types of the
 *                     file's extension (never octet-stream).
 *  basis "unknown":   generic type and an extension we can't place (or none);
 *                     the only option left is octet-stream.
 */
export function mimeRequestFor(mime, filename) {
  const m = normalizeMime(mime || "") || "";
  const ext = fileExtension(filename);
  if (m && !isGenericMime(m)) return { basis: "type", ext, mimes: [m] };
  const types = typesForExtension(ext);
  if (types.length) return { basis: "extension", ext, mimes: types };
  return { basis: "unknown", ext, mimes: [OCTET] };
}

/**
 * The download filter's decision. Real types are checked as sent. Generic types
 * are allowed if octet-stream itself is allowed, or if any real type of the file's
 * extension is allowed.
 */
export function downloadAllowed(mime, filename, allowed) {
  const set = allowed instanceof Set ? allowed : new Set(allowed || []);
  const m = normalizeMime(mime || "") || "";
  if (m && !isGenericMime(m)) return set.has(m);
  if (set.has(OCTET)) return true;
  return typesForExtension(fileExtension(filename)).some(t => set.has(t));
}

/** Friendly description of a request (one or several types). */
export function describeRequest(mimes, ext = "") {
  const list = (mimes || []).filter(Boolean);
  if (list.includes(OCTET) || !list.length) return { name: "Unknown files (any kind)", level: "unknown" };
  const first = describeMime(list[0]);
  const program = list.some(t => describeMime(t).level === "program") || RISKY_EXT.has(ext);
  let name = first.name;
  if (ext && !name.includes(`.${ext}`)) name = `${name} (.${ext})`;
  return { name, level: program ? "program" : "ordinary" };
}
