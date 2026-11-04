# Changelog

## 2.7.0: only allowed browser extensions

### Extension (Chrome, Edge and other Chromium browsers, and Firefox)

- **New: extension allowlisting** (Extensions tab), the same approach as websites:
  - **Allowed list and always-blocked list** of extension IDs. Entries can be added by hand, from a store address, by `.txt` import, or from online lists. A default always-blocked list (remote-control extensions) is in `lists/extension/denyDefault.txt`; publish it to `LIST_BASE/extension/denyDefault.txt`.
  - **Turning it on** needs the optional `management` permission (asked once, when the switch is clicked). Extensions already installed are kept and listed for review.
  - **Any other extension is turned off** when it's installed or switched on, including if it's switched back on by hand. A new page (`extensionblocked.html`) shows its name, source, version, ID and what it can do in plain words, with **Ask to allow**, **Remove it** and **Close**.
  - **Always-blocked extensions** stay off even when allowed; only a support team can make an exception.
  - **Requests and logs** carry the name, ID, version, description, source (Chrome Web Store, Edge Add-ons, Firefox Add-ons, unpacked, installed by another program, policy), permissions and websites, plus warnings for powerful permissions, every-site access, and installs from outside a store. They're logged locally (Activity → Extensions, CSV/JSON export), forwarded to the collector, and sent to the support team.
  - **Never touched:** Grandma's Guardian, themes, extensions installed by policy. Turning the feature off switches back on what it switched off.
  - **Firefox** can only switch add-ons off when Grandma's Guardian is installed by enterprise policy. Otherwise it detects, warns (once a day per add-on), logs and requests, and tells the person how to remove the add-on.
- New files: `extguard.js`, `extensionblocked.html`, `extensionblocked.js`, `lists/extension/`.
- Existing installs get the default always-blocked extensions list once (removing it sticks).

### Guardian Support server

- **Extension requests:** a new request kind with all the details above, shown as text. Permissions are listed in plain words, and powerful ones are marked. Approving a powerful extension needs a reason; approving an always-blocked one lifts that block (`extunblock`).
- **Approved list:** extensions show up there and can be pushed by ID or store address to every computer or chosen ones. They sync to computers as `extAllow` and `extUnblock`.
- New two-person option: "browser extensions with powerful permissions, or installed outside a store".
- The audit log records extension requests with their ID, version, source and permissions.
- Database migration 5 rebuilds the `requests` and `rules` tables to add the new kinds. Data is preserved and foreign keys are checked afterwards.
- Server tests: 40.

## 2.6.2: security review (OWASP)

The extension was reviewed against the OWASP Browser Extension Vulnerabilities Cheat Sheet and the server against the OWASP Web Service Security Cheat Sheet. Item-by-item results are in `SECURITY-REVIEW.md`.

### Extension (Chrome, Edge and other Chromium browsers, and Firefox)

- **Strict Content Security Policy** in both manifests. `frame-ancestors 'none'` stops websites from embedding the block page (checked in Chromium: before this, a site could frame it and trick clicks on "Ask to allow").
- **Online lists must use HTTPS** (plain HTTP only for `localhost`). Addresses with passwords, `file:` addresses, and redirects to non-HTTPS addresses are refused. Lists are read with a hard 25 MB limit instead of loading the whole reply first.
- **The collector's Authorization header moved out of `chrome.storage.local`** (readable by content scripts) into the extension's own IndexedDB (`secrets.js`, new file). Existing values move automatically. The settings page no longer shows it back: type a new value to replace it, or use **Remove the saved header**.
- **`topSites` is now optional,** asked for only when "Add most-visited websites" is clicked.
- **`externally_connectable` declared empty** (Chrome): no other extension or website can message it.
- The collector and support-server requests no longer follow redirects.
- The scam notice no longer uses `innerHTML`.

### Guardian Support server

- **Password re-confirmation for sensitive changes,** within 10 minutes of typing it:
  - payments (plan changes, cancelling, the payment portal);
  - where logs are forwarded;
  - adding people or changing roles;
  - security settings;
  - approving a password reset;
  - the owner's organization and plan changes.

  The console shows a password dialog when needed.
- **Encryption at rest** for two-step secrets and organization collector credentials. They use AES-256-GCM, are bound to their user or organization, and use a key file (`SECRETS_KEY_FILE`, created on first start) kept outside the database. Existing values are encrypted on start. Back up the key separately.
- **Client address behind a proxy:** the last `X-Forwarded-For` entry (the one the proxy added) is used, not the first (which the client can forge).
- **JSON only:** request bodies need `Content-Type: application/json` (415 otherwise) and must be objects.
- **Origin check:** over HTTPS, only `PUBLIC_URL` is accepted as Origin.
- Malformed `%`-escapes and cookies get a 400 instead of a server error.
- `Cross-Origin-Resource-Policy: same-origin`.
- **Limits:**
  - total connections (`MAX_CONNECTIONS`);
  - at most 8 live-update connections per person;
  - keep-alive timeout;
  - header count;
  - systemd resource limits in the README's service file.
- `OWNER_ALLOWED_IPS` optionally limits server-owner pages to known addresses.
- Database migration 4 (`sessions.auth_at`). Server tests: 38.

## 2.6.1

### Extension (Chrome, Edge and other Chromium browsers, and Firefox)

- **`localhost` can be allowed.** `localhost` and `127.0.0.1` (any port) can now be added to the allowed websites, so developers don't switch protection off to reach local sites. They still can't land on the always-block list (hosts-file lists contain `127.0.0.1 localhost`).
- **Browser account reported when connecting to a support team,** for per-browser licensing: the browser's name, computer or phone/tablet, and a random ID stored in the browser's synced extension storage (shared by the same browser account on all its computers). `platform.js` gains `browserIdentity()`. No new permissions (`storage` covers synced storage).

### Guardian Support server

- **Licenses are per browser account, not per computer.** The same browser signed in to the same account counts once on all its computers; another browser, or a phone or tablet, is another license. Extensions before 2.6.1 count one license each. The Computers page is now **Browsers**, shows licenses in use, and which browsers share a license. A new **"Another computer for a browser account that's already connected"** code adds a computer without using a license (only that account can use it).
- **The server owner picks the plan when creating an organization,** from the same plans and prices as sign-up. The admin pays under Billing on first sign-in. The owner can change the plan until it's paid.
- **Complimentary plans removed.** Existing ones move to the smallest plan that fits and need payment (logged). On a server without payments, organizations are active with their plan's licenses.
- Plan wording everywhere is "browser licenses". API: `price` objects have `licenses` instead of `computers`; `POST /api/orgs` takes `units`; `PUT /api/orgs/:org/plan` takes `units`.
- Owner-created organizations aren't removed when unpaid (only abandoned self-service sign-ups are).
- Server tests: 29.

## 2.6.0

### Firefox version

Grandma's Guardian now runs in **Firefox 140+** and **Firefox for Android 142+**, built from the same code as the Chrome version (`node tools/build.mjs` makes both store zips). The add-on ID is `grandmas-guardian@tsora-pop.github.io`. Differences, all handled in the new `platform.js`:

- **Downloads:** Firefox can't hold a download while it's checked (no `downloads.onDeterminingFilename`). Disallowed downloads are cancelled as soon as they start, the partial file is deleted (`downloads.removeFile`) and the entry erased. For a moment part of the file may exist on disk.
- **Data-sharing consent:** Firefox's required `data_collection_permissions` are declared as *none required*. The support team and log forwarding are optional and ask for Firefox's permission when turned on (browsing activity and personally identifying information; log forwarding also website content). Without that permission, nothing is sent.
- **Website access:** if the person turns off the add-on's website access in Firefox, the popup says **Website protection is OFF** with an **Allow** button.
- **Private windows:** add-ons can't open Firefox's add-ons page, so the popup and setup guide give the steps instead of a button.
- **Policy settings:** via Firefox `policies.json` `3rdparty.Extensions` (see README). Firefox for Android has no policy settings.
- **Log export:** uses a `blob:` link in Firefox.

### Chrome version

- Version 2.6.0. New file `platform.js` (in the store zip). No new permissions; behaviour in Chrome is unchanged.
- The "most visited" button tolerates browsers without `topSites`.

### Guardian Support server

- **Self-service sign-up with payments (Stripe).** New organizations sign up and pay $1/month for 10 computers; each extra $1 adds 20 (configurable). Debit/credit cards, Google Pay and Apple Pay through Stripe Checkout; card details never reach the server. When a plan is full, adding a computer offers the next plan with one-click upgrade. Admins can change the plan, **cancel future payments** (and undo), and open Stripe's billing portal. Local test mode: `PAYMENTS=dev`. Without payment settings, the owner creates **complimentary** organizations with a computer limit, as before.
- **Forgot password,** approved by people: the request goes to the organization's admins (or the other admin), or to the server owner when no admin can help or the person asks. The approver checks a 6-digit code shown on the person's screen. Approvers get a live alert, notification and **Password resets** badge. The owner (or anyone, in an emergency) can be reset from the command line: `node server.js reset-password <email>`.
- **Log forwarding** of the audit log, server-wide (`FORWARD_URL`) and per organization (Settings): HTTPS with optional custom CA and mutual TLS, credentials in a write-only header, private-network addresses blocked for organization collectors, a persistent queue with exponential backoff and jitter, batches, stable event IDs and hash-chain fields for verification. NDJSON, JSON or Splunk HEC.
- **Monthly audit rotation:** the live log keeps the current month; earlier months are sealed into compressed archives with recorded hashes (12 months kept by default). The hash chain and the integrity check span the archives. Admins and auditors download archived months as CSV or NDJSON. The console encourages forwarding.
- **Approved list:** search and filters to remove an accidental approval quickly; **Apply to every computer** for a one-computer approval; **Add approvals directly** to push websites or file types to every computer or chosen ones (same safeguards: lookalike confirmation, reasons, two-person rule).
- Database upgrades in place (migration 2); existing organizations become complimentary with a limit of at least 10 computers.
- Server tests: 27 (was 14).

## 2.5.0

### Connect to a support team (Guardian Support server)

Requests to allow a website or a kind of file can now go to a support team, who approve them from their phone or computer. The server is new, self-hosted, and included in this repository under `server/`; see `server/README.md`. No third-party service is involved.

**Where to connect.** Setup guide **step 2, "Connect to a support team (optional)"**: pressing **Next** skips it. Later: **Settings → Support team**. Enter the server address and the one-time connection code an admin creates in the console (**Computers → Create connection code**). The computer's name defaults to "<person>'s computer".

**What changes when connected:**
- **"Ask to allow"** on the block page and the Download stopped page sends the request to the team (it is also kept on the computer, as before). The page says it went to the team, shows **Waiting for <team>** while it's open, and shows **<team> said no: "<reason>"** if they deny it.
- **Always-blocked sites can be requested** (only when connected). The scam warning stays, and the button reads **Ask <team> to review this site**. The team is told which always-block entry and list blocked the site. Without a team, always-blocked sites still can't be requested or allowed on the computer.
- **What the team approves is applied automatically:**
  - websites and file types are added to what's allowed (kept separate from entries added on the computer);
  - always-block approvals remove that entry from the always-block rules. If the blocking entry is a parent domain, a higher-priority exception allows just the approved site: approving `my.anydesk.com` leaves `anydesk.com` blocked.
  - approvals the team removes disappear on the next check.
- **Checking with the server:** every minute while anything is waiting, otherwise every 15 minutes, and when the browser starts. Requests made while offline are sent on the next check. Decided requests are removed from the popup's request lists. Decisions are recorded in **Activity → Changes**.
- **The helper on the computer can still approve** websites and file types in the popup as before, but can't lift the always-block list. Only the team can.
- **Disconnecting:** if the team disconnects the computer, its approvals stop applying and Settings says so; reconnecting needs a new code. Disconnecting from the computer (two clicks) tells the server, removes the team's approvals, and deletes the computer's key.

**Security:**
- **Device key:** on connecting, the computer creates its own ECDSA P-256 key. The private key is created non-extractable and kept in the extension's IndexedDB, so it can sign but can't be read out.
- **Signed calls:** every call to the server is signed (method, path, time, one-time nonce, body hash). A copied device ID is useless without the key, and the server rejects replays and requests more than 5 minutes off.
- **HTTPS only,** except `localhost` and `127.0.0.1` for testing. Server addresses with a user name or password are refused.
- **What's sent:** only the requests themselves. Site requests carry the domain, the address, and the always-block entry if any. File requests carry the type(s), extension, file name, and download address. Connecting also sends the computer's name, the person's name, and the extension version. Browsing history and scam-word activity are never sent.
- **Who can connect it:** only the settings page can connect, disconnect, or sync. Web pages and the block and download pages can't.

**New permissions:** none. Server requests use the existing `<all_urls>` host access.

### Files

| File | Change |
|---|---|
| `support.js` | **New:** device key (IndexedDB), enrollment, signed calls |
| `background.js` | Team lists in the effective lists, always-block exceptions (rules and checks), sending requests, sync with adaptive timing, connect/disconnect, decisions to block/download pages |
| `popup.html`, `popup.js` | Setup step 2 and the **Support team** card in Settings |
| `blockpage.js`, `downloadblocked.js` | Team wording, always-blocked requests when connected, waiting/denied status |
| `manifest.json` | 2.5.0 |
| `server/` | **New:** the Guardian Support server and console |
| `tests/support.e2e.test.mjs` | **New:** 33 checks of the extension and server together |

### Publishing notes

- **Store package:** must include the new `support.js` (the zip command in `STORE-SUBMISSION.md` is updated). Do **not** include `server/` or `tests/`.
- **Privacy:** the extension can now send request details to a support server the user connects to. `Privacy-Policy.md` and the data-use answers in `STORE-SUBMISSION.md` are updated.
- **Store review:** code change, so leave "skip review" unchecked. No new permissions.

## 2.4.0

### Files sent as "unknown type" are judged by their extension

Many sites send programs and other files as `application/octet-stream`, or with no type at all, which says nothing about what the file is. In 2.3 those files could not be requested, and allowing `octet-stream` would have let almost any download through. Version 2.4 reads the file's extension in that case.

**What counts as a generic type:** none at all, `application/octet-stream`, `binary/octet-stream`, `application/binary`, `application/unknown`, `application/x-unknown`, `application/download`, `application/x-download`, `application/force-download`, `application/x-force-download`, and `application/x-octet-stream`. A real type (for example `application/pdf`) is still checked exactly as sent, as before.

**The filter (background).** When a download arrives with a generic type:
1. The extension is read from the name the file will be saved under. Trailing dots and spaces are ignored, because Windows drops them when saving (`Support.exe.` is saved as `Support.exe`). Double extensions are judged by the real last one (`invoice.pdf.exe` is `.exe`).
2. The extension is looked up in a table of about 150 extensions, each with the real types servers use for it. For example, `.exe` maps to `application/x-msdownload`, `application/vnd.microsoft.portable-executable`, `application/x-msdos-program`, `application/x-dosexec`, and `application/x-executable`. The table includes every type in the bundled file-type groups.
3. The download is **allowed if any of those types is on the allowed list**, or if `application/octet-stream` itself is allowed. Otherwise it is stopped.

So once a helper allows `.exe` files, an `.exe` sent as `octet-stream` downloads, while other `octet-stream` files (an `.mp4`, say) are still stopped. `octet-stream` never has to be allowed for a file with a recognizable extension.

**The request (Download stopped page).** The request now carries one or several types:

| What the site sent | What is requested | Button |
|---|---|---|
| A real type | That type, as in 2.3 | Ask Tom to allow this kind of file |
| A generic type, known extension | Every real type for that extension that isn't allowed yet. **Never `octet-stream`.** | Ask Tom to allow .exe files |
| A generic type, unknown or no extension | `application/octet-stream`, as the last resort | Ask Tom to allow unknown files |

The page shows a new **Sent by the website as** line and lists the type or types to allow. When the file was judged by its name, a blue note says so: "The website didn't say what kind of file this is, so it was checked by its name (.exe)." If some of the extension's types are already allowed, only the missing ones are listed and requested. If they became allowed while the page was open, the page switches to "now allowed" and offers **Download again**.

**Asking for "unknown files" (`octet-stream`).** This is only offered when nothing else can be: no extension, or one the table doesn't know. The page shows a red warning that this would allow *all* unknown files, programs included, and that the helper will be warned. In the popup, the request is labeled **ANY FILE**, explains that allowing it lets almost any download through, suggests downloading the file for them instead, and needs a second click: **Allow ALL unknown files?**

You asked for a step that tells the user when the extension's real types are already allowed and the only thing missing is `octet-stream`, and then requests `octet-stream`. That situation can no longer happen: with the extension check in place, such a download is simply let through.

**Programs.** Program extensions keep the scam warning on the page and the two-click **Allow programs?** in the popup, even when the site sent `octet-stream`. These include `.exe`, `.msi`, `.dmg`, `.apk`, `.bat`, `.ps1`, `.vbs`, `.js`, `.jar`, `.lnk`, `.iso`, scripts, and Office files with macros. Nineteen more types were added to the program list, including `application/x-dosexec`, `application/javascript`, and `application/x-vbscript`.

**The popup.**
- One request row now holds every type for the extension, and **Allow** adds them all at once.
- Each row says why it asks for what it does (for example "checked by its name (.exe)").
- Requests saved by 2.3 (a single type) still show and approve normally.
- Requests, approvals, and dismissals in **Activity → Changes** list every type involved.

### Safety notes

- **The request is decided by the background, from the stored download.** The page only sends the download's ID, so it can't ask for a different type.
- **Generic types get no special trust.** A file sent as `octet-stream` passes only if its extension's real types are allowed, exactly as if the site had sent the real type.
- **Real types are still checked as sent, unchanged from earlier versions.** For example, a file sent as `application/pdf` but named `.exe` passes if PDF is allowed. Checking the extension against real types too would close that gap; see the publishing notes.

### Publishing notes

- **Permissions:** no new ones. **GitHub Pages:** no changes. **Store package:** same file list as 2.3.
- **Store review:** code change, so leave "skip review" unchecked.
- **Possible follow-up:** stop a download when its extension is a program but the site claims a harmless real type (for example `Support.exe` sent as `application/pdf`). Off by default in this version, to keep the "real types are checked as sent" rule you set.

### Files

| File | Change |
|---|---|
| `lib.js` | Generic-type list, extension table, `fileExtension`, `mimeRequestFor`, `downloadAllowed`, `describeRequest`; more program types and names |
| `background.js` | Filter uses `downloadAllowed`; requests hold several types; `checkMime` works from the download ID; approve/dismiss take several types (2.3 single-type requests still accepted) |
| `downloadblocked.html`, `downloadblocked.js` | "Sent by the website as" line, list of types, judged-by-name note, last-resort warning, button wording |
| `popup.js`, `popup.css` | Multi-type request rows, **ANY FILE** label and two-click approval |
| `ui.css` | Note and type-list styles |
| `manifest.json` | 2.4.0 |
| `tests/background.test.mjs` | 19 new checks (123 total) |

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
