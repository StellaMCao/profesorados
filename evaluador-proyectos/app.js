const SYSTEM_PROMPT = `
Rol
Actuás como evaluador técnico-institucional ESTRICTO del Consejo Directivo de un Instituto de Formación Docente. criterio es MUY RIGUROSO. TU OBJETIVO PRINCIPAL ES LA SÍNTESIS.

Tarea
Realizar una evaluación integral con puntaje de 0 a 100. SÉ BREVE Y DIRECTO. Evita introducciones largas o explicaciones teóricas innecesarias. Ve al punto en cada criterio.

FORMATO DE SALIDA OBLIGATORIO AL INICIO:
Antes de cualquier otra cosa, el informe DEBE comenzar con:
# Título del Proyecto: [Nombre del proyecto]
**Responsables:** [Nombres de los responsables]
---

Paso 1. Verificación de admisibilidad

Verificá la presencia de los siguientes elementos mínimos:

Identificación del proyecto (título, responsables, área/carrera, destinatarios).

Fundamentación o diagnóstico.

Objetivos y plan de trabajo (actividades, cronograma o fases).

Horas solicitadas (cantidad total y, si es posible, desagregadas).

Propuesta de evaluación o indicadores.

Encuadre institucional (alineación con PEI, normativa u objetivos institucionales).

CV de las personas responsables.

Si faltan dos o más ítems, indicá que el proyecto es incompleto y que el puntaje máximo queda limitado a 59 puntos, explicitando el motivo en la nota final.

Paso 2. Evaluación por criterios (con puntaje)

Evaluá el proyecto según los siguientes criterios y pesos:

Pertinencia y diagnóstico – 15 puntos (Sé exigente con la fundamentación basada en datos reales).

Coherencia interna del proyecto – 20 puntos (Los objetivos deben coincidir con las actividades y el cronograma).

Factibilidad operativa – 20 puntos (¿Es realmente realizable con los recursos actuales?).

Impacto institucional y equidad – 15 puntos.

Sustentabilidad y uso de horas – 15 puntos (¿Se justifican las horas pedidas?).

Evaluación y mejora – 10 puntos.

Pertinencia del CV de las personas responsables – 5 puntos.

Total: 100 puntos

Paso 3. Criterio específico: análisis del CV (5 puntos)

Evaluá el CV solo en función de su relación con el proyecto, no por cantidad de títulos o antigüedad general.

Considerá especialmente:

Formación y/o experiencia directamente vinculada con el tema del proyecto.

Antecedentes en proyectos similares, trabajo institucional, coordinación o extensión.

Conocimiento del nivel o del campo educativo involucrado.

Escala orientativa:

5 puntos: alta pertinencia directa con el proyecto.

3–4 puntos: pertinencia parcial o complementaria.

1–2 puntos: baja pertinencia.

0 puntos: CV ausente o sin relación con la propuesta.

Si el CV no está incluido o no puede analizarse, asigná 0 puntos en este criterio y dejalo asentado en la nota final.

Paso 4. Reglas automáticas de ajuste

Aplicá las siguientes penalizaciones si corresponde:

No se explicitan horas solicitadas: −15 puntos.

No hay cronograma o fases: −10 puntos.

No se describen indicadores o evaluación: −10 puntos.

Objetivos vagos o no operacionalizables: −5 puntos.

Bonificaciones posibles (sin superar 100):

Articulación inter-áreas o inter-carreras con acciones concretas: +3.

Evidencia de resultados previos: +3.

Estrategia clara de continuidad institucional: +2.

Paso 5. Análisis de horas

Indicá:

Horas totales solicitadas.

Horas disponibles (si se provee el dato).

Evaluación de viabilidad: viable / viable con ajustes / condicionada por disponibilidad horaria.

Paso 6. Puntaje final y categorización

Presentá:

Puntaje final: NN / 100.

Categoría:

85–100: recomendable aprobar (Reservado solo para proyectos de EXCELENCIA).

70–84: aprobar con ajustes.

60–69: solicitar ampliación o reformulación.

0–59: no recomendable o no evaluable.

Paso 7. Nota evaluativa final

Redactá una nota institucional que incluya:

Puntaje general.

Fortalezas del proyecto.

Observaciones críticas (Sé detallado en lo que falta o está mal).

Análisis de horas solicitadas vs disponibles.

Evaluación sintética de la pertinencia del CV.

Recomendación final al Consejo Directivo.

Usá un tono técnico, formal, crítico y fundado. SÉ EXTREMADAMENTE CONCISO. NO repitas información. Si algo está bien, decí "Correcto" y pasá al siguiente punto. Priorizá las listas (bullets) sobre los párrafos de texto.
`;

// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const evaluateBtn = document.getElementById('evaluateBtn');
const resultSection = document.getElementById('resultSection');
const reportContent = document.getElementById('reportContent');
const btnText = evaluateBtn.querySelector('.btn-text');
const loader = evaluateBtn.querySelector('.loader');
const availableHoursInput = document.getElementById('availableHours');

// State
let selectedFiles = [];

// Initialize
function init() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) apiKeyInput.value = savedKey;

    // Event Listeners
    apiKeyInput.addEventListener('change', (e) => localStorage.setItem('gemini_api_key', e.target.value));

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    evaluateBtn.addEventListener('click', startEvaluation);
}

// File Handling
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = [...selectedFiles, ...newFiles];
    renderFileList();
    updateButtonState();
}

function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>${file.name} (${formatSize(file.size)})</span>
            <button class="btn-small" style="color: red; border: none; background: none; cursor: pointer;" onclick="removeFile(${index})">✖</button>
        `;
        fileList.appendChild(item);
    });
}

window.removeFile = (index) => {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateButtonState();
};

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateButtonState() {
    evaluateBtn.disabled = selectedFiles.length === 0;
}

// Main Evaluation Logic
async function startEvaluation() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Por favor, ingresa tu API Key de Gemini.');
        return;
    }

    setLoading(true);
    resultSection.classList.add('hidden');

    try {
        const fileParts = await Promise.all(selectedFiles.map(fileToGenerativePart));
        const hours = availableHoursInput.value ? `Horas Disponibles: ${availableHoursInput.value}` : 'Horas Disponibles: No especificado';

        const prompt = `${SYSTEM_PROMPT}\n\nINFORMACIÓN ADICIONAL:\n${hours}`;

        const result = await callGeminiAPI(apiKey, prompt, fileParts);

        renderReport(result);
    } catch (error) {
        console.error("Evaluation error:", error);
        alert('Error durante la evaluación: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// Helper to convert File to Base64 part for Gemini
function fileToGenerativePart(file) {
    return new Promise((resolve, reject) => {
        // Handle .docx files using Mammoth
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target.result;
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then(result => {
                        resolve({
                            text: `Contenido de ${file.name}:\n${result.value}`
                        });
                    })
                    .catch(reject);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
            return;
        }

        // Handle PDF and others (Images) via Base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// API Call
// API Call
async function callGeminiAPI(apiKey, systemPrompt, fileParts) {
    // 1. Define candidates to try (Lista simplificada y robusta)
    // Priorizamos 2.5-flash (última versión), luego Flash por velocidad, y Pro por calidad.
    const candidates = [
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002'
    ];

    // 2. Prepare content
    const contents = [
        {
            role: "user",
            parts: [
                { text: systemPrompt },
                ...fileParts
            ]
        }
    ];

    const generateConfig = {
        temperature: 0.2,
        maxOutputTokens: 8192
    };

    // 3. Try candidates sequentially with retry logic
    let errors = [];
    let rateLimitHit = false;

    for (const modelName of candidates) {
        console.log(`Intentando modelo: ${modelName}`);

        try {
            const result = await tryModelWithRetries(modelName, apiKey, contents, generateConfig);
            return result;
        } catch (e) {
            console.warn(`Falló el modelo ${modelName}:`, e.message);
            errors.push(`${modelName}: ${e.message}`);

            if (e.message.includes("RATE_LIMIT") || e.message.includes("429")) {
                rateLimitHit = true;
            }
        }
    }

    // Generar un mensaje de error final más útil para el usuario
    let finalErrorMessage = "No se pudo realizar la evaluación.";

    if (rateLimitHit) {
        finalErrorMessage += " \n\n⚠️ CAUSA PROBABLE: Límite de cuota excedido (Rate Limit).\nHas realizado muchas evaluaciones seguidas y Google ha pausado temporalmente tu acceso gratuito.\n\nSOLUCIÓN: Espera 1 o 2 minutos antes de intentar de nuevo.";
    } else {
        finalErrorMessage += ` \n\nDetalle técnico de errores:\n${errors.join('\n')}`;
    }

    throw new Error(finalErrorMessage);
}

async function tryModelWithRetries(modelName, apiKey, contents, generateConfig, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: generateConfig
                })
            });

            if (response.status === 429) {
                throw new Error("RATE_LIMIT_429");
            }

            if (!response.ok) {
                const err = await response.json();
                const errorMessage = err.error?.message || `Error status ${response.status}`;

                // Si el modelo no existe (404), no tiene sentido reintentar. Lanzamos error diferente.
                if (response.status === 404 || errorMessage.includes("not found")) {
                    throw new Error(`MODEL_NOT_FOUND: ${modelName} no disponible.`);
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('La IA no devolvió ninguna respuesta (candidatos vacíos).');
            }
            return data.candidates[0].content.parts[0].text;

        } catch (e) {
            // Solo reintentamos si es Rate Limit
            if (e.message.includes("RATE_LIMIT") || e.message.includes("429")) {
                attempt++;
                if (attempt < maxRetries) {
                    const waitTime = attempt * 5000; // 5s, 10s, 15s (Aumenté el tiempo)
                    console.log(`Cuota excedida para ${modelName}. Reintentando en ${waitTime / 1000}s...`);
                    // Podríamos notificar al usuario aquí si tuvieramos un callback de estado
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
            throw e; // Otros errores o fin de reintentos
        }
    }
}

function renderReport(markdownText) {
    reportContent.innerHTML = marked.parse(markdownText);
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function setLoading(isLoading) {
    if (isLoading) {
        evaluateBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
    } else {
        evaluateBtn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

// Copy to clipboard
window.copyReport = async () => {
    try {
        const content = reportContent.innerHTML;
        // Estilos Inline para asegurar que Word los respete y reducir espacio
        // Usamos propiedades mso- específicas para Microsoft Word
        const compactStyles = `
            <style>
                body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.15; color: #000000; }
                
                h1, h2, h3 { 
                    mso-pagination: keep-with-next;
                    mso-margin-top-alt: 0pt;
                    mso-margin-bottom-alt: 0pt;
                    margin-top: 0px !important;
                    margin-bottom: 0px !important;
                    page-break-after: avoid; 
                }

                h1 { font-size: 16pt; color: #2563eb; }
                h2 { font-size: 14pt; color: #1d4ed8; }
                h3 { font-size: 12pt; font-weight: bold; }

                p { 
                    margin-top: 0px !important; 
                    margin-bottom: 0px !important; 
                    mso-margin-top-alt: 0pt;
                    mso-margin-bottom-alt: 0pt;
                }
                ul, ol { 
                    margin-top: 0px !important; 
                    margin-bottom: 0px !important; 
                    mso-margin-top-alt: 0pt;
                    mso-margin-bottom-alt: 0pt;
                    padding-left: 20px; 
                }
                li { 
                    margin-bottom: 0px !important; 
                    mso-margin-top-alt: 0pt;
                    mso-margin-bottom-alt: 0pt;
                }
                strong { font-weight: 700; color: #000; }
            </style>
        `;

        const htmlBlob = new Blob([`
            <!DOCTYPE html>
            <html>
                <head>${compactStyles}</head>
                <body>${content}</body>
            </html>
        `], { type: 'text/html' });

        const textBlob = new Blob([reportContent.innerText], { type: 'text/plain' });

        const data = [new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
        })];

        await navigator.clipboard.write(data);
        alert('Informe copiado con formato (modo compacto)');

    } catch (err) {
        console.error('Error al copiar con formato:', err);
        // Fallback simple por si falla la API de Clipboard avanzada
        try {
            await navigator.clipboard.writeText(reportContent.innerText);
            alert('Copiado como texto plano (navegador no soportó formato rico)');
        } catch (e) {
            alert('Error al copiar');
        }
    }
};

init();
