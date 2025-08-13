// blockpage.js
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const blockedUrl = params.get("url");
  document.getElementById("blockedDomain").textContent = blockedUrl;

  chrome.runtime.sendMessage({
    type: "logBlockedRequest",
    url: blockedUrl,
    timestamp: new Date().toISOString()
  });
});
