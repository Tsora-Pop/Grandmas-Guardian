function displayAllowList() {
  chrome.storage.local.get(["allowList", "allowListEnabled", "includeTopSites"], (data) => {
    const allowList = data.allowList || [];
    const allowListEnabled = data.allowListEnabled ?? true;
    const includeTopSites = data.includeTopSites ?? true;
    document.getElementById("enableToggle").checked = allowListEnabled;
    document.getElementById("includeTopSites").checked = includeTopSites;
    const listContainer = document.getElementById("allowList");
    listContainer.innerHTML = ""; // Clear previous entries
    allowList.forEach((domain) => {
      const listItem = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "domainCheckbox";
      checkbox.value = domain;
      listItem.appendChild(checkbox);
      listItem.appendChild(document.createTextNode(domain));
      listContainer.appendChild(listItem);
    });
  });
}

document.getElementById("uploadBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const domains = event.target.result.split("\n")
        .map((domain) => domain.trim())
        .filter(Boolean);
      // Send domains to background.js for merging with top sites.
      chrome.runtime.sendMessage({ type: "UPLOAD_DOMAINS", domains }, (response) => {
        if (response && response.success) {
          alert("Allow list updated with uploaded domains and top sites!");
          displayAllowList();
        } else {
          alert("Error updating allow list.");
        }
      });
    };
    reader.readAsText(file);
  } else {
    alert("Please select a file.");
  }
});

document.getElementById("enableToggle").addEventListener("change", (event) => {
  const isEnabled = event.target.checked;
  chrome.storage.local.set({ allowListEnabled: isEnabled }, () => {
    alert(`Allow listing ${isEnabled ? "enabled" : "disabled"}!`);
    displayAllowList();
  });
});

document.getElementById("includeTopSites").addEventListener("change", (event) => {
  const includeTopSites = event.target.checked;
  chrome.storage.local.set({ includeTopSites: includeTopSites }, () => {
    alert(`Top 20 Work Safe Domains inclusion ${includeTopSites ? "enabled" : "disabled"}!`);
  });
});

document.getElementById("removeBtn").addEventListener("click", () => {
  const checkedBoxes = document.querySelectorAll(".domainCheckbox:checked");
  const domainsToRemove = Array.from(checkedBoxes).map((checkbox) => checkbox.value);
  chrome.storage.local.get("allowList", (data) => {
    const allowList = data.allowList || [];
    const updatedAllowList = allowList.filter((domain) => !domainsToRemove.includes(domain));
    chrome.storage.local.set({ allowList: updatedAllowList }, () => {
      alert("Selected domains removed from the allow list!");
      displayAllowList();
    });
  });
});

document.addEventListener("DOMContentLoaded", displayAllowList);
