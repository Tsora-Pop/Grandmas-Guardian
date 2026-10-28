// blockpage.js
(async () => {
  const params = new URLSearchParams(location.search);
  const reason = params.get("r") === "deny" ? "deny" : "allow";
  // v2 puts the blocked address in the #fragment (keeps & and # intact);
  // ?url= is still read for anything redirected by the old v1 rules.
  const blockedUrl = location.hash ? location.hash.slice(1) : (params.get("url") || "");

  const $ = id => document.getElementById(id);

  // Only real web addresses are ever made clickable. This page can be opened by
  // any website with any text after "#", so never link javascript:, data:,
  // file: or anything else.
  let webUrl = null;
  let host = "";
  try {
    const u = new URL(blockedUrl);
    if (u.protocol === "http:" || u.protocol === "https:") {
      webUrl = u.href;
      host = u.hostname.replace(/^www\./, "");
    }
  } catch {}

  // Page address: a link for ordinary blocked sites, plain text for dangerous ones
  // (they can never be allowed, so there is nothing to click through to).
  if (webUrl && reason === "allow") {
    const link = $("blockedLink");
    link.href = webUrl;
    link.textContent = webUrl;
    link.rel = "noopener noreferrer";
    link.hidden = false;
    $("blockedUrl").hidden = true;
    $("addressHint").hidden = false;
  } else {
    $("blockedUrl").textContent = blockedUrl || "(unknown)";
  }

  if (reason === "deny") {
    $("title").textContent = "This page is not safe";
    $("reason").textContent = host
      ? `${host} is on the always-blocked list. Scammers often use sites like this.`
      : "This website is on the always-blocked list.";
    $("warning").hidden = false;
    $("requestBtn").hidden = true;
  } else if (host) {
    $("reason").textContent = `${host} isn't on your list of allowed websites.`;
  }

  const { helperName = "", helperPhone = "" } =
    await chrome.storage.local.get(["helperName", "helperPhone"]);
  if (helperName || helperPhone) {
    $("helperBox").hidden = false;
    $("helperName").textContent = helperName || "your helper";
    if (helperPhone) {
      $("helperPhone").textContent = helperPhone;
      $("helperPhone").href = `tel:${helperPhone.replace(/[^\d+]/g, "")}`;
    } else {
      $("helperPhoneWrap").hidden = true;
    }
    $("requestBtn").textContent = `Ask ${helperName || "my helper"} to allow this site`;
  }

  // Go back: return to the previous page, or close the tab if there is none.
  $("backBtn").addEventListener("click", async () => {
    if (history.length > 1) {
      history.back();
      return;
    }
    const tab = await chrome.tabs.getCurrent();
    if (tab) chrome.tabs.remove(tab.id);
  });

  $("requestBtn").addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "requestSite", url: blockedUrl });
    $("requestBtn").disabled = true;
    $("requestStatus").textContent = res?.ok
      ? `Request saved. ${helperName || "Your helper"} can approve it in Grandma's Guardian. ` +
        "Leave this page open: it will tell you when the site is allowed."
      : (res?.error || "Sorry, that request couldn't be saved.");
  });

  // When the site is approved (usually while this tab is still open), switch the
  // page to "now allowed" with an Open button, so nobody has to retype the address.
  let shownAllowed = false;
  function showAllowed() {
    if (shownAllowed) return;
    shownAllowed = true;
    document.querySelector(".block-card").classList.add("allowed");
    $("title").textContent = "This site is now allowed";
    const note = $("reason");
    note.className = "allowed-note";
    note.textContent = `${host} has been added to your allowed websites.`;
    $("requestBtn").hidden = true;
    $("helperBox").hidden = true;
    $("requestStatus").textContent = "";
    $("backBtn").classList.remove("primary");
    const open = $("openBtn");
    open.href = webUrl;
    open.rel = "noopener noreferrer";
    open.hidden = false;
    open.focus();
    $("addressHint").textContent = "Click Open the page, or the address above.";
  }

  async function checkAllowed() {
    if (!webUrl || reason !== "allow" || shownAllowed) return;
    try {
      const res = await chrome.runtime.sendMessage({ type: "checkSite", url: webUrl });
      if (res?.ok && res.allowed) showAllowed();
    } catch {}
  }

  if (webUrl && reason === "allow") {
    // rulesStatus is written right after the browser's blocking rules are updated,
    // so by the time it changes, the new rules are already in force.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.rulesStatus) checkAllowed();
    });
    checkAllowed(); // e.g. the tab was reopened after the site was approved
  }

  if (blockedUrl) {
    chrome.runtime.sendMessage({ type: "logBlocked", url: blockedUrl, reason });
  }
})();
