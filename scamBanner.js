(function() {
    // Define an array of phrases that indicate a likely scam.
    const scamPhrases = [
      "Congratulations, you've won",
      "Urgent action required",
      "Your account has been compromised",
      "Immediate attention required",
      "Click here for a special offer",
      "Verify your account immediately",
      "Final Notice",
      "Get inspired",
      "Renewal",
      "bitcoin"
    ];
  
    let bannerInjected = false;
  
    // Function to inject the scam warning banner.
    function injectBanner() {
      if (bannerInjected) return;
      
      const banner = document.createElement("div");
      banner.style.position = "fixed";
      banner.style.top = "0";
      banner.style.left = "0";
      banner.style.width = "100%";
      banner.style.backgroundColor = "#ff0000";
      banner.style.color = "#ffffff";
      banner.style.textAlign = "center";
      banner.style.fontWeight = "bold";
      banner.style.padding = "10px";
      banner.style.zIndex = "10000";
      banner.style.boxShadow = "0 2px 5px rgba(0,0,0,0.5)";
      banner.textContent = "Safe Passage Warning: This page appears to contain scam content. Please ignore any suspicious messages or pop-ups, ignore the scam email, and consider closing your browser for your safety.";
  
      document.body.insertBefore(banner, document.body.firstChild);
      bannerInjected = true;
    }
  
    // Function to check if scam phrases are present on the page.
    function checkScamContent() {
      // Skip re-check if banner already exists.
      if (bannerInjected) return;
      
      // Get the visible text of the body.
      const bodyText = document.body.innerText || "";
      const lowerBodyText = bodyText.toLowerCase();
  
      // Check for any scam phrase.
      const scamFound = scamPhrases.some(phrase =>
        lowerBodyText.includes(phrase.toLowerCase())
      );
  
      if (scamFound) {
        injectBanner();
      }
    }
  
    // Run an immediate check once the content script loads.
    checkScamContent();
  
    // Create a MutationObserver to monitor DOM changes.
    const observer = new MutationObserver((mutations) => {
      // Re-run the scam check when the DOM changes.
      checkScamContent();
    });
  
    // Observe changes to the whole document body.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  })();
  