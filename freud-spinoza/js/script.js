// DOM Elements
const concept1Select = document.getElementById('concept1');
const concept2Select = document.getElementById('concept2');
const articulateBtn = document.getElementById('articulateBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultArea = document.getElementById('resultArea');
const contentDiv = document.getElementById('content');
const articulationTitle = document.getElementById('articulationTitle');
const apiKeyInput = document.getElementById('apiKeyInput');

// Default API Key from PDF Didactico (as requested in original project)
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
    const storedKey = localStorage.getItem('geminiApiKey');
    if (storedKey) {
        apiKeyInput.value = storedKey;
    } else {
        apiKeyInput.value = DEFAULT_API_KEY; // Use default if none stored
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

        Formato de respuesta (Markdown):
        Organizá la respuesta en estas secciones:

        ### 1. Definiciones de partida
        Brevemente define "${c1}" en Freud y "${c2}" en Spinoza, situándolos en su marco teórico original.

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

async function callGeminiAPI(apiKey, prompt) {
    let candidates = [];

    try {
        // 1. List available models
        const listReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listReq.json();

        if (listData.models) {
            // Filter models that support content generation
            const rawModels = listData.models.filter(m =>
                m.supportedGenerationMethods &&
                m.supportedGenerationMethods.includes('generateContent')
            );

            // Sort by priority: Flash > Pro > Others
            candidates = rawModels.sort((a, b) => {
                const score = (name) => {
                    if (name.includes('flash')) return 3;
                    if (name.includes('1.5-pro')) return 2;
                    if (name.includes('gemini-pro')) return 1;
                    return 0;
                };
                return score(b.name) - score(a.name);
            });
        }
    } catch (e) {
        console.warn("Model listing failed, using fallbacks:", e);
        // Manual fallbacks if listing fails
        candidates = [
            { name: 'models/gemini-1.5-flash' },
            { name: 'models/gemini-1.5-flash-001' },
            { name: 'models/gemini-1.5-pro' },
            { name: 'models/gemini-pro' }
        ];
    }

    if (candidates.length === 0) {
        candidates = [
            { name: 'models/gemini-1.5-flash' },
            { name: 'models/gemini-1.5-flash-001' },
            { name: 'models/gemini-1.5-pro' }
        ];
    }

    // 2. Try candidates until one works
    let lastError = null;

    for (const model of candidates) {
        const modelName = model.name.startsWith('models/') ? model.name : `models/${model.name}`;
        console.log(`Trying model: ${modelName}`);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7
                    }
                })
            });

            // Parse JSON safely
            let d;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                d = await res.json();
            } else {
                const text = await res.text();
                throw new Error(`Respuesta inesperada del servidor (no es JSON): ${res.status} ${res.statusText}. Contenido: ${text.substring(0, 100)}...`);
            }

            if (!res.ok) {
                // Check specifically for domain/key restriction errors
                if (res.status === 400 || res.status === 403) {
                    if (d.error && d.error.message && d.error.message.includes('API key not valid')) {
                        throw new Error("La API Key no es válida para este sitio web. Es probable que tenga restricciones de dominio (Referrer) que bloquean 'github.io'. Necesitas agregar la URL de tu GitHub a las credenciales en Google Cloud o crear una nueva llave sin restricciones.");
                    }
                }
                if (d.error) throw new Error(d.error.message || `Error ${res.status}`);
                throw new Error(`Error HTTP ${res.status}`);
            }

            if (d.candidates && d.candidates[0] && d.candidates[0].content) {
                return d.candidates[0].content.parts[0].text;
            }
        } catch (e) {
            console.warn(`Failed ${modelName}:`, e.message);
            lastError = e.message;
        }
    }

    throw new Error(`Todos los modelos fallaron. Último error: ${lastError}`);
}

function renderResponse(c1, c2, text) {
    articulationTitle.innerHTML = `<span class="text-freud-600">${c1}</span> <span class="mx-2 text-slate-300">vs</span> <span class="text-freud-600">${c2}</span>`;
    contentDiv.innerHTML = marked.parse(text);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Global error handler for initialization issues
window.addEventListener('error', function (e) {
    if (e.message.includes('freudianConcepts') || e.message.includes('spinozaConcepts') || (e.target.src && e.target.src.includes('data.js'))) {
        alert("Error crítico: No se pudieron cargar los datos de la aplicación. Por favor verifica que todos los archivos (especialmente js/data.js) se hayan subido correctamente a GitHub.");
    }
});
