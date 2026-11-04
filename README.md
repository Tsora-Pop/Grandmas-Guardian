<H1> Grandma's Guardian</H1>

A extension to protect your grandma, grandpa, or anyone! Introducing "Grandma's Guardian", a security tool you can setup for yourself or a loved one to reduce the likelihood they become victims of an online scam. Simply Install, add your top 20, delete any domains you know the user or yourself won't need, and safely browse! This is not intended as an Ad blocker, as advertisements will load on the web page. Best of all: Absolutely no data is collected on you by the developers. We just want you to empower family to be as safe as possible online. This extension works on Chromium-based browsers and on Firefox (desktop and Android, Firefox 140 or later). 

<b>Features:</b>  
Manifest V3  
Domain Allow Listing: Only allow navigation to websites explicitly permitted! You no longer have to fear popups or clicking a malicious link.  
Always-Block List: Remote-control tools (AnyDesk, TeamViewer, etc.) and abused hosting stay blocked, even under an allowed domain such as sites.google.com.  
MIME Type Allow Listing: Only allow specific file types to be downloaded from any platform  
Semantic Filtering: Hide scam wording from your user so they are less likely to engage with the scammer, with a "Show anyway" button.  
Remote Lists: Subscribe to lists from the open source community for domains, blocked domains, MIME types, and scam phrases. Lists refresh daily; you can also import a local .txt file.  
Helper Contact and Requests: Blocked pages show who to call, and let the user ask you to allow a site. Approve requests with one click.  
Activity Logs: Blocked sites, stopped downloads, scam text (hidden or shown anyway) and setting changes. Export to CSV/JSON, or forward to a log collector or SIEM.  
Disguise-resistant Scam Filtering: Catches spaced-out letters, look-alike characters, numbers for letters, invisible characters and phrases split across formatting.  
Setup Guide: A step-by-step guide opens on first install.  
Top Sites quick add: Quickly add the websites a user visits most to the allow list.  

See [CHANGELOG.md](CHANGELOG.md) for what changed in 2.x.

<b>Supported Platforms:</b>  
Windows  
MacOS  
ChromeOS
Linux  
Mobile (Vivaldi, Lemur, Titanium)

<b>Supported Browsers:</b>  
Chrome  
Edge  
Brave  
Opera  
Vivaldi  
Lemur  
Titanium  
Firefox 140+ (desktop) and Firefox for Android 142+: see [Firefox](#firefox)

Disclaimer: This browser extension is developed by someone who is active in the defensive cyber security community and based in North Carolina, United States. This tool's source code is open source, however contributions are not being added at this time. Several quality-of-life updates are expected in the future, as well as other enhancements to core features (block log exports, etc). 

Community Asks: Please creates lists that work for your community. Whether this be industry specific, other countries, or localities, and share them on GitHub! 

Grandma's Guardian GitHub: https://github.com/Tsora-Pop/Grandmas-Guardian   
Published Lists by Developer: https://github.com/Tsora-Pop/Tsora-Pop.github.io/tree/main/lists


## Only allowed browser extensions

The same allowlist approach, for browser extensions (**Extensions** tab). Scammers often have people install an extension: remote control, fake "security" tools, coupon or search add-ons that read every page and steal sign-ins.

- **Turn it on** under **Extensions → Only allow these browser extensions**. The browser asks once for permission to manage extensions; it's optional, so updating Grandma's Guardian never needs new permissions. Extensions installed at that moment are added to the allowed list (review them in the list shown).
- **Any other extension is turned off** as soon as it's installed or switched on (also if someone switches it back on by hand), and a page explains what it is, where it came from and what it can do in plain words: "Read and change website sign-in cookies (could take over accounts)". The person can **Ask to allow** it, or **Remove it**.
- **Always-blocked extensions** are turned off even if allowed; only a support team can make an exception. The default list holds remote-control extensions (Chrome Remote Desktop). Add IDs by hand, or subscribe to online lists of IDs like the other lists; the bundled lists are in `lists/extension/` for publishing on your list site.
- **Logged** on the computer (Activity → Extensions, and the CSV/JSON export) and forwarded to a collector if that's on: name, ID, version, where it came from, its permissions and websites, and warnings for powerful permissions or installs from outside a store.
- **With a support team,** requests go to the console with the same details; approving allows it for that computer or every computer. The console can also push extension IDs directly. An organization can require two people for risky extensions.
- Never touched: Grandma's Guardian itself, themes, and extensions installed by the organization's policy. Turning the feature off switches back on everything it switched off.

For computers you manage, browser policy is stronger still (`ExtensionInstallAllowlist` / `ExtensionInstallBlocklist` in Chrome and Edge, `ExtensionSettings` in Firefox); this feature covers the computers you don't manage that way.

## Allowing sites on this computer (localhost)

`localhost` and `127.0.0.1` can be added to the allowed websites like any other site (any port), so people who run things locally, such as developers, don't need to switch protection off. They can't be put on the always-block list.

## Support team (Guardian Support server)

Requests to allow a website or file type can go to a support team, who get a notification and approve them from a phone or computer. The extension itself (and publishing your own lists for it) is free; Guardian Support is a paid plan per **browser license**: one browser account on computers, so Edge signed in to the same account on 3 computers is 1 license, while another browser or a phone/tablet is another. Run the server in `server/` (see `server/README.md`). In the extension, connect under **Settings → Support team**, or during setup, with the server address and a one-time code from the console.

**Which computers get an approval?** The approver chooses each time: **only the computer that asked**, or **every computer in the organization** (including computers connected later). On the console's **Approved** page, a one-computer approval can be moved to every computer with **Apply to every computer**, and **Add approvals directly** pushes a list of websites or file types to every computer or to chosen ones without waiting for a request. Computers pick up changes within a minute when something is waiting, otherwise within 15 minutes.

## Collecting activity logs

- **One computer:** Activity tab → **Export CSV** or **Export JSON**.
- **Many computers:** Settings → **Send logs to a collector**. Every event is POSTed to your HTTPS endpoint as a JSON array, NDJSON, or Splunk HEC events, with an optional `Authorization` header. Undelivered events are kept and retried. This works with:
  - Splunk HEC;
  - Logstash and Fluent Bit HTTP inputs;
  - Azure Logic Apps (to Sentinel or Log Analytics);
  - n8n or Power Automate.

## Deploying to computers you manage

These are optional browser policies for computers you administer. They are not required for the extension to work.

| Policy | Value | Why |
|---|---|---|
| `ExtensionInstallForcelist` | `plmkmnjiplhldamhmfdbkemhlkcpikmp;https://clients2.google.com/service/update2/crx` | Installs the extension automatically and stops it being removed or switched off |
| `IncognitoModeAvailability` | `1` | Disables Incognito windows, where extensions are off by default |
| `BrowserGuestModeEnabled` | `false` | Guest windows have no extensions |
| `BrowserAddPersonEnabled` | `false` | A new profile would have no extensions |

Microsoft Edge uses the same names, except `InPrivateModeAvailability` instead of `IncognitoModeAvailability`.

Where policies go:
- **Windows:** Group Policy with the Chrome ADMX templates, or registry keys under `HKLM\Software\Policies\Google\Chrome`.
- **macOS:** a configuration profile for the `com.google.Chrome` domain.
- **Linux:** a JSON file in `/etc/opt/chrome/policies/managed/`, for example:

```json
{
  "ExtensionInstallForcelist": ["plmkmnjiplhldamhmfdbkemhlkcpikmp;https://clients2.google.com/service/update2/crx"],
  "IncognitoModeAvailability": 1,
  "BrowserGuestModeEnabled": false,
  "BrowserAddPersonEnabled": false
}
```

### Configuring the extension by policy

All settings except the lists themselves can be pushed through `chrome.storage.managed` (schema: `managed_schema.json`). Settings set this way are locked in the extension's settings page.

The available keys:
- `personName`, `helperName`, `helperPhone`;
- `forceProtectionsOn` (true keeps all four protections on);
- `forwardEnabled`, `forwardUrl`, `forwardAuth`, `forwardFormat`;
- `subscriptions`: extra online lists that users can't remove.

Where the policy goes:
- **Windows:** registry keys under `HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\plmkmnjiplhldamhmfdbkemhlkcpikmp\policy`. Edge uses `...\Microsoft\Edge\3rdparty\extensions\<id>\policy`.
- **macOS:** a configuration profile for the domain `com.google.Chrome.extensions.plmkmnjiplhldamhmfdbkemhlkcpikmp`.
- **Linux:** a JSON file in `/etc/opt/chrome/policies/managed/`, for example:

```json
{
  "3rdparty": {
    "extensions": {
      "plmkmnjiplhldamhmfdbkemhlkcpikmp": {
        "personName": "Front desk PC",
        "forceProtectionsOn": true,
        "forwardEnabled": true,
        "forwardUrl": "https://siem.example.org:8088/services/collector",
        "forwardAuth": "Splunk 00000000-0000-0000-0000-000000000000",
        "forwardFormat": "splunk",
        "subscriptions": [
          { "kind": "deny", "url": "https://intranet.example.org/blocklist.txt", "name": "County blocklist" }
        ]
      }
    }
  }
}
```

The extension only protects the browsers it is installed in. If other browsers are installed, a scammer can simply ask the user to open one of them; install it in each (Chrome and Firefox are both supported), or use application control on the computer to close that gap.

## Firefox

The Firefox version is built from the same code (`node tools/build.mjs` makes `dist/firefox/` and a zip for addons.mozilla.org). Its add-on ID is `grandmas-guardian@tsora-pop.github.io`. It needs Firefox 140 or later (Firefox for Android 142 or later).

Everything works the same, except:

| Feature | In Firefox |
|---|---|
| **Stopping downloads** | Firefox can't hold a download while it is checked. A blocked download is cancelled the moment it starts, the partial file is deleted, and it is removed from the downloads list, so for a split second part of the file can exist on disk. Chrome stops it before anything is written. |
| **Sending data** (support team, log forwarding) | Firefox asks the person's permission the first time: clicking **Connect** or turning on **Send logs to a collector** shows Firefox's data-sharing prompt (browsing activity, website content for scam-text logs, and the person's name). Nothing is sent without it, and taking it away in Firefox stops sending. Policy-configured forwarding also waits for that one click. |
| **Website access** | Firefox lets people turn off an add-on's access to websites. Without it, block pages can't be shown, so the popup warns **Website protection is OFF** with an **Allow** button. |
| **Private windows** | Firefox doesn't let add-ons open its add-ons page, so instead of a button the popup and setup guide give the steps: menu ☰ → Add-ons and themes → Grandma's Guardian → **Run in Private Windows: Allow**. |
| **Settings by policy** | Uses Firefox's `policies.json` (below) instead of `managed_schema.json`. Firefox for Android has no policy settings. |
| **Log export** | Uses a `blob:` link instead of `data:` (Firefox doesn't download `data:` links from add-ons). Same file. |
| **Extension allowlisting** | Firefox only lets an add-on switch other add-ons off when it was itself installed by enterprise policy (Firefox 140+). Installed that way, it works as in Chrome. Otherwise it still detects add-ons that aren't allowed, logs them with their permissions, opens the warning page and sends requests to the support team, but can't switch them off, and Firefox doesn't let add-ons remove other add-ons, so the page tells the person how to remove it. |

### Deploying Firefox to computers you manage

Put a `policies.json` in Firefox's `distribution` folder (or use the Firefox ADMX templates / macOS profile with the same settings):

```json
{
  "policies": {
    "ExtensionSettings": {
      "grandmas-guardian@tsora-pop.github.io": {
        "installation_mode": "force_installed",
        "install_url": "https://addons.mozilla.org/firefox/downloads/latest/grandmas-guardian/latest.xpi",
        "private_browsing": true
      }
    },
    "DisablePrivateBrowsing": true,
    "3rdparty": {
      "Extensions": {
        "grandmas-guardian@tsora-pop.github.io": {
          "personName": "Front desk PC",
          "forceProtectionsOn": true
        }
      }
    }
  }
}
```

The `3rdparty` keys are the same as for Chrome (above). Replace the `install_url` slug with the one AMO gives the listing.
