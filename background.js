chrome.runtime.onInstalled.addListener(() => {
    // On installation, ensure the allow list rules are active
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: 1,
          priority: 1,
          action: { type: "allow" },
          condition: {
            urlFilter: "*://*.microsoft.com/*",
            resourceTypes: ["main_frame", "sub_frame"]
          }
        },
        {
          id: 2,
          priority: 1,
          action: { type: "allow" },
          condition: {
            urlFilter: "*://*.google.com/*",
            resourceTypes: ["main_frame", "sub_frame"]
          }
        },
        {
          id: 3,
          priority: 1,
          action: { type: "allow" },
          condition: {
            urlFilter: "*://*.youtube.com/*",
            resourceTypes: ["main_frame", "sub_frame"]
          }
        },
        {
          id: 4,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: "*",
            resourceTypes: ["main_frame", "sub_frame"]
          }
        }
      ]
      // Omit removeRules entirely if no rules are being removed
    });
  });