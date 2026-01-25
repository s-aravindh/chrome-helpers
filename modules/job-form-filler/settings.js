document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('profileForm');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved data
    chrome.storage.local.get(['jobFillerProfile'], (result) => {
        if (result.jobFillerProfile) {
            Object.entries(result.jobFillerProfile).forEach(([key, value]) => {
                const input = document.getElementById(key);
                if (input) {
                    input.value = value;
                }
            });
        }
    });

    // Save data
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBtn.textContent = 'Saving...';

        const formData = new FormData(form);
        const profile = {};

        formData.forEach((value, key) => {
            profile[key] = value;
        });

        chrome.storage.local.set({ jobFillerProfile: profile }, () => {
            saveBtn.textContent = 'Save Profile';
            status.classList.add('visible');
            setTimeout(() => {
                status.classList.remove('visible');
            }, 3000);
        });
    });
});
