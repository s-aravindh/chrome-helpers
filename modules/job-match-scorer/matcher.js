
// Logic to interact with Gemini API - Streaming implementation to avoid timeouts

const BASE_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent";
const DEFAULT_MODEL = "gemini-1.5-pro";

// Helper to handle streaming response parsing
async function handleStreamResponse(response) {
    if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(jsonStr);
                    const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textPart) accumulatedText += textPart;
                } catch (e) { }
            }
        }
    }
    return accumulatedText;
}

// 1. One-shot Analysis
export async function analyzeJobMatch(apiKey, resumeText, jobDescription, modelId = DEFAULT_MODEL) {
    if (!apiKey) throw new Error("API Key is missing.");
    if (!resumeText) throw new Error("Resume content is missing.");

    const endpoint = BASE_URL_TEMPLATE.replace("{MODEL}", modelId);

    const prompt = `
    Role: You are an expert ATS (Application Tracking System) and Career Coach.

    Task: Analyze the fit between the candidate's RESUME and the JOB DESCRIPTION.

    RESUME:
    "${resumeText.substring(0, 30000)}"

    JOB DESCRIPTION:
    "${jobDescription.substring(0, 30000)}"

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

    try {
        const response = await fetch(`${endpoint}?alt=sse&key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const fullText = await handleStreamResponse(response);
        if (!fullText) throw new Error("No content generated.");

        // Clean JSON
        let cleanJson = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonStart = cleanJson.indexOf('{');
        const jsonEnd = cleanJson.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
        }
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Job Match Error:", error);
        throw error;
    }
}

// 2. Chat Session (Multi-turn)
// Yields chunks for real-time UI updates
export async function* streamChat(apiKey, history, modelId = DEFAULT_MODEL) {
    const endpoint = BASE_URL_TEMPLATE.replace("{MODEL}", modelId);

    const response = await fetch(`${endpoint}?alt=sse&key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: history
        })
    });

    if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(jsonStr);
                    const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textPart) yield textPart;
                } catch (e) { }
            }
        }
    }
}
