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
    // Logic adapted from pdf_didactico.html as requested
    let candidates = [];

    try {
        // 1. List available models
        const listReq = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
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
        // Fallback set if even the list was empty and no error caught (unlikely)
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
            const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;
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
                // If not JSON (e.g. 404 HTML page), treat as text/error
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
            // Continue to next model
        }
    }

    throw new Error(`Todos los modelos fallaron. Último error: ${lastError}`);
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
