const blockedSubdomains = [
  "remoteassistance.support.services.microsoft.com",
  "remotedesktop.google.com"
];

// On install: initialize all three toggles
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    filteringEnabled: true,
    domainFilteringEnabled: true,
    mimeFilteringEnabled: true
  });
  updateRules();
});

// Rebuild network‐request rules whenever the allowlist or domain toggle changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.allowlist || changes.domainFilteringEnabled)
  ) {
    updateRules();
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "logBlockedRequest") {
    chrome.storage.local.get("blockedLog", ({ blockedLog = [] }) => {
      blockedLog.push({
        url: msg.url,
        timestamp: msg.timestamp,
        sourceTab: sender.tab?.url || "unknown"
      });
      chrome.storage.local.set({ blockedLog });
    });
  }
});

// Utility: escape dots and other regex chars
function escapeRegex(domain) {
  return domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build & install declarativeNetRequest rules based on domainFilteringEnabled
function updateRules() {
  chrome.storage.local.get(
    ["allowlist", "domainFilteringEnabled"],
    ({ allowlist = [], domainFilteringEnabled }) => {
      const dynamicRules = [];

      if (domainFilteringEnabled) {
        // 1) Allow every entry in the allowlist (apex & subdomains)
        allowlist.forEach((domain, i) => {
          dynamicRules.push({
            id: 1000 + i * 2,
            priority: 100,
            action: { type: "allow" },
            condition: {
              urlFilter: `*://${domain}/*`,
              resourceTypes: ["main_frame", "sub_frame"]
            }
          });
          dynamicRules.push({
            id: 1000 + i * 2 + 1,
            priority: 100,
            action: { type: "allow" },
            condition: {
              urlFilter: `*://*.${domain}/*`,
              resourceTypes: ["main_frame", "sub_frame"]
            }
          });
        });

        // 2) Block our sensitive subdomains unless explicitly allowed
        blockedSubdomains.forEach((domain, j) => {
          const isAllowed = allowlist.some(
            a => a === domain || a.endsWith(`.${domain}`)
          );
          if (!isAllowed) {
            const re = escapeRegex(domain);
            dynamicRules.push({
              id: 2000 + j,
              priority: 110,
              action: {
                type: "redirect",
                redirect: {
                  regexSubstitution:
                    chrome.runtime.getURL("blockpage.html") + "?url=\\1"
                }
              },
              condition: {
                regexFilter: `^(https?://${re}/.*)`,
                resourceTypes: ["main_frame"]
              }
            });
          }
        });

        // 3) Catch‐all: block everything else
        dynamicRules.push({
          id: 9999,
          priority: 90,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution:
                chrome.runtime.getURL("blockpage.html") + "?url=\\1"
            }
          },
          condition: {
            regexFilter: "^(https?://.*)",
            resourceTypes: ["main_frame"]
          }
        });
      }

      // Apply: remove all old rules, add only our dynamicRules
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({ length: 11000 }, (_, i) => i),
        addRules: dynamicRules
      });
    }
  );
}

// ✅ Download listener: enforce MIME‐type allowlist and log blocked downloads
chrome.downloads.onCreated.addListener(downloadItem => {
  chrome.storage.local.get(
    ["allowedMimeTypes", "mimeFilteringEnabled", "blockedDownloads"],
    ({ allowedMimeTypes = [], mimeFilteringEnabled, blockedDownloads = [] }) => {
      if (!mimeFilteringEnabled) return;

      const mime = downloadItem.mime?.toLowerCase() || "";
      if (!allowedMimeTypes.includes(mime)) {
        chrome.downloads.cancel(downloadItem.id, () => {
          chrome.notifications.create({
            type: "basic",
            title: "Download Blocked",
            message: `Files of type "${mime}" are not allowed.`
          });

          // ✅ Log the blocked download
          blockedDownloads.push({
            filename: downloadItem.filename || "unknown",
            mimeType: mime,
            timestamp: new Date().toISOString(),
            sourceUrl: downloadItem.finalUrl || "unknown"
          });
          chrome.storage.local.set({ blockedDownloads });

          console.log("Blocked download:", downloadItem.filename, "| MIME:", mime);
        });
      }
    }
  );
});
