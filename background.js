function updateAllowList() {
    chrome.storage.local.get("allowList", (data) => {
      const allowList = data.allowList || [];
      const dynamicRules = [];
  
      // Add "allow" rules for each domain in the allow list
      allowList.forEach((domain, index) => {
        dynamicRules.push({
          id: index + 1,
          priority: 1,
          action: { type: "allow" },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      });
  
      // Redirect all blocked requests to the custom block page
      dynamicRules.push({
        id: allowList.length + 1,
        priority: 1,
        action: { type: "redirect", redirect: { url: chrome.runtime.getURL("blockpage.html") } },
        condition: {
          urlFilter: "*",
          resourceTypes: ["main_frame", "sub_frame"]
        }
      });
  
      // Apply the rules
      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: dynamicRules,
        removeRuleIds: Array.from({ length: 100 }, (_, i) => i + 1) // Clear all existing rules
      });
    });
  }
  
  chrome.runtime.onInstalled.addListener(() => {
    updateAllowList();
  });
  
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.allowList) {
      updateAllowList();
    }
  });
  