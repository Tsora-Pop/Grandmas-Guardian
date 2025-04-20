function updateAllowList() {
  chrome.storage.local.get(["allowList", "allowListEnabled"], (data) => {
    const allowList = data.allowList || [];
    const allowListEnabled = data.allowListEnabled ?? true;
    const dynamicRules = [];

    if (allowListEnabled) {
      // 1. Block exception rules for unsafe subdomains (priority 110)
      const blockedSubdomains = [
        "remoteassistance.support.services.microsoft.com",
        "remotedesktop.google.com"
      ];
      blockedSubdomains.forEach((domain, index) => {
        const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        dynamicRules.push({
          id: 1000 + index,
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
      });

      // 2. Add allow rules for domains on the allow list (priority 100)
      allowList.forEach((domain, index) => {
        dynamicRules.push({
          id: index + 1,
          priority: 100,
          action: { type: "allow" },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      });

      // 3. Catch-all rule: Redirect any main frame request that hasn't been allowed.
      dynamicRules.push({
        id: 2000,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            regexSubstitution: chrome.runtime.getURL("blockpage.html") + "?url=$0"
          }
        },
        condition: {
          regexFilter: "^(https?://.*)$",
          resourceTypes: ["main_frame"]
        }
      });
    }

    // Remove any previously defined dynamic rules.
    chrome.declarativeNetRequest.getDynamicRules((currentRules) => {
      const currentRuleIds = currentRules.map(rule => rule.id);
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: currentRuleIds,
        addRules: dynamicRules
      }, () => {
        console.log("Dynamic rules updated:", dynamicRules);
      });
    });
  });
}

// Merges uploaded domains with top sites.
function mergeUploadedDomainsWithTopSites(uploadedDomains) {
  chrome.storage.local.get("includeTopSites", (data) => {
    const includeTopSites = data.includeTopSites ?? true;
    if (includeTopSites) {
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
          .filter(Boolean)
          .slice(0, 20);
        mergeDomains(uploadedDomains, topDomains);
      });
    } else {
      mergeDomains(uploadedDomains, []);
    }
  });
}

// Merges two lists of domains and updates the stored allowList.
function mergeDomains(uploadedDomains, topDomains) {
  chrome.storage.local.get("allowList", (data) => {
    const allowList = data.allowList || [];
    // Merge, deduplicate, and update the allow list.
    const updatedAllowList = [...new Set([...allowList, ...uploadedDomains, ...topDomains])];
    chrome.storage.local.set({ allowList: updatedAllowList }, () => {
      console.log("Allow list updated with uploaded domains and top sites:", updatedAllowList);
      updateAllowList();
    });
  });
}

// Listen for messages (e.g., when domains are uploaded).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPLOAD_DOMAINS") {
    mergeUploadedDomainsWithTopSites(message.domains);
    sendResponse({ success: true });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ allowListEnabled: true, includeTopSites: true });
  updateAllowList();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.allowList || changes.allowListEnabled)) {
    updateAllowList();
  }
});
