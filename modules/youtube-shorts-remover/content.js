// Chrome Helpers - YouTube Shorts Remover Content Script

// --- CONFIGURATION ---
const CONFIG = {
    DEBOUNCE_DELAY: 300, // ms - delay before processing DOM changes
    STYLE_ID: 'chrome-helpers-shorts-remover-style',
    BLOCKED_PAGE_ID: 'chrome-helpers-shorts-blocked-message',
    LOG_PREFIX: '[Chrome Helpers - Shorts Remover]'
};

// Performance monitoring
let stats = {
    elementsHidden: 0,
    lastCheck: Date.now()
};

// --- SELECTORS ---
// Comprehensive selectors to target all Shorts variations
const SHORTS_SELECTORS = [
    // Home feed & Browse
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-reel-shelf-renderer',

    // Shorts player page
    'ytd-browse[page-subtype="shorts"]',

    // Search results
    'ytd-video-renderer:has(a[href*="/shorts/"])',
    'ytd-grid-video-renderer:has(a[href*="/shorts/"])',

    // Subscription feed
    'ytd-grid-renderer:has(ytd-grid-video-renderer a[href*="/shorts/"])',

    // Thumbnails with Shorts badge
    'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',

    // Mobile-style player
    'ytd-reel-video-renderer',

    // Additional shelf renderers
    'ytd-rich-section-renderer:has([is-shorts])',

    // Shorts tab in channel pages
    'yt-tab-shape:has(a[href*="/shorts"])',
    'tp-yt-paper-tab:has(a[href*="/shorts"])'
];

// --- UTILITY FUNCTIONS ---
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function logInfo(message, data = null) {
    if (data) {
        console.log(`${CONFIG.LOG_PREFIX} ${message}`, data);
    } else {
        console.log(`${CONFIG.LOG_PREFIX} ${message}`);
    }
}

function logError(message, error = null) {
    if (error) {
        console.error(`${CONFIG.LOG_PREFIX} ${message}`, error);
    } else {
        console.error(`${CONFIG.LOG_PREFIX} ${message}`);
    }
}

// --- STYLES INJECTION ---
function getStyles() {
    return `
        /* Hide all Shorts elements */
        ${SHORTS_SELECTORS.join(',\n        ')} {
            display: none !important;
        }
        
        /* Hide Sidebar Items via CSS - using :has() with valid selectors */
        ytd-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer:has(a[title="Shorts"]) {
            display: none !important;
        }
        
        /* Hide Shorts tab in channel pages */
        tp-yt-paper-tab[aria-label*="Shorts"],
        yt-tab-shape[tab-title*="Shorts"] {
            display: none !important;
        }
        
        /* Blocked page message styling */
        #${CONFIG.BLOCKED_PAGE_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            color: #fff;
            font-family: 'Roboto', 'YouTube Sans', sans-serif;
        }
        
        #${CONFIG.BLOCKED_PAGE_ID} .icon {
            font-size: 80px;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        #${CONFIG.BLOCKED_PAGE_ID} h1 {
            font-size: 32px;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: #ff6b6b;
        }
        
        #${CONFIG.BLOCKED_PAGE_ID} p {
            font-size: 18px;
            margin: 0;
            opacity: 0.8;
            max-width: 500px;
            text-align: center;
            line-height: 1.6;
        }
        
        #${CONFIG.BLOCKED_PAGE_ID} .home-link {
            margin-top: 30px;
            padding: 12px 30px;
            background: #ff6b6b;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        
        #${CONFIG.BLOCKED_PAGE_ID} .home-link:hover {
            background: #ff5252;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
        }
    `;
}

// --- SHORTS BLOCKING LOGIC ---
function blockShortsPage() {
    // Check if we're on a Shorts page
    if (!window.location.pathname.startsWith('/shorts/')) {
        return;
    }

    // Check if message already exists
    if (document.getElementById(CONFIG.BLOCKED_PAGE_ID)) {
        return;
    }

    // Create blocking message
    const blockedMessage = document.createElement('div');
    blockedMessage.id = CONFIG.BLOCKED_PAGE_ID;
    blockedMessage.innerHTML = `
        <div class="icon">🚫</div>
        <h1>YouTube Shorts Blocked</h1>
        <p>This content type has been blocked by Chrome Helpers.<br>Shorts are not available while this extension is active.</p>
        <a href="/" class="home-link">← Return to YouTube Home</a>
    `;

    // Append to body with null check
    if (document.body) {
        document.body.appendChild(blockedMessage);
        logInfo('Shorts page blocked - displaying message');
    } else {
        logError('document.body is null, cannot display blocked message');
    }
}

function removeShortsSidebarItems() {
    let hiddenCount = 0;

    // Find all potential sidebar entries
    const entries = document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');

    entries.forEach(entry => {
        // Skip if already hidden
        if (entry.style.display === 'none') {
            return;
        }

        // Check for link to shorts
        const link = entry.querySelector('a');
        if (link) {
            const href = link.getAttribute('href');
            const title = link.getAttribute('title');
            const ariaLabel = link.getAttribute('aria-label');

            if ((href && href.startsWith('/shorts')) ||
                (title && title.toLowerCase().includes('shorts')) ||
                (ariaLabel && ariaLabel.toLowerCase().includes('shorts'))) {
                entry.style.display = 'none';
                hiddenCount++;
                return;
            }
        }

        // Also check for text content (for cases where attributes aren't set yet)
        const textElement = entry.querySelector('yt-formatted-string');
        if (textElement) {
            const text = textElement.textContent.trim().toLowerCase();
            if (text === 'shorts') {
                entry.style.display = 'none';
                hiddenCount++;
                return;
            }
        }
    });

    if (hiddenCount > 0) {
        stats.elementsHidden += hiddenCount;
        logInfo(`Hidden ${hiddenCount} sidebar items (Total: ${stats.elementsHidden})`);
    }
}

function removeShortsVideoCards() {
    let hiddenCount = 0;

    // Find video cards that link to Shorts
    const videoCards = document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer');

    videoCards.forEach(card => {
        // Skip if already hidden
        if (card.style.display === 'none') {
            return;
        }

        const link = card.querySelector('a#thumbnail, a#video-title-link');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.includes('/shorts/')) {
                card.style.display = 'none';
                hiddenCount++;
            }
        }
    });

    if (hiddenCount > 0) {
        stats.elementsHidden += hiddenCount;
        logInfo(`Hidden ${hiddenCount} video cards (Total: ${stats.elementsHidden})`);
    }
}

function enableShortsBlocking() {
    try {
        // Wait for DOM to be ready
        if (!document.documentElement || !document.body) {
            logInfo('DOM not ready, waiting...');
            setTimeout(enableShortsBlocking, 100);
            return;
        }

        // Inject styles
        if (!document.getElementById(CONFIG.STYLE_ID)) {
            const style = document.createElement('style');
            style.id = CONFIG.STYLE_ID;
            style.textContent = getStyles();
            document.documentElement.appendChild(style);
            logInfo('Styles injected');
        }

        // Block Shorts page if applicable
        blockShortsPage();

        // Initial aggressive check - run immediately
        removeShortsSidebarItems();
        removeShortsVideoCards();

        // Run again after a short delay to catch late-loading elements
        setTimeout(() => {
            removeShortsSidebarItems();
            removeShortsVideoCards();
        }, 500);

        // And one more time after DOM is more settled
        setTimeout(() => {
            removeShortsSidebarItems();
            removeShortsVideoCards();
        }, 1500);

        // Start Observer to keep checking (with null check)
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            logInfo('Observer started');
        } else {
            logError('document.body is null, cannot start observer');
        }

        logInfo('Shorts blocking enabled', { stats });
    } catch (error) {
        logError('Failed to enable Shorts blocking', error);
    }
}

function disableShortsBlocking() {
    try {
        // Remove styles
        const style = document.getElementById(CONFIG.STYLE_ID);
        if (style) {
            style.remove();
            logInfo('Styles removed');
        }

        // Remove blocked page message
        const blockedMessage = document.getElementById(CONFIG.BLOCKED_PAGE_ID);
        if (blockedMessage) {
            blockedMessage.remove();
        }

        // Un-hide elements hidden by JS
        const entries = document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer');
        entries.forEach(entry => {
            if (entry.style.display === 'none') {
                entry.style.display = '';
            }
        });

        // Stop observer
        observer.disconnect();

        // Reset stats
        stats = { elementsHidden: 0, lastCheck: Date.now() };

        logInfo('Shorts blocking disabled');
    } catch (error) {
        logError('Failed to disable Shorts blocking', error);
    }
}

// --- OBSERVER WITH DEBOUNCING ---
const debouncedRemoval = debounce(() => {
    try {
        blockShortsPage(); // Check for Shorts page on navigation
        removeShortsSidebarItems();
        removeShortsVideoCards();
        stats.lastCheck = Date.now();
    } catch (error) {
        logError('Error during debounced removal', error);
    }
}, CONFIG.DEBOUNCE_DELAY);

const observer = new MutationObserver((mutations) => {
    debouncedRemoval();
});

function updateState(shouldHide) {
    if (shouldHide) {
        enableShortsBlocking();
    } else {
        disableShortsBlocking();
    }
}

// --- INITIALIZATION ---
function init() {
    try {
        logInfo('Initializing...');

        // 1. Initial check with error handling
        chrome.storage.local.get(['hideShorts'], (result) => {
            if (chrome.runtime.lastError) {
                logError('Storage access error', chrome.runtime.lastError);
                // Default to enabled on error
                updateState(true);
                return;
            }

            // Default to true if undefined
            const shouldHide = result.hideShorts !== false;
            logInfo(`Initial state: ${shouldHide ? 'ENABLED' : 'DISABLED'}`);
            updateState(shouldHide);
        });

        // 2. Listen for messages from Popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            try {
                if (request.action === "updateShortsVisibility") {
                    logInfo(`State change requested: ${request.shouldHide ? 'ENABLE' : 'DISABLE'}`);
                    updateState(request.shouldHide);
                    sendResponse({ success: true });
                }
            } catch (error) {
                logError('Error handling message', error);
                sendResponse({ success: false, error: error.message });
            }
        });

        // 3. Listen for URL changes (for SPA navigation)
        if (document) {
            let lastUrl = location.href;
            new MutationObserver(() => {
                const currentUrl = location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    logInfo('URL changed, re-checking Shorts');
                    debouncedRemoval();
                }
            }).observe(document, { subtree: true, childList: true });
        }

        logInfo('Initialization complete');
    } catch (error) {
        logError('Initialization failed', error);
    }
}

// Start the extension - wait for DOM to be at least partially ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already loaded
    init();
}
