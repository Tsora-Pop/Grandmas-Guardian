function renderList() {
  chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
    const container = document.getElementById("domainList");
    container.innerHTML = "";

    allowlist.forEach(domain => {
      const div = document.createElement("div");

      const label = document.createElement("span");
      label.textContent = domain;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        chrome.storage.local.set({
          allowlist: allowlist.filter(d => d !== domain)
        }, renderList);
      };

      div.appendChild(label);
      div.appendChild(removeBtn);
      container.appendChild(div);
    });
  });
}

document.getElementById("addBtn").onclick = () => {
  const input = document.getElementById("domainInput");
  const domain = input.value.trim().toLowerCase();
  if (domain) {
    chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
      if (!allowlist.includes(domain)) {
        allowlist.push(domain);
        chrome.storage.local.set({ allowlist }, renderList);
      }
    });
    input.value = "";
  }
};

document.getElementById("includeTopSites").onclick = () => {
  chrome.topSites.get(sites => {
    const topDomains = sites.map(site => {
      const host = new URL(site.url).hostname;
      return host.startsWith("www.") ? host.slice(4) : host;
    });

    chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
      const updated = [...new Set([...allowlist, ...topDomains])];
      chrome.storage.local.set({ allowlist: updated }, renderList);
    });
  });
};

document.getElementById("removeAllBtn").onclick = () => {
  chrome.storage.local.set({ allowlist: [] }, renderList);
};

document.getElementById("loadCustomTxtBtn").onclick = () => {
  const txtUrl = document.getElementById("txtUrlInput").value.trim();
  if (!txtUrl) return;

  fetch(txtUrl)
    .then(res => res.text())
    .then(text => {
      const newDomains = text
        .split("\n")
        .map(l => l.trim().toLowerCase())
        .filter(l => l && !l.startsWith("#"));

      chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
        const updated = [...new Set([...allowlist, ...newDomains])];
        chrome.storage.local.set({ allowlist: updated }, renderList);
      });
    })
    .catch(err => console.error("Failed to fetch domain list:", err));
};

function renderMimeList() {
  chrome.storage.local.get("allowedMimeTypes", ({ allowedMimeTypes = [] }) => {
    const container = document.getElementById("mimeList");
    container.innerHTML = "";

    allowedMimeTypes.forEach(mime => {
      const div = document.createElement("div");

      const label = document.createElement("span");
      label.textContent = mime;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        const updated = allowedMimeTypes.filter(m => m !== mime);
        chrome.storage.local.set({ allowedMimeTypes: updated }, renderMimeList);
      };

      div.appendChild(label);
      div.appendChild(removeBtn);
      container.appendChild(div);
    });
  });
}

document.getElementById("addMimeBtn").onclick = () => {
  const mime = document.getElementById("mimeInput").value.trim().toLowerCase();
  if (mime && /^[a-z0-9.-]+\/[a-z0-9.+-]+$/.test(mime)) {
    chrome.storage.local.get("allowedMimeTypes", ({ allowedMimeTypes = [] }) => {
      if (!allowedMimeTypes.includes(mime)) {
        allowedMimeTypes.push(mime);
        chrome.storage.local.set({ allowedMimeTypes }, renderMimeList);
      }
    });
    document.getElementById("mimeInput").value = "";
  }
};

document.getElementById("removeAllMimesBtn").onclick = () => {
  chrome.storage.local.set({ allowedMimeTypes: [] }, renderMimeList);
};

document.getElementById("loadMimeListBtn").onclick = () => {
  const url = document.getElementById("mimeUrlInput").value.trim();
  if (!url) return;

  fetch(url)
    .then(res => res.text())
    .then(text => {
      const mimes = text
        .split("\n")
        .map(line => line.trim().toLowerCase())
        .filter(line => /^[a-z0-9.-]+\/[a-z0-9.+-]+$/.test(line));

      chrome.storage.local.get("allowedMimeTypes", ({ allowedMimeTypes = [] }) => {
        const updated = [...new Set([...allowedMimeTypes, ...mimes])];
        chrome.storage.local.set({ allowedMimeTypes: updated }, renderMimeList);
      });
    })
    .catch(err => console.error("Failed to fetch MIME list:", err));
};
function renderScamList() {
  chrome.storage.local.get("scamTerms", ({ scamTerms = [] }) => {
    const container = document.getElementById("scamTermList");
    container.innerHTML = "";

    scamTerms.forEach(term => {
      const div = document.createElement("div");

      const label = document.createElement("span");
      label.textContent = term;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        const updated = scamTerms.filter(t => t !== term);
        chrome.storage.local.set({ scamTerms: updated }, renderScamList);
      };

      div.appendChild(label);
      div.appendChild(removeBtn);
      container.appendChild(div);
    });
  });
}

document.getElementById("addScamBtn").onclick = () => {
  const term = document.getElementById("scamInput").value.trim().toLowerCase();
  if (term) {
    chrome.storage.local.get("scamTerms", ({ scamTerms = [] }) => {
      if (!scamTerms.includes(term)) {
        scamTerms.push(term);
        chrome.storage.local.set({ scamTerms }, renderScamList);
      }
    });
    document.getElementById("scamInput").value = "";
  }
};

document.getElementById("removeAllScamBtn").onclick = () => {
  chrome.storage.local.set({ scamTerms: [] }, renderScamList);
};

document.getElementById("loadScamListBtn").onclick = () => {
  const url = document.getElementById("scamUrlInput").value.trim();
  if (!url) return;

  fetch(url)
    .then(res => res.text())
    .then(text => {
      const terms = text
        .split("\n")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 2);

      chrome.storage.local.get("scamTerms", ({ scamTerms = [] }) => {
        const updated = [...new Set([...scamTerms, ...terms])];
        chrome.storage.local.set({ scamTerms: updated }, renderScamList);
      });
    })
    .catch(err => console.error("Failed to fetch scam terms:", err));
};

// Filtering toggle
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleFiltering");

  chrome.storage.local.get("filteringEnabled", data => {
    toggle.checked = data.filteringEnabled ?? true;
  });

  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ filteringEnabled: toggle.checked });
  });
});


renderList();
renderMimeList();
renderScamList();