# Changelog

## 2.3.0

### A "Download stopped" page, and requests to allow a file type

Before, a stopped download only showed a small notification. The person had no way to ask for that kind of file, and the technical file type was only visible to the helper. Version 2.3 handles downloads the same way the block page handles websites.

**What the person sees.** When a download is stopped, a **Download stopped** page opens in a tab and shows:
- **File:** the file name.
- **Kind of file:** in plain words, for example "LibreOffice document (.odt)" or "Windows program (.exe)".
- **File type to allow:** the exact MIME type, for example `application/vnd.oasis.opendocument.text`, so the helper knows precisely what is being asked for.
- **From:** the website it came from.
- The helper's name and phone number.
- **Ask [helper] to allow this kind of file**, and **Go back**, which returns to the page the download came from.

After the person asks, the page says to leave it open. Once the helper approves, it switches to **This kind of file is now allowed**, with a **Download again** button. That button re-downloads the original address, and the download goes through the normal file-type check, so it only succeeds if the type really is allowed. If the original address can't be fetched again (files a page generates itself), the page says to go back and click the download again. Opening the page later shows *Waiting for [helper] to approve* if a request is already pending.

**Special cases on the page:**
- **Programs** (`.exe`, `.msi`, `.dmg`, `.apk`, scripts, Java, shortcuts, Office files with macros) show a red warning: if someone on the phone, in an e-mail or in a pop-up said to download it, it is a scam. They can still be requested; the helper decides.
- **No usable type.** If the website sent no type, or `application/octet-stream` ("unknown kind of file"), there is no request button. Allowing it would let almost anything through, programs included, so the page tells the person to ask the helper to download the file for them.

**Only one tab.** All stopped downloads reuse a single "Download stopped" tab, so a site that starts many downloads can't flood the browser. If that tab was closed, a new one opens.

**Notifications.** The notification still appears, and clicking it reopens the page. Some browsers (several Android browsers among them) don't support extension notifications; the page works without them, and the notification call can no longer break the rest of the handling.

**What the helper sees.** The popup's **Downloads** tab has a new **Requests to allow a file type** card, the same as website requests under **Websites**:
- a red badge on the Downloads tab shows how many are waiting, and the popup opens on that tab when there are file requests and no website requests;
- each request shows the kind of file, the exact type, the file name and the site it came from, with **Allow** and **Dismiss**;
- **programs** are labeled **PROGRAM**, show a warning line, and need a second click ("Allow programs?") so they are never allowed by accident;
- the card reminds the helper that allowing a type lets *every* file of that kind download from any allowed website.

Approving adds the type to the "added here" file types, exactly as if it had been typed in. Requests, approvals and dismissals are recorded in **Activity → Changes**, exported in CSV/JSON, and forwarded to a log collector if that is on. Up to 50 requests are kept, one per file type.

The **Scam words** section has no request feature, as requested.

### Security notes

- **The page can't be opened by websites.** The new page is not web-accessible, unlike the website block page, so websites can't open or frame it. Its messages (`requestMime`, `checkMime`, `retryDownload`) are only accepted from a top-level copy of it, and approving is only possible from the popup or settings page.
- **Re-downloads are checked like any other.** Previously every download started by the extension skipped the file-type check, which was meant for log exports. Now only the extension's own `data:` exports skip it, so **Download again** can never bypass the filter.
- **Only `http(s)` addresses are re-downloaded.**

### Other

- **Friendly names** for about 80 common file types (`describeMime` in `lib.js`), used on the page and in the popup.

### Publishing notes

- **Permissions:** no new ones. The page uses tabs the extension opens itself, and `chrome.storage.session` to remember which tab to reuse. Existing users are not prompted.
- **GitHub Pages:** no changes.
- **Store package:** must now include `downloadblocked.html` and `downloadblocked.js` (the zip command in `STORE-SUBMISSION.md` is updated).
- **Store review:** code change, so leave "skip review" unchecked.

### Files

| File | Change |
|---|---|
| `downloadblocked.html`, `downloadblocked.js` | **New:** the Download stopped page |
| `background.js` | Opens/reuses the page; file-type request queue; `requestMime`, `checkMime`, `retryDownload`, `approveMimeRequest`, `dismissMimeRequest`; notification click; safe without notification support; export bypass limited to `data:` |
| `popup.html`, `popup.js`, `popup.css` | Requests card and badge on the Downloads tab; Changes log entries |
| `lib.js` | `describeMime` (friendly names and risk level); request cap |
| `ui.css` | File details box |
| `manifest.json` | 2.3.0 |
| `README.md` | Synced with your published copy |
| `tests/background.test.mjs` | 23 new checks (104 total) |

## 2.2.0

### Clickable page address on the block page

Before, the blocked address was hidden behind a collapsed "Page address" section and was plain text, so after a site was approved the person had to retype it, and typos sent them to the wrong (possibly scam) site.

- **The address is now always visible and clickable** for ordinary blocked sites, with a hint: "Once this site has been allowed, click the address to open it. There's no need to type it." The link opens in the same tab, with no referrer.
- **The page updates itself when the site is approved.** The person usually leaves the block page open while the helper approves the request in the popup. As soon as the new rules are in force, the page changes to **This site is now allowed**, with an **Open the page ➜** button (focused, so Enter works) that goes to the exact original address, including any `?query` and `#section`. The request button and helper box are hidden at that point.
  - It also checks when the page loads, so a block page reopened from history after approval shows the Open button straight away.
  - After pressing **Ask to allow**, the status now says to leave the page open.
- **Dangerous sites (always-block list) stay plain text.** They can never be allowed, so there is nothing to click through to, and a clickable remote-control link is exactly what a scammer would want.
- **Only real web addresses are ever linked.** The block page can be opened by any website with any text after `#`, so anything other than `http:`/`https:` is shown as text and never becomes a link: `javascript:`, `data:`, `file:` and `chrome:` included. Addresses from v1's old `?url=` form are still linked.

How the live update works: the block page asks the background (`checkSite`) whether its address is now allowed, on load and whenever `rulesStatus` changes. That value is written right after the browser's blocking rules are updated, so the page never shows **Open** before the site will actually load. Like the other block-page messages, `checkSite` is only accepted from a top-level block page, not from an iframe or a website. It reports a site as allowed only if it is on the allowlist (or allowlisting is off) **and** not on the always-block list.

### Publishing notes

- **No permission or manifest changes** other than the version number. Existing users are not prompted.
- **No GitHub Pages changes.** The lists are unchanged.
- **Store review:** this is a code change, so leave "only changes to safe static rules / skip review" unchecked. It goes through normal review, with no new permissions to justify.

### Files

| File | Change |
|---|---|
| `blockpage.html` | Visible address box with link, hint, and hidden **Open the page** button |
| `blockpage.js` | Link only for `http(s)` addresses on ordinary blocks; live "now allowed" update |
| `background.js` | New `checkSite` message (block page only) |
| `ui.css` | Address box, link and "allowed" styles |
| `manifest.json` | 2.2.0 |
| `tests/background.test.mjs` | 6 new checks for `checkSite` (81 total) |

## 2.1.0: before you publish (2.0.0 + 2.1.0)

Version 2.0.0 was never published on its own, so these steps cover both releases.

### 1. Update the Tsora-Pop.github.io repo

The extension's default lists and file-type groups are served from GitHub Pages. The `github-pages-update.zip` delivered with this release contains these files already laid out in the right folders, so you can drop it into the root of that repo.

| Copy this file from this repo | To this path in `Tsora-Pop.github.io` | Status |
|---|---|---|
| `lists/semantic/scamTermDefault.txt` | `lists/semantics/scamTermDefault.txt` (note: `semantics`, plural) | Replaces the old list |
| `lists/domain/denyDefault.txt` | `lists/domain/denyDefault.txt` | New |
| `lists/mime/*.txt` (16 new files, listed under 2.1.0) | `lists/mime/` | New |

Until these are online, nothing breaks:
- The always-block list uses the copy bundled inside the extension, labeled "built-in copy" in the settings page.
- File-type groups are always read from the bundled copies, so they work regardless.
- **Exception:** the scam phrase URL already exists online with the **old** list. Users get the old phrases until you replace that file.

### 2. Chrome Web Store dashboard

`STORE-SUBMISSION.md` has text ready to paste:
- the single-purpose statement;
- a justification for each permission;
- the data-use answers. These changed: the extension can now send activity events **if the user (or their organization) turns on log forwarding**. It is off by default and goes only to the address they enter.

Also update the privacy policy link: `Privacy-Policy.md` has been revised for this release.

### 3. Permissions

Compared with 1.x:
- **Added:** `alarms` (no install warning).
- **Removed:** `scripting`, `declarativeNetRequestWithHostAccess`.
- **No new host permissions.** The extension already had `<all_urls>`, which also covers log forwarding.
- **New in the manifest, not a permission:** `storage.managed_schema`, which lets organizations configure the extension by policy. It adds no install warning.

Existing users are not prompted to approve anything, and the extension is not disabled on update.

### 4. Package

The store package must contain only the extension files. Leave out `tests/`, `.git`, and the Markdown docs. `STORE-SUBMISSION.md` has the one-line command; the prebuilt `Grandmas-Guardian-v2.1.0-store.zip` was made the same way.

---

## 2.1.0

### Restore default lists

Each section (Websites, Always block, Downloads, Scam words) now detects when its default online list has been removed or switched off:
- the "Online lists" panel opens automatically;
- it says which default is missing;
- a **↺ Restore default list** button puts back only that section's default, with its original address, and switches it on.

Default lists are labeled **default** in the list. Removing one now asks "Remove default?" on the confirming click. Settings → **Restore default lists** still restores all four at once. Restores are recorded in the Changes log.

### More file-type groups

The Downloads tab menu is now grouped into **Everyday**, **Office**, **Home and hobbies**, and **Risky: only if needed**. New groups (all files are in `lists/mime/`):

| File | Menu name | Types |
|---|---|---|
| `lists/mime/mimeText.txt` | Plain text, CSV and rich text | `text/plain`, `text/csv`, `text/tab-separated-values`, `application/rtf`, `text/rtf` |
| `lists/mime/mimePhonePhotos.txt` | Phone and camera photos | `image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`, `image/avif`, `image/jxl`, camera RAW (`image/x-adobe-dng`, `image/x-canon-cr2`, `image/x-canon-cr3`, `image/x-nikon-nef`, `image/x-sony-arw`) |
| `lists/mime/mimeCalendarContacts.txt` | Calendar invites and contact cards | `text/calendar`, `text/vcard`, `text/x-vcard`, `text/directory` |
| `lists/mime/mimeEbooks.txt` | E-books | `application/epub+zip`, `application/x-mobipocket-ebook`, `application/vnd.amazon.ebook`, `application/x-fictionbook+xml`, `image/vnd.djvu` |
| `lists/mime/mimeMusic.txt` | Music and audio | `audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/aac`, `audio/ogg`, `audio/opus`, `audio/wav`, `audio/x-wav`, `audio/flac`, `audio/webm` |
| `lists/mime/mimeVideo.txt` | Video | `video/mp4`, `video/quicktime`, `video/webm`, `video/x-msvideo`, `video/x-matroska`, `video/mpeg`, `video/3gpp` |
| `lists/mime/mimePrintScan.txt` | Printing and scanning | `application/vnd.ms-xpsdocument`, `application/oxps`, `image/tiff` |
| `lists/mime/mimeOpenDocument.txt` | LibreOffice / OpenOffice | `application/vnd.oasis.opendocument.text`, `.spreadsheet`, `.presentation`, `.graphics` |
| `lists/mime/mimeAppleIWork.txt` | Apple Pages, Numbers, Keynote | `application/vnd.apple.pages`, `application/vnd.apple.numbers`, `application/vnd.apple.keynote`, and the older `application/x-iwork-*` types |
| `lists/mime/mimeEmail.txt` | Saved e-mails | `message/rfc822`, `application/vnd.ms-outlook` |
| `lists/mime/mimeBankingTax.txt` | Bank and tax downloads | `application/x-ofx`, `application/ofx`, `application/vnd.intu.qfx`, `application/x-qfx`, `application/vnd.intu.qbo`, `application/qif`, `application/x-qif` |
| `lists/mime/mimeGenealogy.txt` | Family history | `text/vnd.familysearch.gedcom`, `application/x-gedcom` |
| `lists/mime/mimeMedical.txt` | Medical images from patient portals | `application/dicom` |
| `lists/mime/mimeCad3D.txt` | 3D printing and CAD | `model/stl`, `application/sla`, `model/3mf`, `application/vnd.ms-package.3dmanufacturing-3dmodel+xml`, `model/obj`, `model/step`, `application/step`, `image/vnd.dxf`, `application/dxf` |
| `lists/mime/mimeFonts.txt` | Fonts | `font/ttf`, `font/otf`, `font/woff`, `font/woff2`, `application/x-font-ttf`, `application/x-font-otf`, `application/font-woff` |
| `lists/mime/mimeArchives.txt` | Compressed folders (**risky**) | `application/zip`, `application/x-zip-compressed`, `application/x-7z-compressed`, `application/x-rar-compressed`, `application/vnd.rar`, `application/gzip`, `application/x-tar` |

The existing groups (Default, Legacy Office, Audio/Video, Artist, Database, Office macro, Developer, Sysadmin) are unchanged. Macro, Developer and Sysadmin moved under **Risky** because they allow programs or macros.

**Tip for helpers:** never add `application/octet-stream`. Many servers send it for every kind of file, including programs, so adding it effectively turns the file-type filter off.

### Catching disguised scam wording

The filter now undoes the usual tricks used to get past word filters before matching. Each was tested against real pages in Chromium:

| Trick | Example | Handled by |
|---|---|---|
| Spaced or dotted letters | `b u y  g i f t  c a r d s`, `G.I.F.T` | Runs of single letters are joined |
| Joined or hyphenated words | `giftcards`, `gift-cards` | Spaces in phrases match zero or more spaces, hyphens, `_`, `*`, `·` |
| Numbers/symbols for letters | `g1ft c4rds`, `$end B1tc0in` | Second check with 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, 9→g, @→a, $→s, !→i, \|→i, +→t |
| Look-alike letters | `Саll Місrоsоft` (Cyrillic С, М, і, о, р) | Cyrillic and Greek look-alikes mapped to Latin |
| Fancy Unicode letters | `𝐒𝐞𝐧𝐝 𝐁𝐢𝐭𝐜𝐨𝐢𝐧`, fullwidth `ｓｅｎｄ` | Unicode NFKD normalization |
| Accents and "Zalgo" marks | `sénd bítcóin` | Combining marks removed |
| Invisible characters | zero-width space, soft hyphen, direction marks | Removed |
| Phrase split across tags | `gi<span>ft</span> <b>c</b>ards`, one `<span>` per letter | The joined text of the surrounding element is checked too (up to 600 characters) |
| Hidden junk letters | `bit<span style="display:none">zz</span>coin` | When an element contains hidden children, its *visible* text is checked |

Every phrase in the list benefits from these, so the list doesn't need to spell out variants.

**Performance:** phrases are compiled into a single prefix tree, so the browser checks each position once, not once per phrase. With the larger list and all of the checks above, 20,000 inserted paragraphs scanned in about 0.46 s, and 5,000 formatted, accented paragraphs in about 0.34 s.

**What it still can't catch:**
- text inside images;
- text drawn by CSS (`::before` content);
- text that's reordered visually with CSS.

### Scam phrase list: 280 → 370 phrases

New sections:
- **Gift-card wording that rotates:** "pay with google play/itunes/steam/razer gold/vanilla visa", "send me the claim code", "if the cashier asks", "tell the cashier it's a gift".
- **Crypto ATM / QR payments:** "insert the cash into the machine", "scan the qr code at the machine", "this is a government wallet".
- **Bank coaching:** "if the bank asks why", "say it's for home repairs", "your funds are not safe", "fdic safe account".
- **Company and agency impersonation:** Amazon, Apple ID and iCloud lockouts, "your windows license has expired", "micro soft support", FTC/SSA/US Marshals impersonation, "you are under federal investigation".
- **Sextortion e-mails**, **task / "job" scams**, **family emergency follow-ups** (including the lawyer/courier calls that follow AI voice-clone calls), **toll/DMV/ticket texts**, and **prize variants**.

Deliberately not added, because they'd also hide news articles or legitimate businesses: "bitcoin atm", "bitcoin machine", "crypto kiosk", "ftc agent", "fbi cyber division", and bare "drug trafficking/money laundering investigation". They are replaced by first-person scam wording such as "your name is linked to drug trafficking".

### Logging scam text, and whether it was shown anyway

The content script now reports to the background:
- **Hidden text:** the phrase, the page address, and the first 200 characters of the hidden text. Sent in batches; one entry per page and phrase per minute.
- **Show anyway:** the same details, logged as "Shown anyway". Only a real click counts; scripted clicks are ignored, and page scripts can't reach the button at all because it sits inside a closed shadow root.

These appear in a new **Scam text** section of the Activity tab (newest 500 kept).

A new **Changes** section records:
- protections switched on or off;
- entries added, removed or cleared, with up to 20 values;
- online lists added, removed, enabled, disabled or restored;
- requests to allow a site;
- approvals and dismissals, and whether they came from the settings page or the helper's phone;
- attempts to switch off a protection that policy keeps on.

Newest 300 kept.

A new **Who uses this computer** setting (Settings tab and setup step 1, optional) labels exports and forwarded events, so a helper looking after several people can tell the logs apart.

### Collecting the logs

| Situation | How |
|---|---|
| One person, you check now and then | Activity tab → **Export CSV** or **Export JSON**. The file is saved straight to Downloads (`grandmas-guardian-<person>-<date>.csv`) and merges all four logs, sorted by time. CSV cells that start with `=`, `+`, `-` or `@` are prefixed with `'` so a malicious URL or file name can't run as a spreadsheet formula. Exports are the extension's own downloads, so the file-type filter lets them through. |
| A family or small client base | Log forwarding to a collector you run (for example a Graylog or Fluent Bit HTTP input, or n8n). |
| Organization | Log forwarding to your SIEM, configured centrally by policy (below). |

**Log forwarding** (Settings → Send logs to a collector):
- Every event (blocked sites, stopped downloads, scam text hidden or shown, changes, requests, approvals) is posted to an HTTPS endpoint.
- Optional `Authorization` header.
- Three formats:
  - **JSON array**, for generic webhooks, Azure Logic Apps, n8n;
  - **NDJSON**, for Logstash and Fluent Bit HTTP inputs;
  - **Splunk HEC**, with `sourcetype` `grandmas_guardian:event` and `host` set to the person name or install ID.
- Each event carries `id`, `time`, `type`, `product`, `version`, `person`, and a random per-install `installId`.
- Delivery: events are queued (up to 2,000) and sent within about 5 seconds, then every 5 minutes as a retry. A failed delivery keeps the events; the status line shows how many are waiting.
- Plain `http://` collectors are refused.
- **Send test event** checks the connection.

**Central configuration by policy** (`managed_schema.json`, read through `chrome.storage.managed`):
- An administrator can set any of these by Group Policy, a macOS profile, or a Linux policy file:
  - person name;
  - helper name and phone;
  - every forwarding setting;
  - extra online lists;
  - `forceProtectionsOn`.
- Settings set by policy are shown locked (🔒) in the popup.
- Policy lists can't be removed or switched off, and they disappear again when the policy is removed.
- With `forceProtectionsOn`:
  - the four protection switches are locked on;
  - any attempt to switch one off is reversed and logged;
  - the setup guide is skipped on install.
- The README has the registry, plist and JSON locations, with a complete example.

### Store readiness (Manifest V3)

- **Manifest V3 throughout:**
  - module service worker;
  - `declarativeNetRequest` dynamic rules;
  - `downloads.onDeterminingFilename`;
  - `alarms` for every scheduled job (list refresh, log retry);
  - no `setInterval` in the service worker;
  - no `webRequest`, `scripting`, `eval`, `new Function`, or remotely loaded code. Lists are data and are never run.
- **Default content security policy;** there are no inline scripts in any extension page.
- **Nothing development-only:** no `key` field, `update_url`, or localhost access in the manifest, and the docs contain no developer-mode instructions.
- **Store package excludes** `tests/` and the docs.
- **New `STORE-SUBMISSION.md`** with paste-ready dashboard text.
- **Privacy policy** updated for the opt-in log forwarding feature.

### Fixes found while testing

- **Policy changes could hang the background.** A policy change could make it wait on itself, freezing settings reads until the browser restarted. Fixed before release; caught by the new test.
- **Shadow roots attached late were missed.** Shadow roots attached after an element was already on the page were not scanned. They're now picked up once the page finishes loading.

### Files

| File | Change |
|---|---|
| `background.js` | Event pipeline, log forwarding, managed policy, per-section restore |
| `content.js` | De-obfuscation, prefix-tree matcher, joined-text checks, logging of hidden/revealed text |
| `popup.html` / `popup.js` / `popup.css` | Restore buttons, grouped file types, Scam text and Changes logs, export, forwarding settings, policy locks |
| `lib.js` | New settings, grouped MIME presets, `effectiveSettings`, `randomToken` |
| `manifest.json` | 2.1.0, `storage.managed_schema` |
| `managed_schema.json`, `STORE-SUBMISSION.md` | New |
| `lists/mime/*.txt` (16 files) | New |
| `lists/semantic/scamTermDefault.txt` | 90 phrases added |
| `tests/background.test.mjs` | 75 checks (was 50) |
| `README.md`, `Privacy-Policy.md` | Updated |

## 2.0.0

_Not published on its own; ships as part of 2.1.0._

A security and usability release. Existing installs upgrade in place: allowlists, file types, scam terms and on/off switches are kept.


### Security fixes

**Allowlist bypass through the URL (critical).** v1 matched allowed sites with `urlFilter: "*://google.com/*"`. A `urlFilter` without anchors matches anywhere in the URL, so `https://scam.example/?r=https://google.com/` matched the allow rule and loaded. The allowlist now uses `requestDomains`, which only matches the real host name and its subdomains. (`background.js` → `buildRules`)

**Allowlists over 500 entries stopped updating.** v1 gave rule `i` the IDs `1000 + 2i` and `1000 + 2i + 1`. Entry 500 collided with the first remote-access block rule (ID 2000), and entry ~4,500 collided with the catch-all (ID 9999). Duplicate IDs make Chrome reject the whole update silently. All allowed domains now go into a few `requestDomains` rules of 2,000 domains each, with IDs numbered from 1. Tested with 12,000 entries. Old rules are removed by reading their actual IDs (`getDynamicRules`) instead of deleting IDs 0–10,999 blindly.

**Rule update failures are now visible.** If Chrome rejects a rule update, the previous rules stay in force (updates are all-or-nothing) and the settings page shows a red notice with the error. Stored as `rulesStatus`.

**Private (Incognito) windows.** Chrome turns extensions off in Incognito unless "Allow in Incognito" is switched on, and an extension cannot switch it on itself. v2 detects it with `chrome.extension.isAllowedIncognitoAccess()`:
- the setup guide has a step that walks through turning it on, with a "Check again" button;
- the popup shows a yellow warning with a **Fix** button until it is on;
- the README has policy settings that disable Incognito entirely on managed computers.

**Block log could be flooded by any website.** `blockpage.html` must be web-accessible for the redirect to work, so any site could iframe it in a loop and each load added a log entry, with no size limit. The background now only accepts log entries from a top-level block page (`frameId === 0`), drops repeats of the same address within 10 seconds, and keeps the newest 500 entries.

**Remote lists could import a web page.** v1 did not check the HTTP status, so a 404 page or a Wi-Fi sign-in page was split into lines and merged into the lists (scam terms accepted any line over 2 characters, and the allowlist accepted anything). Downloads are now rejected when:
- the server answers with an error status;
- the response is HTML;
- fewer than half the lines are valid for that list type;
- the response is over 25 MB or takes more than 20 seconds.

On failure, the last good copy stays in use.

**Every entry is validated and normalized.** Domains typed as `https://www.bank.com/login`, `*.bank.com`, hosts-file lines (`0.0.0.0 bad.com`) or adblock lines (`||bad.com^`) are converted to a bare host. Internationalized domains are converted to punycode, and invalid entries are dropped. v1 stored `https://...` as-is, which produced a rule that never matched. MIME types drop parameters (`application/pdf; charset=binary` → `application/pdf`).

**Updates no longer reset the caregiver's switches.** `onInstalled` ran on every extension and Chrome update and set all three toggles back to on. Defaults are now only written when a setting doesn't exist yet.

**Concurrent writes no longer lose entries.** Logs, requests, subscriptions and manual lists are updated through one serialized queue in the background. Previously, two blocks at the same moment could overwrite each other's log entry.

**Blocked address shown in full.** The original URL now travels in the block page's `#fragment` instead of `?url=`, so `&` and `#` in it are no longer cut off. The old `?url=` form is still read.

**Unused permissions removed.** `scripting` was never called. `declarativeNetRequestWithHostAccess` was redundant alongside `declarativeNetRequest` plus `<all_urls>` host access.

### Bug fixes

**Download notifications never appeared.** `notifications.create` with type `basic` requires `iconUrl`, which v1 omitted, so every call failed silently. Fixed, and the message now names the file and, if set, the helper.

**Small downloads could finish before being cancelled.** v1 cancelled from `downloads.onCreated` after an async storage read, so a small file could complete first and stay on disk while being logged as blocked. v2 uses `downloads.onDeterminingFilename`, which holds the download until the extension answers. The rule itself is unchanged: allowed or blocked purely by the MIME type the server sends. A download with no type is blocked.

**Scam filter could blank the whole page.** Rewritten (`content.js`):
- v1 could walk up to `<body>` and replace it. v2 never hides `html`, `body` or `main`, and never hides a container with more than 2,500 characters of text. In that case it hides just the matching element, or wraps the matching text in a span and hides that.
- v1 scanned `<script>` and `<style>` text. Sites like Gmail and YouTube embed large JSON blobs in script tags, so a term inside them hid large parts of the page. v2 skips `script`, `style`, `noscript`, `template`, `textarea`, inputs, `code`, `pre`, SVG, and anything editable (email compose boxes, etc.).
- v1 replaced elements with copies of their HTML, which broke React/Angular pages and removed event handlers when revealed. v2 leaves the element in place: it adds a `data-gg-hidden` attribute (CSS `display:none !important`) and inserts a notice before it. **Show anyway** removes the attribute, so the original element comes back exactly as it was.
- The notice is drawn inside a closed shadow root, so page CSS can't restyle or hide it, and page scripts can't click it.

**Turning the scam filter off didn't work until reload.** v1 added a new `MutationObserver` on every settings change and never removed the old ones. v2 keeps one observer per root and disconnects it on disable. Turning the filter off now restores hidden text immediately, and changing the term list re-applies it immediately.

**Curly quotes and symbols.** Terms and pages are matched regardless of straight or curly apostrophes and quotes, dash style, or extra spaces and line breaks. Word boundaries also work for terms that start or end with a symbol (v1 used `\b`, which fails next to `$` or `!`).

**"Include Top 20 Sites" could add junk.** It added an empty entry for `chrome://` and `file://` pages, and could allowlist a site on the always-block list. Both are filtered now.

**The default scam list URL pointed at an old file.** `tsora-pop.github.io/scam-terms.txt` is an older list that includes generic phrases like "click here" and "act now". The default now points at `lists/semantics/scamTermDefault.txt` (see "Before you publish").

### Performance

- **One combined regular expression** instead of one regex per term. On the old code, about 100 separate tests ran per text node.
- **Only new content is scanned.** v1 rescanned the whole `<body>` on every DOM change, so busy sites rescanned constantly. v2 scans only added nodes and changed text. Measured: 20,000 inserted paragraphs scan in about 0.5 s including layout, and 2,000 small live text updates (clocks, counters) take about 10 ms in total.
- **`getComputedStyle` only runs for text that matches**, instead of for every ancestor of every text node.
- **The 5× retry loop (every 2 s) is removed.** The observer already catches late content.
- **Starts at `document_start`.** Text is handled in mutation callbacks, which run before the browser paints, so scam text no longer flashes on screen first. After loading, anything hidden while it was small and then grew into a large section is re-checked and narrowed down.
- **All frames and open shadow DOM** are scanned (`all_frames`, `match_about_blank`, plus shadow roots found during scanning and once after load).

### New features

**Always-block list** (the request to "exclude top scam domains"). This is a new list that works like the others: manual entries, `.txt` import, and online lists. It is enforced with priority 200, above the allowlist, so:
- it overrides the allowlist, including subdomains of allowed domains (for example `sites.google.com` while `google.com` is allowed);
- adding an always-blocked site to the allowlist is refused with a message (manual add, **Add most-visited**, and approved requests);
- it still applies when website allowlisting is turned off;
- it blocks the site in iframes as well as full pages.

It has its own on/off switch (`denyFilteringEnabled`). The two remote-desktop sites hard-coded in v1 still apply whenever website allowlisting is on, even if the always-block switch is off, as before.

The default list (`lists/domain/denyDefault.txt`) has three sections:
- remote-control tools: AnyDesk, TeamViewer, UltraViewer, ScreenConnect, LogMeIn123, RustDesk and others;
- user-published page hosts under trusted domains: `sites.google.com`, `script.google.com`, `forms.office.com`, `forms.microsoft.com`, `express.adobe.com`;
- free tunnels and dynamic DNS services.

`sharepoint.com` is included but commented out, as a judgment call for you.

**Online list subscriptions with automatic refresh.** Lists added by web address are now subscriptions:
- each is stored separately (`sub:<id>` in storage) and refreshed once a day with `chrome.alarms`, or on demand ("Update all lists now", or ↻ per list);
- a refresh replaces that list's entries instead of merging, so entries removed upstream go away;
- each list can be turned off or removed, and the settings page shows its entry count, last update, and any error;
- entries typed by hand (or imported from a file) are kept separately and never touched by a refresh;
- the default subscriptions have a bundled fallback copy inside the extension, so a new install works offline and before the GitHub Pages files exist.

**Block page.** Large type, the helper's name and phone number (as a tap-to-call link), and two buttons:
- **Go back** returns to the previous page, or closes the tab if there isn't one.
- **Ask [helper] to allow this site** saves a request. Requests appear at the top of the Websites tab with **Allow** and **Dismiss**, and as a red badge on that tab. Requests are limited to 50 and deduplicated.

For always-blocked sites, the page says the site is dangerous, shows a "hang up" warning, and has no request button.

**Local files.** Every list has an **Import .txt file** button, so lists can be fed from a file on the computer as well as from a web address. File-type groups bundled in `lists/mime/` (Office, audio/video, artist, database, developer, sysadmin) can be added from a menu. The two groups that include programs are labeled as such.

**First-install setup guide.** On a new install, the extension opens its settings page in a tab, in setup mode (`popup.html?setup=1`). Chrome doesn't allow an extension to open its popup without a click, so a tab is the standard way to do this. The guide has five steps:
1. Helper name and phone number.
2. The four protections, with plain-language descriptions and the status of the default lists.
3. **Add most-visited websites**, plus a box to add others.
4. Incognito check and instructions.
5. Tips (pin the shield, how requests work).

If setup is skipped, the popup shows a "Setup isn't finished" banner. Settings → **Run the setup guide again** reopens it. Upgraded v1 installs are marked as already set up.

**Popup redesign.**
- Status line ("✔ All protections are on" / "⚠ Turned off: …") and the helper's contact card.
- Alerts for: Incognito, setup, rule errors, failing lists, and "no websites allowed yet".
- Tabs: Websites, Downloads, Scam words, Activity, Settings.
- Every list has search, a count ("3 added here · 98 in use"), remove buttons, and its online lists.
- **Remove all** needs a second click within 4 seconds instead of a `confirm()` dialog, which doesn't work reliably in popups.
- ⤢ opens the same page in a full tab. It is also registered as the extension's Options page.
- Light and dark mode, keyboard focus outlines, and labeled controls for screen readers.

### Scam phrase list

`lists/semantic/scamTermDefault.txt` has been rewritten: 280 phrases in 11 groups, with comments explaining the rule for inclusion. Every phrase should be something a real company, bank or government office doesn't write to a customer. The groups are:
- tech support pop-ups;
- refund and overpayment;
- gift card, crypto, wire and courier payments;
- government and bank impersonation, including "safe account" and "don't tell the teller" coaching;
- secrecy and pressure;
- grandparent and "new number" scams;
- prizes and inheritance;
- romance;
- investment, crypto recovery and withdrawal-fee scams;
- delivery and toll texts;
- money-mule jobs and one-time-code phishing.

Removed from the old list because they hide legitimate pages:
- generic account and marketing wording: "Take Action", "Reset Password", "Security Alert", "Update Required", "Limited Time Offer", "Act Now", "Transaction Summary", "Invoice Attached", "Confirm Your Email", "KYC Verification", "AML Compliance", "Free Trial Ending";
- everyday conversational phrases: "Long Time No See", "I Miss You", "Remember Me?", "I'm Lonely", "I'm Divorced", "I'm A Trader".

### Storage keys (for reference)

| Key | Contents |
|---|---|
| `allowlist`, `denylist`, `allowedMimeTypes`, `scamTerms` | Entries added by hand or imported from a file |
| `subscriptions` | `[{id, kind, name, url, enabled, fallback, lastSync, lastError, count, source}]` |
| `sub:<id>` | Entries downloaded for one subscription |
| `effectiveScamTerms`, `effectiveMimeTypes`, `effectiveCounts` | Merged lists published by the background for the content script, download filter and UI |
| `filteringEnabled`, `domainFilteringEnabled`, `denyFilteringEnabled`, `mimeFilteringEnabled` | On/off switches |
| `helperName`, `helperPhone`, `setupComplete` | Setup |
| `blockedLog` (≤500), `blockedDownloads` (≤200), `pendingRequests` (≤50) | Activity |
| `rulesStatus` | Result of the last rule update |

### Files

| File | Change |
|---|---|
| `manifest.json` | v2.0.0; module service worker; `alarms` added; `scripting` and `declarativeNetRequestWithHostAccess` removed; options page; content script at `document_start` in all frames |
| `lib.js` | **New.** Shared defaults, normalizers and list parser |
| `background.js` | Rewritten |
| `content.js` | Rewritten |
| `popup.html` / `popup.js` / `popup.css` | Rewritten; includes the setup guide |
| `blockpage.html` / `blockpage.js` | Rewritten |
| `ui.css` | **New.** Shared styles |
| `lists/semantic/scamTermDefault.txt` | Rewritten |
| `lists/domain/denyDefault.txt` | **New** |
| `README.md`, `Privacy-Policy.md` | Updated |
