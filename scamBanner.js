(function () {
    // Define an array of phrases that indicate likely scam content.
    const scamPhrases = [
      "Congratulations, you've won",
      "Urgent action required",
      "Your account has been compromised",
      "Immediate attention required",
      "Click here for a special offer",
      "Verify your account immediately",
      "Renewal"
    ];
  
    // Flags and reference to track banner state.
    let bannerInjected = false;
    let bannerDismissed = false;
    let bannerElement = null;
  
    // Function to inject the scam warning banner.
    function injectBanner() {
      if (bannerInjected || bannerDismissed) return;
  
      const banner = document.createElement("div");
      // Use sticky positioning so the banner is in the document flow
      // and pushes content downward.
      banner.style.position = "sticky";
      banner.style.top = "0";
      banner.style.left = "0";
      banner.style.width = "100%";
      banner.style.backgroundColor = "#ff0000";
      banner.style.color = "#ffffff";
      banner.style.textAlign = "center";
      banner.style.fontWeight = "bold";
      banner.style.padding = "10px";
      banner.style.zIndex = "10000"; // May not be needed if it's in flow
      banner.style.boxShadow = "0 2px 5px rgba(0,0,0,0.5)";
      banner.textContent =
        "Safe Passage Warning: This page appears to contain scam content. Please ignore any suspicious messages or pop-ups, delete potential scam emails, and consider closing your browser for your safety.";
  
      // Create a dismiss button.
      const dismissButton = document.createElement("button");
      dismissButton.textContent = "Dismiss";
      dismissButton.style.marginLeft = "10px";
      dismissButton.style.padding = "5px";
      dismissButton.style.backgroundColor = "#ffffff";
      dismissButton.style.color = "#ff0000";
      dismissButton.style.border = "none";
      dismissButton.style.cursor = "pointer";
      dismissButton.addEventListener("click", () => {
        if (bannerElement) {
          bannerElement.remove();
        }
        bannerInjected = false;
        bannerDismissed = true;
        bannerElement = null;
      });
  
      banner.appendChild(dismissButton);
      // Since the banner is now part of the document flow, 
      // prepending it pushes all content below it.
      document.body.insertBefore(banner, document.body.firstChild);
      bannerInjected = true;
      bannerElement = banner;
    }
  
    // Function to remove the banner if it exists.
    function removeBanner() {
      if (bannerElement) {
        bannerElement.remove();
      }
      bannerInjected = false;
      bannerElement = null;
      // Reset the dismissed flag so that if scam content appears later,
      // the banner can be injected again.
      bannerDismissed = false;
    }
  
    // Checks whether the page contains any scam phrases.
    function checkScamContent() {
      // Retrieve visible text from the body.
      const bodyText = document.body.innerText || "";
      const lowerBodyText = bodyText.toLowerCase();
      const scamFound = scamPhrases.some((phrase) =>
        lowerBodyText.includes(phrase.toLowerCase())
      );
  
      if (scamFound) {
        // If scam text is found and the banner is not injected (nor dismissed), inject it.
        if (!bannerInjected && !bannerDismissed) {
          injectBanner();
        }
      } else {
        // If no scam text is detected, remove the banner if present and reset dismissal.
        if (bannerInjected) {
          removeBanner();
        }
        // Ensure the dismissal flag resets so that if scam content reappears later,
        // the banner can be shown again.
        bannerDismissed = false;
      }
    }
  
    // Run an initial check once the content script loads.
    checkScamContent();
  
    // Use a MutationObserver to monitor for changes in the document and re-check.
    const observer = new MutationObserver(() => {
      checkScamContent();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  })();
  