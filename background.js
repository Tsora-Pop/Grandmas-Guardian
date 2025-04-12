function updateAllowList() {
  chrome.storage.local.get(["allowList", "allowListEnabled"], (data) => {
    const allowList = data.allowList || [];
    const allowListEnabled = data.allowListEnabled ?? true;
    const dynamicRules = [];

    if (allowListEnabled) {
      // Allowed rules: only traffic matching an allow-list domain is explicitly permitted.
      allowList.forEach((domain, index) => {
        dynamicRules.push({
          id: index + 1,
          priority: 100, // High priority so allowed domains win.
          action: { type: "allow" },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      });

      // Block rule: redirect all main_frame requests that do not match an allowed domain.
      dynamicRules.push({
        id: allowList.length + 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            // Append the original URL as a query parameter.
            regexSubstitution: chrome.runtime.getURL("blockpage.html") + "?url=$0"
          }
        },
        condition: {
          // This regex captures any HTTP/HTTPS URL.
          regexFilter: "^(https?://.*)$",
          resourceTypes: ["main_frame"]
        }
      });
    }

    // Remove previous rules and update with the new ones.
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: dynamicRules,
      removeRuleIds: Array.from({ length: 100 }, (_, i) => i + 1)
    });
  });
}

function mergeUploadedDomainsWithTopSites(uploadedDomains) {
  chrome.topSites.get((sites) => {
    const topDomains = sites
      .map((site) => {
        try {
          return new URL(site.url).hostname;
        } catch (error) {
          console.error("Invalid URL in top sites:", site.url);
          return null;
        }
      })
      .filter(Boolean); // Remove any null values.

    chrome.storage.local.get("allowList", (data) => {
      const allowList = data.allowList || [];
      // Merge, deduplicate, and update the allow list.
      const updatedAllowList = [...new Set([...allowList, ...uploadedDomains, ...topDomains])];

      chrome.storage.local.set({ allowList: updatedAllowList }, () => {
        console.log("Allow list updated with uploaded domains and top sites.");
        updateAllowList();
      });
    });
  });
}

// Message listener for uploaded domains.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPLOAD_DOMAINS") {
    mergeUploadedDomainsWithTopSites(message.domains);
    sendResponse({ success: true });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ allowListEnabled: true });
  updateAllowList(); // Set the initial allow list on install.
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.allowList || changes.allowListEnabled)) {
    updateAllowList();
  }
});
