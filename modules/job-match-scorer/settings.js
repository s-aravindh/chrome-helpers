
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const apiKeyInput = document.getElementById('apiKey');
    const resumeInput = document.getElementById('resume');
    const modelInput = document.getElementById('modelSelect');
    const fetchModelsBtn = document.getElementById('fetchModelsBtn');

    // Load saved data
    chrome.storage.local.get(['geminiApiKey', 'userResume', 'selectedModel', 'cachedModels'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.userResume) {
            resumeInput.value = result.userResume;
        }

        // Populate models if cached
        if (result.cachedModels && result.cachedModels.length > 0) {
            populateModelSelect(result.cachedModels);
        }

        if (result.selectedModel) {
            // If the saved model isn't in the list (e.g. was default), keep it or add it
            if (!modelExists(modelInput, result.selectedModel)) {
                const opt = document.createElement('option');
                opt.value = result.selectedModel;
                opt.textContent = result.selectedModel + " (Saved)";
                modelInput.appendChild(opt);
            }
            modelInput.value = result.selectedModel;
        }
    });

    // Helper: Check if option exists
    function modelExists(select, value) {
        return Array.from(select.options).some(o => o.value === value);
    }

    // Helper: Populate Select
    function populateModelSelect(models) {
        // Clear existing except default if needed, or clear all
        modelInput.innerHTML = '';

        models.forEach(model => {
            // Filter: name looks like "models/gemini-..."
            // Display name: "gemini-1.5-pro-latest"
            const name = model.name.replace('models/', '');
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = model.displayName || name;
            modelInput.appendChild(opt);
        });

        // Try to select gemini-1.5-pro if available and nothing selected
        if (!modelInput.value && modelExists(modelInput, 'gemini-1.5-pro')) {
            modelInput.value = 'gemini-1.5-pro';
        }
    }

    // Fetch Models
    fetchModelsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter a Gemini API Key first.');
            return;
        }

        fetchModelsBtn.textContent = 'Loading...';
        fetchModelsBtn.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Failed to fetch models');
            }

            const data = await response.json();

            // Filter models that support generateContent
            const models = (data.models || []).filter(m =>
                m.supportedGenerationMethods &&
                m.supportedGenerationMethods.includes('generateContent') &&
                m.name.includes('gemini') // Good heuristic to avoid PaLM legacy if any
            );

            // Sort newest first (naive sort by version number usually works, or keep API order)
            models.sort((a, b) => b.name.localeCompare(a.name));

            populateModelSelect(models);

            // Cache models
            chrome.storage.local.set({ cachedModels: models });

            alert(`Loaded ${models.length} models.`);

        } catch (error) {
            console.error(error);
            alert(`Error fetching models: ${error.message}`);
        } finally {
            fetchModelsBtn.textContent = 'Fetch Models';
            fetchModelsBtn.disabled = false;
        }
    });

    // Save data
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBtn.textContent = 'Saving...';

        const apiKey = apiKeyInput.value.trim();
        const resume = resumeInput.value.trim();
        const model = modelInput.value;

        chrome.storage.local.set({
            geminiApiKey: apiKey,
            userResume: resume,
            selectedModel: model
        }, () => {
            saveBtn.textContent = 'Save Configuration';
            status.classList.add('visible');
            setTimeout(() => {
                status.classList.remove('visible');
            }, 3000);
        });
    });
});
