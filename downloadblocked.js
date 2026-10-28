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

  const kind = lib.describeMime(d.mimeType);
  $("fileName").textContent = d.filename || "(no name)";
  $("fileKind").textContent = kind.name;
  $("fileMime").textContent = d.mimeType && d.mimeType !== "unknown" ? d.mimeType : "(not given by the website)";
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
    $("requestBtn").textContent = `Ask ${helperName || "my helper"} to allow this kind of file`;
  }
  const who = helperName || "your helper";

  if (kind.level === "program") {
    $("warning").hidden = false;
    $("warning").textContent =
      "This file is a program that can change your computer. If someone on the phone, in an e-mail or in a " +
      "pop-up told you to download it, it is a scam: hang up and do not install anything.";
  } else if (kind.level === "unknown") {
    // No usable type: allowing "unknown files" would let almost anything through, programs included.
    $("reason").textContent = "The website didn't say what kind of file this is, so it can't be allowed by file type.";
    $("requestBtn").hidden = true;
    $("requestStatus").textContent = `If you need this file, ask ${who} to download it for you.`;
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
    $("requestStatus").textContent = res?.ok
      ? (res.alreadyRequested
        ? `This kind of file has already been requested. ${who[0].toUpperCase() + who.slice(1)} can approve it in Grandma's Guardian.`
        : `Request saved. ${who[0].toUpperCase() + who.slice(1)} can approve it in Grandma's Guardian. ` +
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
    note.textContent = `${kind.name} files can now be downloaded.`;
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
    if (shownAllowed || kind.level === "unknown") return;
    try {
      const res = await chrome.runtime.sendMessage({ type: "checkMime", mime: d.mimeType });
      if (!res?.ok) return;
      if (res.allowed) showAllowed();
      else if (res.pending && !$("requestStatus").textContent) {
        $("requestBtn").disabled = true;
        $("requestStatus").textContent = `Waiting for ${who} to approve this kind of file.`;
      }
    } catch {}
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.effectiveMimeTypes || changes.mimeFilteringEnabled)) check();
  });
  check();
})();
