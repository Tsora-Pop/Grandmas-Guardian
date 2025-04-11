function updateAllowList() {
  chrome.storage.local.get(["allowList", "allowListEnabled"], (data) => {
    const allowList = data.allowList || [];
    const allowListEnabled = data.allowListEnabled ?? true;
    const dynamicRules = [];

    if (allowListEnabled) {
      // Add "allow" rules for each domain in the allow list
      allowList.forEach((domain, index) => {
        dynamicRules.push({
          id: index + 1,
          priority: 1,
          action: { type: "allow" },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame", "sub_frame"],
          },
        });
      });

      // Redirect all blocked requests to the custom block page
      dynamicRules.push({
        id: allowList.length + 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blockpage.html") },
        },
        condition: {
          urlFilter: "*",
          resourceTypes: ["main_frame", "sub_frame"],
        },
      });
    }

    // Apply the rules
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: dynamicRules,
      removeRuleIds: Array.from({ length: 100 }, (_, i) => i + 1),
    });
  });
}

function mergeUploadedDomainsWithTopSites(uploadedDomains) {
  chrome.topSites.get((sites) => {
    const topDomains = sites.map((site) => {
      try {
        return new URL(site.url).hostname;
      } catch (error) {
        console.error("Invalid URL in top sites:", site.url);
        return null;
      }
    }).filter(Boolean); // Remove null values

    chrome.storage.local.get("allowList", (data) => {
      const allowList = data.allowList || [];

      // Merge, deduplicate, and update allow list
      const updatedAllowList = [...new Set([...allowList, ...uploadedDomains, ...topDomains])];

      chrome.storage.local.set({ allowList: updatedAllowList }, () => {
        console.log("Allow list updated with uploaded domains and top sites.");
        updateAllowList();
      });
    });
  });
}

// Listener for handling uploaded domains from options.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPLOAD_DOMAINS") {
    mergeUploadedDomainsWithTopSites(message.domains);
    sendResponse({ success: true });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ allowListEnabled: true });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.allowList || changes.allowListEnabled)) {
    updateAllowList();
  }
});
