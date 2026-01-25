# Chrome Helpers

A productivity-focused Chrome Extension designed to streamline your web experience.

## Features

### 1. YouTube Shorts Remover
Clean up your YouTube experience by removing Shorts from all areas of the site.
- **Removes from Sidebar**: Hides the "Shorts" tab.
- **Clean Subscriptions**: Filters out Shorts from your subscription feed.
- **Search & Home**: Removes Shorts shelves and results.
- **Redirect**: Automatically redirects Shorts URLs to the standard video player if accessed directly.

### 2. Job Form Filler
Simplify job applications with a one-click profile filler.
- **One-Time Setup**: Enter your personal, contact, and professional details once in the settings.
- **Manual Trigger**: Click "Fill Form" in the extension popup to auto-fill supported fields on any job application page.
- **Smart Matching**: Uses heuristics to identify common fields like First Name, Email, LinkedIn URL, etc.
- **Safe**: Data is stored locally in your browser (`chrome.storage.local`) and never transmitted elsewhere.

## Installation

1. Clone this repository:
   ```bash
   git clone git@github.com:s-aravindh/chrome-helpers.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the directory where you cloned the repository.

## Usage

1. **Job Form Filler**:
   - Click the extension icon.
   - Click the **Gear Icon (⚙️)** next to Job Form Filler to configure your profile.
   - When on a job application page, open the extension popup and click **Fill Form**.

2. **YouTube Shorts**:
   - The blocking is active by default.
   - Toggle it on/off via the extension popup switch.

## Architecture

This project follows a modular architecture for better maintainability:
- `modules/`: Contains isolated feature logic.
    - `youtube-shorts-remover/`: Content scripts and styles for YouTube.
    - `job-form-filler/`: Content scripts and settings UI for form filling.
- `popup.html/js/css`: Shared extension popup interface.
- `manifest.json`: Manifest V3 configuration.

## Data Privacy
All data entered into the Job Form Filler is stored locally on your device using the Chrome Storage API. No data is collected or sent to external servers.