// Escape user input for safe regex construction
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a list of case-insensitive regexes matching whole words
function buildRegexList(terms) {
  return terms
    .map(t => t.trim())
    .filter(t => t.length > 2)
    .map(term => new RegExp(`\\b${escapeRegex(term)}\\b`, "i"));
}

// Check if any regex in the list matches the given text
function matchesScam(text, regexList) {
  return regexList.some(rx => rx.test(text));
}

function scanNode(node, regexList) {
  // Skip re-scanning inside our own containers
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    node.classList.contains("scam-container")
  ) {
    return;
  }

  if (node.nodeType === Node.TEXT_NODE && matchesScam(node.textContent, regexList)) {
    const parent = node.parentElement;
    if (!parent) return;

    // Capture the exact text before we remove it
    const originalText = node.textContent;

    // Build a container for hidden text + reveal button
    const container = document.createElement("span");
    container.classList.add("scam-container");
    container.style.display = "inline";

    // Placeholder warning
    const placeholder = document.createElement("span");
    placeholder.textContent = "[Scam text hidden]";
    placeholder.style.backgroundColor = "#f8d7da";
    placeholder.style.color = "#721c24";
    placeholder.style.padding = "2px 6px";
    placeholder.style.borderRadius = "3px";

    // Reveal button
    const revealBtn = document.createElement("button");
    revealBtn.textContent = "Reveal potential scam text";
    revealBtn.style.marginLeft = "5px";
    revealBtn.style.fontSize = "0.8em";

    revealBtn.addEventListener("click", () => {
      // Show the original text with warning styling
      placeholder.textContent = originalText;
      placeholder.style.backgroundColor = "#f8d7da";
      placeholder.style.color = "#721c24";
      placeholder.style.padding = "2px 6px";
      placeholder.style.borderRadius = "3px";

      // Mark this container as revealed so we don't re-hide it
      container.classList.add("scam-revealed");

      // Remove the button
      revealBtn.remove();
    });

    // Assemble and swap into the DOM
    container.appendChild(placeholder);
    container.appendChild(revealBtn);
    parent.insertBefore(container, node);
    parent.removeChild(node);
  } else {
    // Recurse for child nodes
    node.childNodes.forEach(child => scanNode(child, regexList));
  }
}

function scanDocument(regexList) {
  scanNode(document.body, regexList);

  // Watch for dynamic changes
  const observer = new MutationObserver(() => {
    scanNode(document.body, regexList);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Retry in case content loads slowly
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 2000;

  function retryScan() {
    scanNode(document.body, regexList);
    if (++attempts < maxAttempts) {
      setTimeout(retryScan, retryDelay);
    }
  }
  retryScan();
}

// Kick off when the page loads and whenever storage changes
function init() {
  chrome.storage.local.get(
    ["filteringEnabled", "scamTerms"],
    ({ filteringEnabled, scamTerms }) => {
      if (
        filteringEnabled &&
        Array.isArray(scamTerms) &&
        scamTerms.length > 0
      ) {
        const regexList = buildRegexList(scamTerms);
        if (regexList.length) scanDocument(regexList);
      }
    }
  );
}

// Run once on load
init();

// Re-run whenever scamTerms or filteringEnabled changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.scamTerms || changes.filteringEnabled)) {
    init();
  }
});
