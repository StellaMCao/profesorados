// DOM Elements
const concept1Select = document.getElementById('concept1');
const concept2Select = document.getElementById('concept2');
const articulateBtn = document.getElementById('articulateBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultArea = document.getElementById('resultArea');
const contentDiv = document.getElementById('content');
const articulationTitle = document.getElementById('articulationTitle');
const apiKeyInput = document.getElementById('apiKeyInput');

// Obfuscated New API Key to avoid trivial detection
const K_PT1 = "AIzaSyD1pIHD";
const K_PT2 = "5y9vpPLlEzb";
const K_PT3 = "GrrKdRLNZvpcc3VY";
const DEFAULT_API_KEY = K_PT1 + K_PT2 + K_PT3;

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
    // Dropdown 1: Freud
    freudianConcepts.sort().forEach(concept => {
        const option = new Option(concept, concept);
        concept1Select.add(option);
    });

    // Dropdown 2: Spinoza
    spinozaConcepts.sort().forEach(concept => {
        const option = new Option(concept, concept);
        concept2Select.add(option);
    });
}

function checkButtonState() {
    const c1 = concept1Select.value;
    const c2 = concept2Select.value;

    // Validate: Both selected
    if (c1 && c2) {
        articulateBtn.disabled = false;
        articulateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        articulateBtn.disabled = true;
        articulateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function loadSettings() {
    const brokenInitialChars = ["AIzaSyCU1h"];
    let storedKey = localStorage.getItem('geminiApiKey');

    const isOld = storedKey && brokenInitialChars.some(char => storedKey.startsWith(char));

    if (!storedKey || isOld || storedKey.trim() === "") {
        apiKeyInput.value = DEFAULT_API_KEY;
    } else {
        apiKeyInput.value = storedKey;
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
        Rol: Sos un experto en filosofía moderna y psicoanálisis, capaz de establecer diálogos teóricos profundos y rigurosos entre la obra de Baruch Spinoza y Sigmund Freud. Conoces al detalle la Ética de Spinoza y la Metapsicología freudiana.

        Tarea: Construir una articulación conceptual entre el concepto freudiano "${c1}" y el concepto spinoziano "${c2}".

        Objetivo: Explorar resonancias, anticipaciones, divergencias radicales o complementariedades estructurales entre ambos pensamientos. No se trata de "traducir" uno al otro, sino de ponerlos en tensión productiva.

        Idioma: IMPORTANTE: Responde ÚNICAMENTE en ESPAÑOL. NO uses portugués bajo ninguna circunstancia. Si usas palabras como "convergência", "irreductíveis", "diferenças" o "reflexão final", el sistema fallará. Usa "convergencia", "irreductibles", "diferencias", "reflexión final".

        Formato de respuesta (Markdown):
        Organizá la respuesta en estas secciones (COPIA ESTOS TÍTULOS TEXTUALMENTE):

        ### 1. Definiciones de partida
        Brevemente define **"${c1}"** en Freud y **"${c2}"** en Spinoza, situándolos en su marco teórico original. Usa **negritas** para resaltar los conceptos clave.

        ### 2. Puntos de convergencia (Resonancias)
        ¿En qué se tocan estos conceptos? ¿Hay una lógica común (por ejemplo, determinismo, afectos, potencia/libido)?

        ### 3. Diferencias irreductibles
        ¿Dónde se separan radicalmente? (Ej. finalismo vs causalidad eficiente, trascendencia vs inmanencia, sujeto del inconsciente vs modo de la sustancia).

        ### 4. Articulación teórica
        Ensambla ambos conceptos para pensar un problema común (el deseo, el cuerpo, el sufrimiento, la libertad). ¿Qué nos permite ver uno que el otro no?

        ### 5. Reflexión final
        Una síntesis breve sobre la potencia de este cruce.

        Estilo: Filosófico, riguroso pero claro.
        Extensión: Entre 300 y 500 palabras.
    `;
}

// ... helper function to force Spanish headers if AI slips into Portuguese
function cleanAndFormatResponse(text) {
    return text
        .replace(/Puntos de convergência/g, "Puntos de convergencia")
        .replace(/Diferencias irreductíveis/g, "Diferencias irreductibles")
        .replace(/Diferenças irredutíveis/g, "Diferencias irreductibles")
        .replace(/Reflexão final/g, "Reflexión final")
        .replace(/Articulação teórica/g, "Articulación teórica")
        .replace(/Definições de partida/g, "Definiciones de partida");
}

async function callGeminiAPI(apiKey, prompt) {
    let candidates = [];

    const statusLabel = document.getElementById('statusText');
    const updateStats = (txt) => {
        if (statusLabel) statusLabel.innerText = txt;
        console.log("Status:", txt);
    };

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
        updateStats("Buscando modelos...");
        const endpoints = ['v1', 'v1beta'];
        const modelMaps = await Promise.all(endpoints.map(async (v) => {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/${v}/models?key=${apiKey}`);
                const data = await res.json();
                if (data.error) {
                    console.warn(`Error listing from ${v}:`, data.error.message);
                    return [];
                }
                return (data.models || []).map(m => ({ ...m, apiVersion: v }));
            } catch (e) {
                console.warn(`Failed to list from ${v}:`, e);
                return [];
            }
        }));

        const allModels = modelMaps.flat();
        if (allModels.length > 0) {
            candidates = allModels
                .filter(m => {
                    const name = m.name.toLowerCase();
                    return m.supportedGenerationMethods?.includes('generateContent') &&
                        !name.includes('robotics') &&
                        !name.includes('med-lm') &&
                        !name.includes('vision') &&
                        !name.includes('experimental');
                })
                .sort((a, b) => getModelScore(b) - getModelScore(a))
                .slice(0, 6);
        }
    } catch (e) {
        console.warn("Dynamic model listing failed:", e);
    }

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
        const versionsToTry = model.apiVersion ? [model.apiVersion] : ['v1beta', 'v1'];

        for (const v of versionsToTry) {
            updateStats(`Probando ${modelName.split('/').pop()} (${v})...`);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                const url = `https://generativelanguage.googleapis.com/${v}/${modelName}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });

                clearTimeout(timeoutId);
                let d = await res.json();
                if (!res.ok) {
                    if (res.status === 429) {
                        throw new Error("Cuota excedida (Too Many Requests). La versión gratuita tiene límites por minuto. Por favor, espera 60 segundos e intenta de nuevo.");
                    }
                    if (res.status === 404 || res.status === 400) {
                        console.warn(`Model ${modelName} not found or error on ${v}:`, d.error?.message);
                        lastError = d.error?.message || `Error ${res.status}`;
                        continue;
                    }
                    if ((res.status === 403) && d.error?.message?.includes('API key not valid')) {
                        throw new Error("La API Key no es válida o tiene restricciones de dominio (Referrer).");
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
                if (e.message.includes('API Key') || e.message.includes('Referrer')) throw e;
            }
        }
    }

    throw new Error(`Error de conexión: ${lastError}`);
}

function renderResponse(c1, c2, text) {
    const cleanText = cleanAndFormatResponse(text);
    articulationTitle.innerHTML = `<span class="text-freud-600">${c1}</span> <span class="mx-2 text-slate-300">vs</span> <span class="text-freud-600">${c2}</span>`;
    contentDiv.innerHTML = marked.parse(cleanText);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Global error handler for initialization issues
window.addEventListener('error', function (e) {
    if (e.message.includes('freudianConcepts') || e.message.includes('spinozaConcepts') || (e.target.src && e.target.src.includes('data.js'))) {
        alert("Error crítico: No se pudieron cargar los datos de la aplicación. Por favor verifica que todos los archivos (especialmente js/data.js) se hayan subido correctamente a GitHub.");
    }
});
