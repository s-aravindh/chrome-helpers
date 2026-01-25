
// Job Match Scorer - Content Script
// Extracts text from the current page for analysis

(function () {
    'use strict';

    // Heuristics to find the main job description container
    // Common class names/IDs used in job portals
    const CONTENT_SELECTORS = [
        '.job-description',
        '#job-description',
        '.description',
        '.jobs-description-content', // LinkedIn
        '.job-details',
        'main',
        'article',
        'body' // Fallback
    ];

    function getPageText() {
        let contentElement = null;

        // Try to find the most specific content container
        for (const selector of CONTENT_SELECTORS) {
            const el = document.querySelector(selector);
            if (el && el.innerText.length > 200) { // arbitrary threshold to avoid headers/navs
                contentElement = el;
                break;
            }
        }

        // Fallback to body if nothing specific found
        if (!contentElement) contentElement = document.body;

        // Clean up text
        // - Limit length to avoid token limits (Gemini 1.5 Pro has huge context, but still good practice)
        // - Remove excessive whitespace
        let text = contentElement.innerText;
        text = text.replace(/\s+/g, ' ').trim();

        // Truncate if extreme length (e.g. infinite scroll pages), keep first 15k chars ≈ 3-4k tokens
        return text.substring(0, 15000);
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extract_job_text') {
            const text = getPageText();
            sendResponse({
                success: true,
                text: text,
                url: window.location.href,
                title: document.title
            });
        }
        return true; // Keep channel open for async response
    });

})();
