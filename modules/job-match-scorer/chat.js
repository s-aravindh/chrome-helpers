
import { streamChat } from './matcher.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const elements = {
        resumeView: document.getElementById('resume-view'),
        jobView: document.getElementById('job-view'),
        promptView: document.getElementById('prompt-view'),
        contextTabs: document.querySelectorAll('.tab-btn'),
        chatArea: document.getElementById('messages-area'),
        input: document.getElementById('user-input'),
        sendBtn: document.getElementById('send-btn'),
        clearBtn: document.getElementById('clear-chat'),
        modelBadge: document.getElementById('current-model'),
        updateContextBtn: document.getElementById('update-context-btn')
    };

    // State
    const state = {
        history: [], // [{ role: 'user', parts: [{ text: ... }] }]
        apiKey: null,
        modelId: null
    };

    // Initialize
    async function init() {
        // Debug Markdown Library Loading
        if (typeof marked === 'undefined' && typeof window.marked === 'undefined') {
            console.error('Marked library not loaded!');
            appendMessage('system', 'Warning: Markdown rendering library failed to load. Responses will be raw text.');
        } else {
            console.log('Marked library loaded successfully.');
        }

        const data = await chrome.storage.local.get(['chatContext', 'geminiApiKey', 'selectedModel']);

        if (!data.geminiApiKey || !data.chatContext) {
            appendMessage('system', 'Error: Missing API Key or Analysis Context. Please run an analysis via the popup first.');
            return;
        }

        state.apiKey = data.geminiApiKey;
        state.modelId = data.selectedModel || 'gemini-1.5-pro';
        elements.modelBadge.textContent = state.modelId;

        const { resumeText, jobDescription, initialOutput } = data.chatContext;

        // Render Sidebar
        elements.resumeView.textContent = resumeText || "No resume found.";
        elements.jobView.textContent = jobDescription || "No job description found.";

        // Construct Initial History
        // Turn 1: The big Prompt (must match matcher.js prompt exactly)
        const initialPrompt = `
        Role: You are an expert ATS (Application Tracking System) and Career Coach.

        Task: Analyze the fit between the candidate's RESUME and the JOB DESCRIPTION.

        RESUME:
        "${(resumeText || '').substring(0, 30000)}"

        JOB DESCRIPTION:
        "${(jobDescription || '').substring(0, 30000)}"

        Output Format: JSON only.
        {
            "matchScore": number (0-100),
            "keyMatchingSkills": ["skill1", "skill2"],
            "missingCriticalSkills": ["skill1", "skill2"],
            "improvementTips": ["tip1", "tip2", "tip3"],
            "summary": "1-2 sentence verdict."
        }
        Never include markdown blocks like \`\`\`json. Just the raw JSON.
        `;

        // Update Prompt View
        elements.promptView.textContent = initialPrompt;

        state.history.push({ role: 'user', parts: [{ text: initialPrompt }] });

        // Turn 2: The Model's JSON Response (re-injected as model response so chat knows context)
        state.history.push({ role: 'model', parts: [{ text: JSON.stringify(initialOutput) }] });

        // Show welcome message
        appendMessage('ai', "I've analyzed your fit for this role. What would you like to know? I can help rewrite sections, explain gaps, or prepare for interviews.");
    }

    // UI Handlers
    elements.contextTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.contextTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-content pre').forEach(el => el.classList.remove('active'));
            document.getElementById(`${tabName}-view`).classList.add('active');
        });
    });

    elements.sendBtn.addEventListener('click', sendMessage);
    elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.clearBtn.addEventListener('click', () => {
        if (confirm('Clear chat history?')) {
            location.reload();
        }
    });

    elements.updateContextBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('modules/job-match-scorer/settings.html') });
    });

    // Chat Logic
    async function sendMessage() {
        const text = elements.input.value.trim();
        if (!text) return;

        // UI Updates
        elements.input.value = '';
        appendMessage('user', text);
        elements.sendBtn.disabled = true;

        // Add to history
        state.history.push({ role: 'user', parts: [{ text: text }] });

        // Stream Response
        const aiMsgDiv = appendMessage('ai', '');
        const contentDiv = aiMsgDiv.querySelector('.content');
        contentDiv.textContent = 'Thinking...';

        let fullResponse = "";

        try {
            const stream = streamChat(state.apiKey, state.history, state.modelId);
            let firstChunk = true;

            for await (const chunk of stream) {
                if (firstChunk) {
                    contentDiv.textContent = ''; // Clear "Thinking..."
                    firstChunk = false;
                }
                fullResponse += chunk;
                // Render Markdown on the fly (might be jittery but better than raw)
                /* 
                   Note: Streaming markdown is tricky. Simple concatenation + marked.parse 
                   works reasonably well for small chunks but can break matching (e.g. `**word`).
                   For now, we just update the text and render at the end?
                   No, user wants to see it stream.
                   We will set innerHTML on every chunk.
                */
                const md = (window.marked && window.marked.parse) ? window.marked.parse(fullResponse) : fullResponse;
                contentDiv.innerHTML = md;

                elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
            }

            // Add final response to history
            state.history.push({ role: 'model', parts: [{ text: fullResponse }] });

        } catch (error) {
            contentDiv.textContent += `\n[Error: ${error.message}]`;
        } finally {
            elements.sendBtn.disabled = false;
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;

        let htmlContent = text;

        // Try global marked first
        if (window.marked && window.marked.parse) {
            htmlContent = window.marked.parse(text);
        } else if (typeof marked !== 'undefined' && marked.parse) {
            htmlContent = marked.parse(text);
        }

        div.innerHTML = `<div class="content">${htmlContent}</div>`;
        elements.chatArea.appendChild(div);
        elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
        return div;
    }

    init();
});
