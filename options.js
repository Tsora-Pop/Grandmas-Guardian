function displayAllowList() {
  chrome.storage.local.get("allowList", (data) => {
    const allowList = data.allowList || [];
    const listContainer = document.getElementById("allowList");
    listContainer.innerHTML = ""; // Clear previous entries

    allowList.forEach((domain) => {
      const listItem = document.createElement("li");
      listItem.textContent = domain;
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
      const domains = event.target.result.split("\n").map((domain) => domain.trim());
      chrome.storage.local.set({ allowList: domains }, () => {
        alert("Allow list updated!");
        displayAllowList();
      });
    };
    reader.readAsText(file);
  } else {
    alert("Please select a file.");
  }
});

document.addEventListener("DOMContentLoaded", displayAllowList);

  