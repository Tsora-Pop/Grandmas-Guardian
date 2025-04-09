document.getElementById('uploadBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
  
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const domains = event.target.result.split('\n').map(domain => domain.trim());
        chrome.storage.local.set({ allowList: domains }, () => {
          alert('Allow list updated!');
        });
      };
      reader.readAsText(file);
    } else {
      alert('Please select a file.');
    }
  });
  