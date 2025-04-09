chrome.storage.local.get("lastBlockedUrl", (data) => {
    if (data.lastBlockedUrl) {
      const blockedDomain = new URL(data.lastBlockedUrl).hostname;
      document.getElementById("blockedDomain").textContent = `Attempted to access: ${blockedDomain}`;
    }
  });
  