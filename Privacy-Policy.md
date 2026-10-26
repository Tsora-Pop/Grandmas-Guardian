# 📄 Privacy Policy for Grandma's Guardian

**Effective Date:** 7/28/2025 (updated for version 2.1)

## Overview

**Grandma's Guardian** is a browser extension designed to protect users from scams, phishing attempts, and malicious downloads by enforcing domain and MIME-type allowlisting and filtering scam-related text content. This extension operates on the user's device. The developer does **not** collect any data. Information leaves the device only through the optional feature described under "Optional Feature That Sends Data", and only to destinations the user (or their organization) chooses.

## Data Collection

Grandma's Guardian **does not collect any user data**. Specifically:

- ❌ No personally identifiable information (PII) is collected  
- ❌ No browsing history, URLs, or page content is transmitted to the developer or to any server, unless the user turns on an optional feature below  
- ❌ No analytics, tracking, or telemetry mechanisms are used  
- ❌ No user input, settings, or allowlists are synced or shared externally  

All filtering and protection features are performed locally within the browser.

## List Downloads

The extension downloads plain-text list files (allowed websites, blocked websites, file types, scam phrases) from the web addresses configured in it. By default these are hosted at `tsora-pop.github.io`; you can remove them or add your own. Lists are refreshed about once a day. These requests only download a file. They send no information about you, your browsing, or your settings, though, like any web request, the hosting server can see your IP address.

## Optional Feature That Sends Data

This is **off by default**. It sends data only to the address the user enters, never to the developer.

- **Log forwarding.** When switched on, activity events are sent to the HTTPS address the user or their organization entered. Events include: a website was blocked or requested, a download was stopped, scam text was hidden or revealed, or a setting was changed. They can contain the website address, the matched scam phrase with a short excerpt of the hidden text (up to 200 characters), the "who uses this computer" name, a random install identifier and the extension version.

Organizations that install the extension by policy can turn this feature on centrally.

## Information You Enter

If you enter a helper name and phone number during setup, they are stored only in the browser on this computer and shown on blocked pages and download notices. The activity record is stored on this computer, is limited in size, and can be exported or cleared from the Activity tab. It covers: blocked websites, stopped downloads, scam text that was hidden or shown (with a short excerpt), setting changes, and requests to allow a site. Unless log forwarding is turned on, it never leaves the computer.

## Permissions

The extension requests certain permissions (e.g., access to all URLs, downloads, storage) solely to enable its core functionality:

- ✅ Blocking access to unsafe domains  
- ✅ Preventing downloads of disallowed file types  
- ✅ Hiding scam-related text on webpages  
- ✅ Storing user-defined allowlists and preferences locally  

These permissions are **not used to collect or transmit data**.

## Third Parties

Grandma's Guardian does **not share data with any third parties**, nor does it integrate with any external services, APIs, or advertising networks, other than downloading the list files described above and the optional log forwarding the user turns on.

## User Control

All settings and allowlists are fully controlled by the user and stored locally. Users may modify or delete these settings at any time via the extension’s popup interface.

## Policy Updates

This privacy policy may be updated to reflect changes in functionality or compliance requirements. However, any future version will continue to uphold the principle that **the developer collects no data**, and that anything sent off the device is opt-in and goes only where the user chooses.

## Contact

For questions or concerns about this privacy policy, please contact the developer at:  
📧 _https://github.com/Tsora-Pop/Grandmas-Guardian_
