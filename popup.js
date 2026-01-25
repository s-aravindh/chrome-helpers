
import { analyzeJobMatch } from './modules/job-match-scorer/matcher.js';

// Elements
const shortsToggle = document.getElementById('toggle-shorts');
const formFillerSettingsBtn = document.getElementById('form-filler-settings');
const fillFormBtn = document.getElementById('fill-form-btn');
const analyzeJobBtn = document.getElementById('analyze-job-btn');
const jobMatchSettingsBtn = document.getElementById('job-match-settings');

// Analysis UI Elements
const analysisResult = document.getElementById('analysis-result');
const analysisPreview = document.getElementById('analysis-preview');
const jobDescPreview = document.getElementById('job-description-preview');
const confirmAnalyzeBtn = document.getElementById('confirm-analyze-btn');
const cancelPreviewBtn = document.getElementById('cancel-preview-btn');

const matchScoreEl = document.getElementById('match-score');
const matchSummaryEl = document.getElementById('match-summary');
const matchFeedbackEl = document.getElementById('match-feedback');

// State for multi-step flow
let extractedPageData = null;
let currentConfig = null;

// 1. YouTube Shorts Logic
if (shortsToggle) {
  // Load initial state
  chrome.storage.local.get(['hideShorts'], (result) => {
    // Check again inside callback to be safe, though closure usually handles it
    if (shortsToggle) {
      shortsToggle.checked = result.hideShorts !== false; // Default to true
    }
  });

  // Handle toggle change
  shortsToggle.addEventListener('change', () => {
    const isHidden = shortsToggle.checked;
    chrome.storage.local.set({ hideShorts: isHidden }, () => {
      console.log('Shorts visibility saved:', isHidden);
      // Notify active tab
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
}

// 2. Fill Form Button Logic
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

// 3. Form Filler Settings Button Logic
if (formFillerSettingsBtn) {
  formFillerSettingsBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('modules/job-form-filler/settings.html')
    });
  });
}

// 4. Job Match Scorer Settings Button Logic
if (jobMatchSettingsBtn) {
  jobMatchSettingsBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('modules/job-match-scorer/settings.html')
    });
  });
}

// 5. Job Analyzer Step 1: Extract & Preview
if (analyzeJobBtn) {
  analyzeJobBtn.addEventListener('click', async () => {
    // Reset UI
    analyzeJobBtn.textContent = 'Extracting...';
    analyzeJobBtn.disabled = true;
    analysisResult.classList.add('hidden');
    analysisPreview.classList.add('hidden');

    try {
      // Get Config
      const config = await chrome.storage.local.get(['geminiApiKey', 'userResume', 'selectedModel']);
      if (!config.geminiApiKey || !config.userResume) {
        alert('Please configure your Gemini API Key and Resume in settings first.');
        chrome.tabs.create({ url: chrome.runtime.getURL('modules/job-match-scorer/settings.html') });
        return;
      }
      currentConfig = config;

      // Get Job Description from Content Script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab');

      let pageData = null;
      try {
        // Try sending message first
        pageData = await chrome.tabs.sendMessage(tabs[0].id, { action: 'extract_job_text' });
      } catch (err) {
        console.log('Content script not ready, attempting injection...', err);
        // If failed, try to inject the script dynamically
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['modules/job-match-scorer/content.js']
        });

        // Retry message after short delay to let script initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        pageData = await chrome.tabs.sendMessage(tabs[0].id, { action: 'extract_job_text' });
      }

      if (!pageData || !pageData.text) {
        throw new Error('Could not extract text. If this persists, please reload the page.');
      } extractedPageData = pageData;

      // Show Preview
      jobDescPreview.value = pageData.text;
      analysisPreview.classList.remove('hidden');

    } catch (error) {
      console.error(error);
      alert(`Extraction failed: ${error.message}`);
    } finally {
      analyzeJobBtn.textContent = 'Analyze';
      analyzeJobBtn.disabled = false;
    }
  });
}

// 6. Job Analyzer Step 2: Confirm & Run AI
if (confirmAnalyzeBtn) {
  confirmAnalyzeBtn.addEventListener('click', async () => {
    if (!currentConfig) return;

    confirmAnalyzeBtn.textContent = 'Analyzing...';
    confirmAnalyzeBtn.disabled = true;
    cancelPreviewBtn.disabled = true;

    try {
      // Get edited text from preview
      const finalJobText = jobDescPreview.value;

      // Call AI
      const analysis = await analyzeJobMatch(
        currentConfig.geminiApiKey,
        currentConfig.userResume,
        finalJobText,
        currentConfig.selectedModel
      );

      // Render Results
      matchScoreEl.textContent = analysis.matchScore;
      matchSummaryEl.textContent = analysis.summary;

      // Color code score
      const score = analysis.matchScore;
      matchScoreEl.style.color = score > 80 ? '#27ae60' : (score > 50 ? '#e67e22' : '#c0392b');
      document.querySelector('.score-ring').style.borderColor = matchScoreEl.style.color;

      // Feedback
      let feedbackHtml = '';
      if (analysis.missingCriticalSkills && analysis.missingCriticalSkills.length > 0) {
        feedbackHtml += `<h4>⚠️ Missing Skills</h4><ul>${analysis.missingCriticalSkills.map(s => `<li>${s}</li>`).join('')}</ul>`;
      }
      if (analysis.improvementTips && analysis.improvementTips.length > 0) {
        feedbackHtml += `<h4>💡 Tips</h4><ul>${analysis.improvementTips.map(t => `<li>${t}</li>`).join('')}</ul>`;
      }
      matchFeedbackEl.innerHTML = feedbackHtml;

      // Save Context for Chatbot
      await chrome.storage.local.set({
        chatContext: {
          resumeText: currentConfig.userResume,
          jobDescription: finalJobText,
          initialOutput: analysis
        }
      });

      // Show results, hide preview
      analysisPreview.classList.add('hidden');
      analysisResult.classList.remove('hidden');

    } catch (error) {
      console.error(error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      confirmAnalyzeBtn.textContent = 'Run AI Analysis';
      confirmAnalyzeBtn.disabled = false;
      cancelPreviewBtn.disabled = false;
    }
  });

  cancelPreviewBtn.addEventListener('click', () => {
    analysisPreview.classList.add('hidden');
    analysisResult.classList.add('hidden');
  });

  // Chat Button Handler
  const chatBtn = document.getElementById('chat-with-coach-btn');
  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('modules/job-match-scorer/chat.html') });
    });
  }
}
