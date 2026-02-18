// Job Description Extractor - Content Script
// Extracts and cleans the job description from the current page

(function () {
    'use strict';

    // LinkedIn "See more" expands the truncated description — click before extracting.
    // Returns true if clicked (caller should wait for re-render).
    function expandLinkedIn() {
        const btn = document.querySelector(
            'button.jobs-description__footer-button, ' +
            'button[aria-label*="see more" i], ' +
            'button.show-more-less-html__button'
        );
        if (btn) { btn.click(); return true; }
        return false;
    }

    // On LinkedIn search results the right panel (#job-details) contains lots of noise.
    // Walk down to the actual description container before handing off to elementToCleanText.
    function findLinkedInDescription() {
        // Preferred: the description markup container on both /jobs/view/ and search panel
        const candidates = [
            '.jobs-description-content__text',
            '.jobs-description-content__text--stretch',
            '.jobs-description__container',
            '.jobs-description',
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim().length > 100) return el;
        }
        return null;
    }

    // Ordered list of selectors — LinkedIn is handled separately above
    const JOB_DESCRIPTION_SELECTORS = [
        // Indeed
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',
        // Greenhouse
        '.job__description',
        // Lever
        '.section[data-qa="job-description"]',
        // Workday
        '[data-automation-id="jobPostingDescription"]',
        // Ashby
        '.ashby-job-posting-description',
        // Generic
        '.job-description',
        '#job-description',
        '[class*="jobDescription"]',
        '[id*="jobDescription"]',
        '[class*="job-description"]',
        '[id*="job-description"]',
        'article',
        'main',
    ];

    /**
     * Attempts to find the best DOM element containing the job description.
     */
    function findJobDescriptionElement() {
        for (const selector of JOB_DESCRIPTION_SELECTORS) {
            try {
                const el = document.querySelector(selector);
                if (el && el.innerText.trim().length > 100) {
                    return el;
                }
            } catch (_) {
                // invalid selector, skip
            }
        }
        return document.body;
    }

    /**
     * Converts a DOM element's content to clean, readable plain text,
     * preserving list structure with dashes and line breaks.
     */
    function elementToCleanText(el) {
        // Clone to avoid mutating the real DOM
        const clone = el.cloneNode(true);

        // Remove noise elements
        const noiseSelectors = ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'iframe'];
        noiseSelectors.forEach(tag => {
            clone.querySelectorAll(tag).forEach(n => n.remove());
        });

        // Convert list items to text with dashes
        clone.querySelectorAll('li').forEach(li => {
            li.prepend('- ');
            li.append('\n');
        });

        // Add newlines after block elements
        const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'ul', 'ol', 'section'];
        blockTags.forEach(tag => {
            clone.querySelectorAll(tag).forEach(el => el.append('\n'));
        });

        // Extract text
        let text = clone.innerText || clone.textContent || '';

        // Normalize whitespace: collapse multiple blank lines, trim
        text = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+/g, ' ')          // Collapse horizontal whitespace
            .replace(/\n[ \t]+/g, '\n')        // Remove leading spaces per line
            .replace(/[ \t]+\n/g, '\n')        // Remove trailing spaces per line
            .replace(/\n{3,}/g, '\n\n')        // Max two consecutive newlines
            .trim();

        // Cap length to avoid overwhelming downstream consumers (~12k chars ≈ 3k tokens)
        return text.substring(0, 12000);
    }

    /**
     * Main extraction entry point.
     */
    async function extractJobDescription() {
        // Expand truncated description (e.g. LinkedIn "See more") and wait for re-render
        const expanded = expandLinkedIn();
        if (expanded) await new Promise(r => setTimeout(r, 400));

        // LinkedIn-specific: drill straight to the description, skip the noisy panel
        const linkedInEl = findLinkedInDescription();
        const el = linkedInEl || findJobDescriptionElement();
        const text = elementToCleanText(el);

        return {
            success: true,
            text,
            url: window.location.href,
            title: document.title,
            extractedFrom: el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${String(el.className).split(' ')[0]}` : ''),
            characterCount: text.length,
        };
    }

    // Listen for messages from popup or other extension pages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extract_job_description') {
            extractJobDescription()
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
        }
        return true; // Keep channel open for async response
    });

})();
