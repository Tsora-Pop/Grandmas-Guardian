// blockpage.js
(async () => {
  const params = new URLSearchParams(location.search);
  const reason = params.get("r") === "deny" ? "deny" : "allow";
  // v2 puts the blocked address in the #fragment (keeps & and # intact);
  // ?url= is still read for anything redirected by the old v1 rules.
  const blockedUrl = location.hash ? location.hash.slice(1) : (params.get("url") || "");

  const $ = id => document.getElementById(id);
  $("blockedUrl").textContent = blockedUrl || "(unknown)";

  let host = "";
  try { host = new URL(blockedUrl).hostname.replace(/^www\./, ""); } catch {}

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
      ? `Request saved. ${helperName || "Your helper"} can approve it in Grandma's Guardian.`
      : (res?.error || "Sorry, that request couldn't be saved.");
  });

  if (blockedUrl) {
    chrome.runtime.sendMessage({ type: "logBlocked", url: blockedUrl, reason });
  }
})();
