document.addEventListener('DOMContentLoaded', () => {
  const shortsToggle = document.getElementById('toggle-shorts');
  const formFillerToggle = document.getElementById('toggle-form-filler');
  const formFillerSettingsBtn = document.getElementById('form-filler-settings');

  // Load initial state for YouTube Shorts
  chrome.storage.local.get(['hideShorts'], (result) => {
    shortsToggle.checked = result.hideShorts !== false; // Default to true if undefined
  });

  // Load initial state for Job Form Filler
  chrome.storage.local.get(['jobFormFillerEnabled'], (result) => {
    formFillerToggle.checked = result.jobFormFillerEnabled !== false; // Default to true if undefined
  });

  // Handle YouTube Shorts toggle change
  shortsToggle.addEventListener('change', () => {
    const isHidden = shortsToggle.checked;

    // Save state
    chrome.storage.local.set({ hideShorts: isHidden }, () => {
      console.log('Shorts visibility saved:', isHidden);

      // Notify active content script to update instantly
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes("youtube.com")) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateShortsVisibility",
            shouldHide: isHidden
          });
        }
      });
    });
  });

  // Handle Job Form Filler toggle change
  // Handle Fill Form button click
  const fillFormBtn = document.getElementById('fill-form-btn');
  if (fillFormBtn) {
    fillFormBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "trigger_fill"
          }).catch(() => {
            console.log('Content script not ready or page not compatible');
          });
        }
      });
    });
  }

  // Handle settings button click
  formFillerSettingsBtn.addEventListener('click', () => {
    // Open settings page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('modules/job-form-filler/settings.html')
    });
  });
});
