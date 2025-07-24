const blockedSubdomains = [
  "remoteassistance.support.services.microsoft.com",
  "remotedesktop.google.com"
];

chrome.runtime.onInstalled.addListener(() => {
  updateRules();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.allowlist) {
    updateRules();
  }
});

function escapeRegex(domain) {
  return domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateRules() {
  chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
    const dynamicRules = [];

    // Allow all subdomains of each allowlisted domain
    allowlist.forEach((domain, index) => {
      dynamicRules.push({
        id: 1000 + index,
        priority: 100,
        action: { type: "allow" },
        condition: {
          urlFilter: `*://*.${domain}/*`,
          resourceTypes: ["main_frame", "sub_frame"]
        }
      });
    });

    // Explicitly block sensitive subdomains unless allowed
    blockedSubdomains.forEach((domain, index) => {
      const isExplicitlyAllowed = allowlist.some(allowed =>
        allowed === domain || allowed.endsWith(`.${domain}`)
      );

      if (!isExplicitlyAllowed) {
        const escapedDomain = escapeRegex(domain);
        dynamicRules.push({
          id: 2000 + index,
          priority: 110,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: chrome.runtime.getURL("blockpage.html") + "?url=$0"
            }
          },
          condition: {
            regexFilter: `^https?://${escapedDomain}/.*`,
            resourceTypes: ["main_frame"]
          }
        });
      }
    });

    // Catch-all block rule for everything else
    dynamicRules.push({
      id: 9999,
      priority: 90,
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: chrome.runtime.getURL("blockpage.html") + "?url=$0"
        }
      },
      condition: {
        regexFilter: ".*",
        resourceTypes: ["main_frame"]
      }
    });

    // Remove all existing rules and apply new set
    const allIds = dynamicRules.map(rule => rule.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({ length: 11000 }, (_, i) => i),
      addRules: dynamicRules
    });
  });
}
chrome.downloads.onCreated.addListener(downloadItem => {
  chrome.storage.local.get("allowedMimeTypes", ({ allowedMimeTypes = [] }) => {
    const mime = downloadItem.mime?.toLowerCase() || "";

    if (!allowedMimeTypes.includes(mime)) {
      chrome.downloads.cancel(downloadItem.id, () => {
        chrome.notifications.create({
          type: "basic",
          title: "Download Blocked",
          message: `Files of type "${mime}" are not allowed.`
        });
        console.log("Blocked download:", downloadItem.filename, "| MIME:", mime);
      });
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ filteringEnabled: true });
});
