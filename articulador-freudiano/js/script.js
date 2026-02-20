// DOM Elements
const concept1Select = document.getElementById('concept1');
const concept2Select = document.getElementById('concept2');
const articulateBtn = document.getElementById('articulateBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultArea = document.getElementById('resultArea');
const contentDiv = document.getElementById('content');
const articulationTitle = document.getElementById('articulationTitle');
const apiKeyInput = document.getElementById('apiKeyInput');

// Default API Key from PDF Didactico (as requested)
const DEFAULT_API_KEY = "AIzaSyCU1hSocX-ST1GFSK0pCySmWV_4k_gaWZI";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    loadSettings();
    checkButtonState();
});

// Event Listeners
concept1Select.addEventListener('change', checkButtonState);
concept2Select.addEventListener('change', checkButtonState);
articulateBtn.addEventListener('click', generateArticulation);

function populateSelects() {
    freudianConcepts.sort().forEach(concept => {
        const option1 = new Option(concept, concept);
        const option2 = new Option(concept, concept);
        concept1Select.add(option1);
        concept2Select.add(option2);
    });
}

function checkButtonState() {
    const c1 = concept1Select.value;
    const c2 = concept2Select.value;

    // Validate: Both selected and different
    if (c1 && c2 && c1 !== c2) {
        articulateBtn.disabled = false;
        articulateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        articulateBtn.disabled = true;
        articulateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function loadSettings() {
    const storedKey = localStorage.getItem('geminiApiKey');
    if (storedKey) {
        apiKeyInput.value = storedKey;
    } else {
        apiKeyInput.value = DEFAULT_API_KEY; // Use default if none stored (auto-save not triggered to respect privacy, but field pre-filled)
    }
}

function saveSettings() {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('geminiApiKey', key);
        alert('Configuración guardada.');
        document.getElementById('settingsModal').classList.add('hidden');
    }
}

async function generateArticulation() {
    const c1 = concept1Select.value;
    const c2 = concept2Select.value;
    const apiKey = apiKeyInput.value.trim() || DEFAULT_API_KEY;

    if (!apiKey) {
        alert("Por favor, configura una API Key válida en los ajustes.");
        return;
    }

    // UI Updates
    setLoading(true);
    resultArea.classList.add('hidden');

    try {
        const prompt = buildPrompt(c1, c2);
        const responseText = await callGeminiAPI(apiKey, prompt);

        // Render
        renderResponse(c1, c2, responseText);

    } catch (error) {
        console.error("Error:", error);
        alert("Hubo un error al generar la articulación: " + error.message);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        articulateBtn.disabled = true;
        document.querySelector('#articulateBtn span.relative').classList.add('opacity-0');
        loadingSpinner.classList.remove('hidden');
    } else {
        articulateBtn.disabled = false;
        document.querySelector('#articulateBtn span.relative').classList.remove('opacity-0');
        loadingSpinner.classList.add('hidden');
    }
}

function buildPrompt(c1, c2) {
    return `
        Rol: Sos una inteligencia artificial que actúa como asistente teórico-pedagógico especializado en Freud, con formación en historia del psicoanálisis, lectura crítica de textos freudianos y didáctica en nivel superior.
        No sos divulgador simplificador ni terapeuta. Tu función es articular conceptos, no definirlos aisladamente.

        Tarea: Construir una articulación conceptual entre "${c1}" y "${c2}", respetando la complejidad del pensamiento freudiano y sus tensiones internas.

        Formato de respuesta (Markdown):
        Organizá la respuesta en estas cinco secciones con estos subtítulos exactos:

        ### Coordenadas históricas
        Ubica temporalmente el surgimiento de cada concepto (años clave) y menciona los textos fundamentales donde Freud los trabaja. Señalá si pertenecen a la primera o segunda tópica, o si hubo virajes importantes en su conceptualización.

        ### Definiciones situadas
        Brinda una definición sintética y rigurosa de cada concepto por separado ("${c1}" y "${c2}"), basándote en la acepción más clásica o consolidada de la obra freudiana.

        ### Zona de contacto
        Explicá brevemente cómo y por qué estos dos conceptos se vinculan en la teoría freudiana. No repitas definiciones de manual. Mostrá la relación.

        ### Zona de tensión
        Señalá un problema teórico, ambigüedad o dificultad que surge al pensarlos juntos. Si Freud modificó su posición a lo largo del tiempo, indicálo.

        ### Efectos explicativos
        Mostrá qué fenómenos (clínicos, culturales, educativos o subjetivos) se comprenden mejor cuando estos conceptos se articulan.

        ### Advertencia epistemológica
        Incluí una nota breve aclarando límites, cambios históricos, o posibles lecturas alternativas.

        Estilo: Lenguaje claro, riguroso y docente. Evitá dogmatismos.
        Extensión: Entre 200 y 350 palabras.
        Cierre: Una pregunta abierta para seguir pensando.
    `;
}

async function callGeminiAPI(apiKey, prompt) {
    let candidates = [];

    // Prioritization scoring
    const getModelScore = (m) => {
        const name = m.name.toLowerCase();
        let score = 0;
        if (name.includes('2.0')) score += 1000;
        if (name.includes('1.5')) score += 500;
        if (name.includes('flash')) score += 100;
        if (name.includes('pro')) score += 50;
        if (name.includes('exp') || name.includes('beta')) score -= 10;
        return score;
    };

    try {
        // Try to list models from both v1 and v1beta to find the latest
        const endpoints = ['v1', 'v1beta'];
        const modelMaps = await Promise.all(endpoints.map(async (v) => {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/${v}/models?key=${apiKey}`);
                const data = await res.json();
                return (data.models || []).map(m => ({ ...m, apiVersion: v }));
            } catch (e) {
                console.warn(`Failed to list from ${v}:`, e);
                return [];
            }
        }));

        const allModels = modelMaps.flat();

        if (allModels.length > 0) {
            candidates = allModels
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .sort((a, b) => getModelScore(b) - getModelScore(a));
        }
    } catch (e) {
        console.warn("Dynamic model listing failed, using fallbacks:", e);
    }

    // Comprehensive Fallbacks (trying both v1 and v1beta for maximum compatibility)
    if (candidates.length === 0) {
        candidates = [
            { name: 'models/gemini-2.0-flash', version: 'v1' },
            { name: 'models/gemini-2.0-flash', version: 'v1beta' },
            { name: 'models/gemini-1.5-flash', version: 'v1' },
            { name: 'models/gemini-1.5-flash', version: 'v1beta' },
            { name: 'models/gemini-1.5-pro', version: 'v1beta' },
            { name: 'models/gemini-1.5-pro', version: 'v1' }
        ];
    }

    let lastError = null;
    for (const model of candidates) {
        const modelName = model.name.startsWith('models/') ? model.name : `models/${model.name}`;

        // If version is specified, we try that first; otherwise we try v1beta as it's often more permissive
        const versionsToTry = model.apiVersion ? [model.apiVersion] : ['v1beta', 'v1'];

        for (const v of versionsToTry) {
            console.log(`Trying model: ${modelName} via ${v}`);

            try {
                const url = `https://generativelanguage.googleapis.com/${v}/${modelName}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });

                let d = await res.json();

                if (!res.ok) {
                    // If 404 or 400, it might just be the wrong version for this model, so we continue to the next version/model
                    if (res.status === 404 || res.status === 400) {
                        console.warn(`Model ${modelName} not found or error on ${v}:`, d.error?.message);
                        lastError = d.error?.message || `Error ${res.status}`;
                        continue;
                    }

                    if (res.status === 403 && d.error?.message?.includes('API key not valid')) {
                        throw new Error("La API Key no es válida o tiene restricciones de dominio (Referrer). Verifica que 'github.io' esté permitida.");
                    }
                    throw new Error(d.error?.message || `Error HTTP ${res.status}`);
                }

                if (d.candidates && d.candidates[0] && d.candidates[0].content) {
                    console.log(`Success with: ${modelName} (${v})`);
                    return d.candidates[0].content.parts[0].text;
                }
            } catch (e) {
                console.warn(`Failed ${modelName} on ${v}:`, e.message);
                lastError = e.message;
                // If it's a domain/key error, we stop and show it
                if (e.message.includes('API Key') || e.message.includes('Referrer')) throw e;
            }
        }
    }

    throw new Error(`No se pudo conectar con la IA. Último error: ${lastError}`);
}

function renderResponse(c1, c2, text) {
    articulationTitle.innerHTML = `<span class="text-freud-600">${c1}</span> <span class="mx-2 text-slate-300">/</span> <span class="text-freud-600">${c2}</span>`;
    contentDiv.innerHTML = marked.parse(text);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Global error handler for initialization issues (e.g., data.js not loading)
window.addEventListener('error', function (e) {
    if (e.message.includes('freudianConcepts') || e.target.src && e.target.src.includes('data.js')) {
        alert("Error crítico: No se pudieron cargar los datos de la aplicación. Por favor verifica que todos los archivos (especialmente js/data.js) se hayan subido correctamente a GitHub.");
    }
});
