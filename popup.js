// Default remote URLs
const defaultDomainsUrl   = "https://tsora-pop.github.io/lists/domain/domainUSDefault.txt";
const defaultMimeUrl      = "https://tsora-pop.github.io/lists/mime/mimeDefault.txt";
const defaultScamUrl      = "https://tsora-pop.github.io/scam-terms.txt";

// Helper to fetch, validate, and merge lines into storage
function loadListFromUrl(url, storageKey, renderFn, validator) {
  fetch(url)
    .then(res => res.text())
    .then(text => {
      let lines = text
        .split("\n")
        .map(l => l.trim().toLowerCase())
        .filter(l => l && !l.startsWith("#"));

      if (validator) {
        lines = lines.filter(validator);
      }

      chrome.storage.local.get(storageKey, data => {
        const existing = data[storageKey] || [];
        const merged = [...new Set([...existing, ...lines])];
        chrome.storage.local.set({ [storageKey]: merged }, renderFn);
      });
    })
    .catch(err => console.error(`Failed to fetch ${storageKey}:`, err));
}

// Renders domain allowlist UI
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
        const updated = allowlist.filter(d => d !== domain);
        chrome.storage.local.set({ allowlist: updated }, renderList);
      };
      div.append(label, removeBtn);
      container.appendChild(div);
    });
  });
}

// Renders MIME-type allowlist UI
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
        chrome.storage.local.set(
          { allowedMimeTypes: updated },
          renderMimeList
        );
      };
      div.append(label, removeBtn);
      container.appendChild(div);
    });
  });
}

// Renders scam-term filter UI
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
      div.append(label, removeBtn);
      container.appendChild(div);
    });
  });
}

// Standard add/remove handlers
document.getElementById("addBtn").onclick = () => {
  const input = document.getElementById("domainInput");
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;
  chrome.storage.local.get("allowlist", ({ allowlist = [] }) => {
    if (!allowlist.includes(domain)) {
      chrome.storage.local.set({ allowlist: [...allowlist, domain] }, renderList);
    }
  });
  input.value = "";
};

document.getElementById("includeTopSites").onclick = () => {
  chrome.topSites.get(sites => {
    const topDomains = sites.map(s => {
      const host = new URL(s.url).hostname;
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
  const url = document.getElementById("txtUrlInput").value.trim();
  if (url) loadListFromUrl(url, "allowlist", renderList);
};
function renderBlockedLog() {
  chrome.storage.local.get("blockedLog", ({ blockedLog = [] }) => {
    const container = document.getElementById("blockedLogList");
    container.innerHTML = "";
    blockedLog.slice(-10).reverse().forEach(entry => {
      const div = document.createElement("div");
      div.textContent = `${entry.timestamp}: ${entry.url}`;
      container.appendChild(div);
    });
  });
}

renderBlockedLog();


// MIME-type handlers
document.getElementById("addMimeBtn").onclick = () => {
  const mime = document.getElementById("mimeInput").value.trim().toLowerCase();
  const valid = /^[a-z0-9.-]+\/[a-z0-9.+-]+$/.test(mime);
  if (!mime || !valid) return;
  chrome.storage.local.get("allowedMimeTypes", ({ allowedMimeTypes = [] }) => {
    if (!allowedMimeTypes.includes(mime)) {
      chrome.storage.local.set(
        { allowedMimeTypes: [...allowedMimeTypes, mime] },
        renderMimeList
      );
    }
  });
  document.getElementById("mimeInput").value = "";
};

document.getElementById("removeAllMimesBtn").onclick = () => {
  chrome.storage.local.set({ allowedMimeTypes: [] }, renderMimeList);
};

document.getElementById("loadMimeListBtn").onclick = () => {
  const url = document.getElementById("mimeUrlInput").value.trim();
  if (url) {
    loadListFromUrl(url, "allowedMimeTypes", renderMimeList, line =>
      /^[a-z0-9.-]+\/[a-z0-9.+-]+$/.test(line)
    );
  }
};

// Scam-term handlers
document.getElementById("addScamBtn").onclick = () => {
  const term = document.getElementById("scamInput").value.trim().toLowerCase();
  if (!term) return;
  chrome.storage.local.get("scamTerms", ({ scamTerms = [] }) => {
    if (!scamTerms.includes(term)) {
      chrome.storage.local.set({ scamTerms: [...scamTerms, term] }, renderScamList);
    }
  });
  document.getElementById("scamInput").value = "";
};

document.getElementById("removeAllScamBtn").onclick = () => {
  chrome.storage.local.set({ scamTerms: [] }, renderScamList);
};

document.getElementById("loadScamListBtn").onclick = () => {
  const url = document.getElementById("scamUrlInput").value.trim();
  if (url) {
    loadListFromUrl(url, "scamTerms", renderScamList, line => line.length > 2);
  }
};

// DOMContentLoaded: bind toggles + default-loading buttons
document.addEventListener("DOMContentLoaded", () => {
  const scamToggle    = document.getElementById("toggleFiltering");
  const domainToggle  = document.getElementById("toggleDomainFiltering");
  const mimeToggle    = document.getElementById("toggleMimeFiltering");

  const loadDefDomBtn = document.getElementById("loadDefaultDomainsBtn");
  const loadDefMimeBtn= document.getElementById("loadDefaultMimesBtn");
  const loadDefScamBtn= document.getElementById("loadDefaultScamBtn");

  // Initialize toggle states
  chrome.storage.local.get(
    {
      filteringEnabled:     true,
      domainFilteringEnabled:true,
      mimeFilteringEnabled: true
    },
    prefs => {
      scamToggle.checked   = prefs.filteringEnabled;
      domainToggle.checked = prefs.domainFilteringEnabled;
      mimeToggle.checked   = prefs.mimeFilteringEnabled;
    }
  );

  // Toggle listeners
  scamToggle.addEventListener("change", () => {
    chrome.storage.local.set({ filteringEnabled: scamToggle.checked });
  });
  domainToggle.addEventListener("change", () => {
    chrome.storage.local.set({ domainFilteringEnabled: domainToggle.checked });
  });
  mimeToggle.addEventListener("change", () => {
    chrome.storage.local.set({ mimeFilteringEnabled: mimeToggle.checked });
  });

  // Default-list buttons
  loadDefDomBtn.addEventListener("click", () => {
    loadListFromUrl(defaultDomainsUrl, "allowlist", renderList);
  });
  loadDefMimeBtn.addEventListener("click", () => {
    loadListFromUrl(
      defaultMimeUrl,
      "allowedMimeTypes",
      renderMimeList,
      line => /^[a-z0-9.-]+\/[a-z0-9.+-]+$/.test(line)
    );
  });
  loadDefScamBtn.addEventListener("click", () => {
    loadListFromUrl(defaultScamUrl, "scamTerms", renderScamList, line => line.length > 2);
  });
});

chrome.storage.local.get("blockedDownloads", ({ blockedDownloads = [] }) => {
  const container = document.getElementById("blockedDownloadsList");
  blockedDownloads.forEach(entry => {
    const item = document.createElement("li");
    item.textContent = `${entry.filename} (${entry.mimeType}) — ${new Date(entry.timestamp).toLocaleString()}`;
    container.appendChild(item);
  });
});


// Initial render
renderList();
renderMimeList();
renderScamList();
