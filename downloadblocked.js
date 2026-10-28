// downloadblocked.js — explains a stopped download and lets the person ask for
// that kind of file to be allowed. Opened by the background (never by websites:
// this page is not web-accessible).
(async () => {
  const $ = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id") || "";

  const [{ blockedDownloads = [], helperName = "", helperPhone = "" }, lib] = await Promise.all([
    chrome.storage.local.get(["blockedDownloads", "helperName", "helperPhone"]),
    import("./lib.js")
  ]);
  const d = blockedDownloads.find(e => e.id === id);

  if (!d) {
    $("reason").textContent = "The details of this download are no longer available.";
    document.querySelector(".file-box").hidden = true;
    $("requestBtn").hidden = true;
    return;
  }

  // What to ask for: the real type the site sent, or (when the site sent a generic
  // type such as application/octet-stream) the real types for the file's extension.
  const plan = lib.mimeRequestFor(d.mimeType, d.filename);
  const kind = lib.describeRequest(plan.mimes, plan.ext);
  const extLabel = plan.ext ? `.${plan.ext}` : "";
  $("fileName").textContent = d.filename || "(no name)";
  $("fileKind").textContent = plan.basis === "unknown" ? "Unknown kind of file" : kind.name;
  $("fileSent").textContent = d.mimeType && d.mimeType !== "unknown" ? d.mimeType : "(no type given)";

  function showTypes(types) {
    $("typesLabel").textContent = types.length > 1 ? "File types to allow" : "File type to allow";
    $("fileMime").replaceChildren(...types.map(t => {
      const c = document.createElement("code");
      c.className = "mime";
      c.textContent = t;
      return c;
    }));
  }
  showTypes(plan.mimes);

  if (plan.basis === "extension") {
    $("basisNote").hidden = false;
    $("basisNote").textContent =
      `The website didn't say what kind of file this is, so it was checked by its name (${extLabel}). ` +
      `Allowing ${extLabel} files allows the file type${plan.mimes.length > 1 ? "s" : ""} below.`;
  } else if (plan.basis === "unknown") {
    $("basisNote").hidden = false;
    $("basisNote").textContent = plan.ext
      ? `The website didn't say what kind of file this is, and its name (${extLabel}) doesn't tell us either.`
      : "The website didn't say what kind of file this is, and its name has no file extension.";
  }
  let fromHost = "";
  try { fromHost = new URL(d.sourceUrl).hostname.replace(/^www\./, ""); } catch {}
  $("fileFrom").textContent = fromHost || d.sourceUrl || "(unknown)";
  $("fileFrom").title = d.sourceUrl || "";

  if (helperName || helperPhone) {
    $("helperBox").hidden = false;
    $("helperName").textContent = helperName || "your helper";
    if (helperPhone) {
      $("helperPhone").textContent = helperPhone;
      $("helperPhone").href = `tel:${helperPhone.replace(/[^\d+]/g, "")}`;
    } else {
      $("helperPhoneWrap").hidden = true;
    }
  }
  const who = helperName || "your helper";
  const Who = who[0].toUpperCase() + who.slice(1);
  const asker = helperName || "my helper";
  $("requestBtn").textContent = plan.basis === "unknown"
    ? `Ask ${asker} to allow unknown files`
    : plan.basis === "extension"
      ? `Ask ${asker} to allow ${extLabel} files`
      : `Ask ${asker} to allow this kind of file`;

  if (kind.level === "program") {
    $("warning").hidden = false;
    $("warning").textContent =
      "This file is a program that can change your computer. If someone on the phone, in an e-mail or in a " +
      "pop-up told you to download it, it is a scam: hang up and do not install anything.";
  } else if (plan.basis === "unknown") {
    // Last resort: the only type left to ask for is octet-stream ("unknown files"),
    // which lets almost anything through. Say so plainly; the helper is warned too.
    $("warning").hidden = false;
    $("warning").textContent =
      "The only way to allow this file is to allow ALL unknown files, which also lets programs through. " +
      `${Who} will be warned about this. If you're not sure you need this file, don't ask.`;
  }

  // Go back: the page the download came from, or the previous page, or close the tab.
  $("backBtn").addEventListener("click", async () => {
    let back = null;
    try {
      const u = new URL(d.referrer || "");
      if (u.protocol === "http:" || u.protocol === "https:") back = u.href;
    } catch {}
    if (back) { location.href = back; return; }
    if (history.length > 1) { history.back(); return; }
    const tab = await chrome.tabs.getCurrent();
    if (tab) chrome.tabs.remove(tab.id);
  });

  $("requestBtn").addEventListener("click", async () => {
    $("requestBtn").disabled = true;
    const res = await chrome.runtime.sendMessage({ type: "requestMime", id });
    if (res?.ok && res.nowAllowed) { check(); return; }
    if (res?.ok && res.mimes?.length) showTypes(res.mimes);
    $("requestStatus").textContent = res?.ok
      ? (res.alreadyRequested
        ? `This has already been requested. ${Who} can approve it in Grandma's Guardian.`
        : `Request saved. ${Who} can approve it in Grandma's Guardian. ` +
          "Leave this page open: it will tell you when you can download the file.")
      : (res?.error || "Sorry, that request couldn't be saved.");
    if (!res?.ok) $("requestBtn").disabled = false;
  });

  // Live update: once the file type is allowed, offer "Download again".
  let canRetry = false;
  try {
    const u = new URL(d.url || "");
    canRetry = u.protocol === "http:" || u.protocol === "https:";
  } catch {}

  let shownAllowed = false;
  function showAllowed() {
    if (shownAllowed) return;
    shownAllowed = true;
    document.querySelector(".block-card").classList.add("allowed");
    $("title").textContent = "This kind of file is now allowed";
    const note = $("reason");
    note.className = "allowed-note";
    note.textContent = plan.basis === "extension"
      ? `${extLabel} files can now be downloaded.`
      : plan.basis === "unknown" ? "Unknown files can now be downloaded." : `${kind.name} files can now be downloaded.`;
    $("basisNote").hidden = true;
    $("warning").hidden = true;
    $("requestBtn").hidden = true;
    $("helperBox").hidden = true;
    $("backBtn").textContent = "⬅ Go back to the page";
    if (canRetry) {
      $("retryBtn").hidden = false;
      $("retryBtn").focus();
      $("requestStatus").textContent = "";
    } else {
      $("requestStatus").textContent = "Go back to the page and click the download again.";
    }
  }

  $("retryBtn").addEventListener("click", async () => {
    $("retryBtn").disabled = true;
    const res = await chrome.runtime.sendMessage({ type: "retryDownload", id });
    $("requestStatus").textContent = res?.ok
      ? "Downloading… The file will appear in your Downloads folder."
      : (res?.error || "The download couldn't be started.");
    if (!res?.ok) $("retryBtn").disabled = false;
  });

  async function check() {
    if (shownAllowed) return;
    try {
      const res = await chrome.runtime.sendMessage({ type: "checkMime", id });
      if (!res?.ok) return;
      if (res.allowed) { showAllowed(); return; }
      // Only list what still needs allowing (some types for this extension may be allowed already).
      if (res.mimes?.length) showTypes(res.mimes);
      if (res.pending && !$("requestStatus").textContent) {
        $("requestBtn").disabled = true;
        $("requestStatus").textContent = `Waiting for ${who} to approve this.`;
      }
    } catch {}
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.effectiveMimeTypes || changes.mimeFilteringEnabled)) check();
  });
  check();
})();
