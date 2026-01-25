
// Job Form Filler - Content Script
// Auto-fills job application forms with saved profile data

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        debounceTime: 500,
        highlightColor: '#e6fffa', // Light teal background for filled fields
        borderColor: '#38b2ac'     // Teal border
    };

    let profileData = null;

    // Mapping of profile keys to possible input field identifiers (name, id, label, placeholder)
    // Detailed heuristics for better matching
    const FIELD_MAPPINGS = {
        // Identity
        firstName: ['first name', 'firstname', 'fname', 'given name', 'givenname', 'legal first name'],
        lastName: ['last name', 'lastname', 'lname', 'surname', 'family name', 'legal last name'],
        fullName: ['full name', 'fullname', 'name', 'legal name', 'your name', 'complete name'],

        // Contact
        email: ['email', 'e-mail', 'mail', 'email address'],
        phone: ['phone', 'mobile', 'cell', 'telephone', 'phone number', 'contact number', 'tel'],
        countryCode: ['country code', 'phone code', 'dial code'],

        // Location
        address: ['address', 'street', 'street address', 'location', 'residence'],
        city: ['city', 'town', 'municipality'],
        state: ['state', 'province', 'region', 'territory'],
        zipCode: ['zip', 'zip code', 'postal', 'postal code', 'postcode'],
        country: ['country', 'nation'],

        // Social / Digital
        linkedin: ['linkedin', 'linked in', 'linkedin profile', 'linkedin url'],
        github: ['github', 'git hub', 'github profile', 'github url'],
        portfolio: ['portfolio', 'website', 'personal site', 'personal website', 'blog', 'url'],

        // Professional
        currentCompany: ['current company', 'employer', 'current employer', 'organization', 'company'],
        currentTitle: ['current title', 'job title', 'current position', 'position', 'role'],
        yearsOfExperience: ['years of experience', 'years experience', 'yoe', 'experience years', 'total experience']
    };

    // Initialize
    function init() {
        chrome.storage.local.get(['jobFillerProfile', 'jobFormFillerEnabled'], (result) => {
            // Check if enabled (default true if not set) and profile exists
            if (result.jobFormFillerEnabled !== false && result.jobFillerProfile) {
                profileData = result.jobFillerProfile;
                // Form filling is now triggered manually via popup
            }
        });
    }

    // Main filling function
    function fillForms() {
        if (!profileData) return;

        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        let filledCount = 0;

        inputs.forEach(input => {
            if (isFieldFilled(input)) return; // Skip if already has value

            const type = identifyFieldType(input);
            if (type && profileData[type]) {
                const success = fillField(input, profileData[type]);
                if (success) filledCount++;
            }
        });

        if (filledCount > 0) {
            console.log(`[Job Form Filler] Auto-filled ${filledCount} fields.`);
        }
    }

    // Check if field already has a meaningful value
    function isFieldFilled(input) {
        if (input.type === 'checkbox' || input.type === 'radio') return input.checked;
        if (input.tagName === 'SELECT') {
            return input.selectedIndex > 0 && input.value !== "";
        }
        return input.value && input.value.trim().length > 0;
    }

    // Identify what type of data an input expects
    function identifyFieldType(input) {
        // 1. Check specific attributes first (name, id, autocomplete)
        const attributes = [
            input.name,
            input.id,
            input.getAttribute('autocomplete'),
            input.getAttribute('aria-label'),
            input.placeholder
        ];

        // 2. Check associated label text
        const label = findLabelForInput(input);
        if (label) attributes.push(label.innerText);

        // Normalize text for matching
        const searchString = attributes.join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

        // 3. Match against mappings
        // Priority check: Iterate keys in order (can be optimized if strict priority needed)
        // Here we can use specific priority logic if needed, e.g. check "email" before "name"

        // Check exact email type
        if (input.type === 'email') return 'email';
        if (input.type === 'tel') return 'phone';

        for (const [key, keywords] of Object.entries(FIELD_MAPPINGS)) {
            for (const keyword of keywords) {
                // Word boundary check for better accuracy (e.g. avoid matching "name" in "renaming")
                // Simple includes for now, can be regex enhanced
                if (searchString.includes(keyword)) {
                    // Refinements to avoid false positives
                    if (key === 'name' && (searchString.includes('first') || searchString.includes('last'))) continue;
                    return key;
                }
            }
        }

        return null;
    }

    // Find the label element associated with an input
    function findLabelForInput(input) {
        // 1. Explicit 'for' attribute
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }

        // 2. Wrapped label
        let parent = input.parentElement;
        while (parent) {
            if (parent.tagName === 'LABEL') return parent;
            parent = parent.parentElement;
            if (parent === document.body) break; // Don't go too high
        }

        // 3. Aria-labelledby
        const labelledBy = input.getAttribute('aria-labelledby');
        if (labelledBy) {
            return document.getElementById(labelledBy);
        }

        return null;
    }

    // Apply value to the field and trigger events
    function fillField(input, value) {
        try {
            // Determine how to set value
            if (input.tagName === 'SELECT') {
                return fillSelect(input, value);
            } else {
                input.value = value;
            }

            // Visual feedback
            highlightField(input);

            // Trigger events for React/Framework/Validation detection
            const events = ['input', 'change', 'blur', 'focus'];
            events.forEach(eventType => {
                input.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            return true;
        } catch (e) {
            console.error('[Job Form Filler] Error filling field:', e);
            return false;
        }
    }

    // Handle Select elements (Dropdowns)
    function fillSelect(select, value) {
        const lowerValue = value.toLowerCase();
        let matched = false;

        // Try to match value or text content of options
        Array.from(select.options).forEach((option, index) => {
            if (matched) return;
            const optText = option.text.toLowerCase();
            const optValue = option.value.toLowerCase();

            // Exact or partial match
            // Avoiding generic "select" or "choose" options usually at index 0
            if (index === 0 && (optText.includes('select') || optText.includes('choose'))) return;

            if (optValue === lowerValue || optText === lowerValue || optText.includes(lowerValue)) {
                select.selectedIndex = index;
                matched = true;
            }
        });

        // Special handling for Country codes if exact match fails
        // e.g. input "+1", option "United States (+1)"
        if (!matched && value.startsWith('+')) {
            Array.from(select.options).forEach((option, index) => {
                if (matched) return;
                if (option.text.includes(value)) {
                    select.selectedIndex = index;
                    matched = true;
                }
            });
        }

        if (matched) {
            // Dispatch change specifically for selects
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return matched;
    }

    // Add visual cues
    function highlightField(input) {
        input.style.backgroundColor = CONFIG.highlightColor;
        input.style.borderColor = CONFIG.borderColor;
        input.style.transition = 'background-color 0.5s ease';

        // Remove highlight after a while
        setTimeout(() => {
            input.style.backgroundColor = '';
            input.style.borderColor = '';
        }, 1500);
    }

    // Mutation Observer for dynamic pages
    function observeMutations() {
        let timeout;
        const observer = new MutationObserver((mutations) => {
            // Debounce
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                fillForms();
            }, CONFIG.debounceTime);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Listen for manual trigger from popup if needed (optional)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'trigger_fill') {
            fillForms();
            sendResponse({ status: 'done' });
        }
    });

    // Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
