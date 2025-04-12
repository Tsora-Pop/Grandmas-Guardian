const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get("url");

if (blockedUrl) {
  try {
    const blockedDomain = new URL(blockedUrl).hostname;
    document.getElementById("blockedDomain").textContent = `Attempted to access: ${blockedDomain}`;
  } catch (error) {
    console.error("Invalid blocked URL:", blockedUrl);
  }
} else {
  document.getElementById("blockedDomain").textContent = "Unknown domain.";
}
