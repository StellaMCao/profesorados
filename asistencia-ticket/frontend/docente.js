// ============================================
// ESTADO GLOBAL DOCENTE
// ============================================

let docenteUser = null;
let docenteToken = null;
let currentSessions = [];
let currentSessionForDuplicate = null;
let currentEditingSessionId = null;
let questionCount = 0;

// Forzar mayúsculas en campos de código y temas
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const codeInputs = ['inputCodigo', 'dupCodigo'];
    codeInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    });
});

// ============================================
// AUTENTICACIÓN DOCENTE
// ============================================

function handleDocenteLogin(response) {
    docenteToken = response.credential;
    try {
        const payload = parseJwt(response.credential);

        docenteUser = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture
        };

        checkDocenteAuth();
    } catch (e) {
        alert('Error al procesar el token: ' + e.message);
    }
}

async function checkDocenteAuth() {
    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getSessions',
                token: docenteToken
            })
        });

        const data = await response.json();

        if (data.success) {
            showScreen('docenteDashboard');
            document.getElementById('docenteName').textContent = docenteUser.name;
            document.getElementById('docenteAvatar').src = docenteUser.picture;
            loadSessions();
        } else {
            console.error('Server error:', data.error);
            alert('Error al verificar acceso: ' + (data.error || 'Desconocido'));
        }
    } catch (error) {
        alert('Error de conexión con el servidor: ' + error.message);
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function docenteLogout() {
    docenteUser = null;
    docenteToken = null;
    currentSessions = [];
    showScreen('docenteLoginScreen');
}

// ============================================
// GESTIÓN DE SESIONES
// ============================================

async function loadSessions() {
    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getSessions',
                token: docenteToken
            })
        });

        const data = await response.json();

        if (data.success) {
            currentSessions = data.sessions || [];
            renderSessions();
        } else {
            console.error('Backend error:', data.error);
            alert('Error al cargar sesiones: ' + data.error);
        }
    } catch (error) {
        console.error('Full error details:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        alert('Error de conexión al cargar sesiones. Revisa la consola del navegador (F12) para más detalles.');
    } finally {
        showLoading(false);
    }
}

// Global para exportar
let lastSubmissions = [];
let lastMateria = '';
let lastCurso = '';

function showCreateSessionModal() {
    currentEditingSessionId = null;
    document.getElementById('modalTitle').textContent = 'Nueva Sesión';
    document.getElementById('sessionForm').reset();
    document.getElementById('questionsBuilder').innerHTML = '';
    questionCount = 0;
    document.getElementById('sessionModal').classList.add('show');
}

function closeSessionModal() {
    document.getElementById('sessionModal').classList.remove('show');
}

async function editSession(sessionId) {
    const session = currentSessions.find(s => s.session_id === sessionId);
    if (!session) return;

    currentEditingSessionId = sessionId;
    document.getElementById('modalTitle').textContent = 'Editar Sesión';

    // Poblar campos básicos
    document.getElementById('inputMateria').value = session.materia;
    document.getElementById('inputFecha').value = formatDateForInput(session.fecha);
    document.getElementById('inputFechaFin').value = formatDateForInput(session.fecha_fin || session.fecha);
    document.getElementById('inputCurso').value = session.curso;
    document.getElementById('inputHorarioInicio').value = formatTimeForInput(session.horario_inicio);
    document.getElementById('inputHorarioFin').value = formatTimeForInput(session.horario_fin);
    document.getElementById('inputCodigo').value = session.codigo;

    // Configuración avanzada
    document.getElementById('inputAceptarTardios').checked = isTrue(session.aceptar_tardios);
    document.getElementById('inputVentanaTardios').value = session.ventana_tardios || 10;
    document.getElementById('inputPermitirReenvio').checked = isTrue(session.permitir_reenvio);

    // Check if require_gps is passed on the session object
    const requireGpsCheckbox = document.getElementById('inputRequireGPS');
    if (requireGpsCheckbox) {
        requireGpsCheckbox.checked = isTrue(session.require_gps);
    }

    document.getElementById('tardiosConfig').style.display = isTrue(session.aceptar_tardios) ? 'block' : 'none';

    // Reconstruir preguntas
    document.getElementById('questionsBuilder').innerHTML = '';
    questionCount = 0;

    const preguntas = session.preguntas || [];
    try {
        const parsedPreguntas = typeof preguntas === 'string' ? JSON.parse(preguntas) : preguntas;
        parsedPreguntas.forEach(p => addQuestion(p));
    } catch (e) {
        console.error("Error parsing questions for edit:", e);
    }

    document.getElementById('sessionModal').classList.add('show');
}

function formatDateForInput(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
    if (typeof dateVal === 'string') {
        if (dateVal.includes('T')) return dateVal.split('T')[0];
        return dateVal; // asumimos YYYY-MM-DD
    }
    return '';
}

function formatTimeForInput(timeVal) {
    if (!timeVal) return '';
    if (timeVal instanceof Date) {
        return timeVal.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return timeVal; // asumimos HH:MM
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    // Si viene como string ISO completo (ej: 2026-01-23T03:00:00.000Z)
    if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Si viene como YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function formatTime(timeStr) {
    // Si es ISO timestamp, extraer solo hora:minuto
    // Si ya es "HH:MM", devolver tal cual
    if (timeStr.includes('T')) {
        const date = new Date(timeStr);
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return timeStr;
}

// Helper para normalizar booleanos (Sheets a veces devuelve TRUE, true, "true", etc)
function isTrue(value) {
    return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
}

function showHelpModal() {
    document.getElementById('helpModal').classList.add('show');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('show');
}

function renderSessions() {
    const container = document.getElementById('sessionsContainer');
    const noSessions = document.getElementById('noSessions');

    if (currentSessions.length === 0) {
        container.innerHTML = '';
        noSessions.style.display = 'block';
        return;
    }

    noSessions.style.display = 'none';

    container.innerHTML = currentSessions.map(session => {
        const isActive = isTrue(session.activa);
        const isExpired = checkIsExpired(session);

        return `
    <div class="session-card ${isActive ? 'active' : ''} ${isExpired ? 'expired' : ''}">
      <div class="session-header">
        <div class="session-materia">${session.materia}</div>
        <div class="session-status ${isExpired ? 'status-expired' : (isActive ? 'status-active' : 'status-inactive')}">
          ${isExpired ? '⌛ Expirada' : (isActive ? '🟢 Activa' : '⚪ Inactiva')}
        </div>
      </div>
      <div class="session-info-grid">
        <div><strong>Curso:</strong> ${session.curso}</div>
        <div><strong>Período:</strong> ${formatDate(session.fecha)} al ${formatDate(session.fecha_fin || session.fecha)}</div>
        <div><strong>Horario:</strong> ${formatTime(session.horario_inicio)} - ${formatTime(session.horario_fin)}</div>
        <div><strong>Código:</strong> <code>${session.codigo}</code></div>
      </div>
      <div class="session-actions">
        <button onclick="toggleSessionStatus('${session.session_id}', ${isActive})" 
                class="btn-toggle ${isActive ? 'btn-deactivate' : 'btn-activate'}">
          ${isActive ? '⏸️ Cerrar' : '▶️ Activar'}
        </button>
        <button onclick="editSession('${session.session_id}')" class="btn-edit">
          ✏️ Editar
        </button>
        <button onclick="viewSubmissions('${session.session_id}', '${session.materia}', '${session.curso}')" 
                class="btn-view">
          👁️ Ver
        </button>
        <button onclick="duplicateSession('${session.session_id}')" class="btn-duplicate" title="Duplicar">
          📋
        </button>
        <button onclick="showQrModal('${session.codigo}', '${session.materia.replace(/'/g, "\\'")}')" class="btn-activate" style="background: var(--primary);">
          📲 QR
        </button>
        <button onclick="copyDirectLinkFromSession('${session.codigo}')" class="btn-secondary" style="padding: 0.5rem;">
          🔗 Link
        </button>
        <button onclick="deleteSessionConfirm('${session.session_id}')" class="btn-delete">
          🗑️
        </button>
      </div>
    </div>
  `}).join('');
}

function parseTime(timeVal) {
    // Si es un objeto Date
    if (timeVal instanceof Date) {
        return timeVal.getHours() * 60 + timeVal.getMinutes();
    }

    // Si es un string "HH:MM"
    if (typeof timeVal === 'string') {
        const parts = timeVal.split(':');
        if (parts.length >= 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
    }

    return 0;
}

function checkIsExpired(session) {
    // Obtener la fecha y hora actual en la zona horaria de Argentina
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

    // Formatear la fecha actual a YYYY-MM-DD para comparar
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const sessionDate = formatDateForInput(session.fecha);
    const sessionDateFin = formatDateForInput(session.fecha_fin || session.fecha);

    if (sessionDate > today) return false;
    if (sessionDateFin < today) return true;

    if (today === sessionDateFin) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const endMinutes = parseTime(session.horario_fin);
        const lateWindow = parseInt(session.ventana_tardios) || 0;

        return currentMinutes > (endMinutes + lateWindow);
    }

    return false;
}

async function toggleSessionStatus(sessionId, isActive) {
    console.log('Toggle session:', sessionId, isActive);
    const accion = isActive ? 'cerrar' : 'activar';

    if (!confirm(`¿Confirmar ${accion} sesión?`)) return;

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'toggleSession',
                token: docenteToken,
                session_id: sessionId,
                accion: accion
            })
        });

        const data = await response.json();

        if (data.success) {
            loadSessions();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        showLoading(false);
    }
}

// ============================================
// CREAR/EDITAR SESIÓN
// ============================================

function showCreateSessionModal() {
    document.getElementById('modalTitle').textContent = 'Nueva Sesión';
    document.getElementById('sessionForm').reset();
    document.getElementById('questionsBuilder').innerHTML = '';
    questionCount = 0;
    addQuestion(); // Agregar primera pregunta por defecto
    generateNewCode();

    // Set default dates to today
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    document.getElementById('inputFecha').value = todayStr;
    document.getElementById('inputFechaFin').value = todayStr;

    document.getElementById('sessionModal').classList.add('show');
}

function closeSessionModal() {
    document.getElementById('sessionModal').classList.remove('show');
}

function generateNewCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('inputCodigo').value = code;
}

function addQuestion(data = null) {
    if (questionCount >= 5) {
        alert('Se permiten hasta 5 preguntas por sesión.');
        return;
    }

    const container = document.getElementById('questionsBuilder');
    const questionId = questionCount++;

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-builder';
    questionDiv.id = `q-builder-${questionId}`;
    questionDiv.innerHTML = `
    <div class="question-header">
      <span>Pregunta ${questionId + 1}</span>
      <button type="button" onclick="removeQuestion(this)" class="btn-remove">✕</button>
    </div>
    <select class="question-type" onchange="updateQuestionType(this)">
      <option value="corta">Respuesta corta</option>
      <option value="parrafo">Párrafo</option>
      <option value="multiple">Opción múltiple</option>
    </select>
    <input type="text" class="question-text" placeholder="Texto de la pregunta" required>
    <div class="options-container" style="display: none; margin-top: 1rem;"></div>
  `;

    if (data) {
        questionDiv.querySelector('.question-type').value = data.tipo;
        questionDiv.querySelector('.question-text').value = data.texto;
        updateQuestionType(questionDiv.querySelector('.question-type'), data);
    }

    container.appendChild(questionDiv);
}

function removeQuestion(btn) {
    btn.closest('.question-builder').remove();
    // Don't decrement questionCount globally to keep IDs unique even if others are removed
}

function updateQuestionType(select, data = null) {
    const builder = select.closest('.question-builder');
    if (!builder) return;

    const container = builder.querySelector('.options-container');
    if (!container) return;

    if (select.value === 'multiple') {
        container.style.display = 'block';

        // Generar un ID único interno para los labels/inputs
        const uid = builder.id ? builder.id.replace('q-builder-', '') : Math.floor(Math.random() * 1000);

        container.innerHTML = `
          <div class="options-list"></div>
          <button type="button" class="btn-add-option" onclick="addOption(this)">+ Agregar opción</button>
          
          <div class="mcq-configs" style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div class="toggle-container">
              <label class="toggle-label" for="ms-${uid}">Selección múltiple</label>
              <label class="switch">
                <input type="checkbox" class="multiple-selection switch-input" id="ms-${uid}">
                <span class="switch-slider"></span>
              </label>
            </div>
            
            <div class="toggle-container">
              <label class="toggle-label" for="sr-${uid}">Mostrar resultados a alumnos</label>
              <label class="switch">
                <input type="checkbox" class="show-results switch-input" id="sr-${uid}" checked>
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
        `;

        const optionsList = container.querySelector('.options-list');
        const defaultOptions = ['Opción A', 'Opción B'];
        const optionsData = (data && data.opciones && data.opciones.length > 0) ? data.opciones : defaultOptions;

        optionsData.forEach((optValue, idx) => {
            const row = document.createElement('div');
            row.className = 'option-row';
            row.innerHTML = `
              <input type="text" placeholder="Opción ${String.fromCharCode(65 + idx)}" value="${optValue || ''}" required>
              <button type="button" class="btn-remove-option" onclick="removeOption(this)" style="display:none;">−</button>
            `;
            optionsList.appendChild(row);
        });

        if (data) {
            const msCheck = container.querySelector('.multiple-selection');
            const srCheck = container.querySelector('.show-results');
            if (msCheck) msCheck.checked = data.multiple_selection === true;
            if (srCheck) srCheck.checked = data.show_results !== false;
        }

        updateRemoveButtons(optionsList);
    } else {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

function addOption(btn) {
    const container = btn.previousElementSibling;
    const currentOptions = container.querySelectorAll('.option-row').length;

    if (currentOptions >= 6) {
        alert('Máximo 6 opciones permitidas');
        return;
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const newOption = document.createElement('div');
    newOption.className = 'option-row';
    newOption.innerHTML = `
        <input type="text" placeholder="Opción ${letters[currentOptions]}" required>
        <button type="button" class="btn-remove-option" onclick="removeOption(this)">−</button>
    `;

    container.appendChild(newOption);
    updateRemoveButtons(container);
}

function removeOption(btn) {
    const container = btn.closest('.options-list');
    const currentOptions = container.querySelectorAll('.option-row').length;

    if (currentOptions <= 2) {
        alert('Mínimo 2 opciones requeridas');
        return;
    }

    btn.closest('.option-row').remove();
    updateRemoveButtons(container);

    // Actualizar placeholders
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    container.querySelectorAll('.option-row').forEach((row, index) => {
        row.querySelector('input').placeholder = `Opción ${letters[index]}`;
    });
}

function updateRemoveButtons(container) {
    const options = container.querySelectorAll('.option-row');
    options.forEach(option => {
        const removeBtn = option.querySelector('.btn-remove-option');
        removeBtn.style.display = options.length > 2 ? 'inline-block' : 'none';
    });
}

async function saveSession(event) {
    event.preventDefault();

    const action = currentEditingSessionId ? 'updateSession' : 'createSession';
    const preguntas = [];
    document.querySelectorAll('.question-builder').forEach(qb => {
        const tipo = qb.querySelector('.question-type').value;
        const texto = qb.querySelector('.question-text').value;

        const pregunta = { tipo, texto };

        if (tipo === 'multiple') {
            const opciones = Array.from(qb.querySelectorAll('.option-row input'))
                .map(input => input.value)
                .filter(val => val.trim() !== '');
            pregunta.opciones = opciones;
            pregunta.multiple_selection = qb.querySelector('.multiple-selection').checked;
            pregunta.show_results = qb.querySelector('.show-results').checked;
        }

        preguntas.push(pregunta);
    });

    const requireGps = document.getElementById('inputRequireGPS').checked;

    showLoading(true);

    const submitPayload = async (ubicacionDocente = null) => {
        try {
            const payload = {
                action: action,
                token: docenteToken,
                session_id: currentEditingSessionId,
                materia: document.getElementById('inputMateria').value,
                fecha: document.getElementById('inputFecha').value,
                fecha_fin: document.getElementById('inputFechaFin').value,
                curso: document.getElementById('inputCurso').value,
                horario_inicio: document.getElementById('inputHorarioInicio').value,
                horario_fin: document.getElementById('inputHorarioFin').value,
                codigo: document.getElementById('inputCodigo').value,
                preguntas: preguntas,
                aceptar_tardios: document.getElementById('inputAceptarTardios').checked,
                ventana_tardios: parseInt(document.getElementById('inputVentanaTardios').value) || 0,
                permitir_reenvio: document.getElementById('inputPermitirReenvio').checked,
                require_gps: requireGps,
                ubicacion_docente: ubicacionDocente
            };

            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                closeSessionModal();
                loadSessions();
                alert(currentEditingSessionId ? 'Sesión actualizada' : `Sesión creada. Código: ${data.codigo}`);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            showLoading(false);
        }
    };

    if (requireGps) {
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización. Desmarca la opción de requerir GPS.');
            showLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coordenadas = `${position.coords.latitude},${position.coords.longitude}`;
                submitPayload(coordenadas);
            },
            (error) => {
                alert('No se pudo obtener tu ubicación. Verifica si le diste permisos al navegador para marcar el "Punto Cero" (el aula).');
                showLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        submitPayload(null);
    }
}

// Toggle tardíos config
document.getElementById('inputAceptarTardios')?.addEventListener('change', (e) => {
    document.getElementById('tardiosConfig').style.display = e.target.checked ? 'block' : 'none';
});

// ============================================
// DUPLICAR SESIÓN
// ============================================

function duplicateSession(sessionId) {
    const session = currentSessions.find(s => s.session_id === sessionId);
    if (!session) return;

    currentSessionForDuplicate = session;

    document.getElementById('dupMateria').textContent = session.materia;
    document.getElementById('dupCurso').textContent = session.curso;
    document.getElementById('dupPreguntas').textContent = 'Copiadas de la sesión original';

    generateDupCode();
    document.getElementById('duplicateModal').classList.add('show');
}

function closeDuplicateModal() {
    document.getElementById('duplicateModal').classList.remove('show');
    currentSessionForDuplicate = null;
}

function generateDupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('dupCodigo').value = code;
}

async function confirmDuplicate(event) {
    event.preventDefault();

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'duplicateSession',
                token: docenteToken,
                session_id_original: currentSessionForDuplicate.session_id,
                nueva_fecha: document.getElementById('dupFecha').value,
                nueva_fecha_fin: document.getElementById('dupFechaFin').value,
                nuevo_horario_inicio: document.getElementById('dupHorarioInicio').value,
                nuevo_horario_fin: document.getElementById('dupHorarioFin').value,
                nuevo_codigo: document.getElementById('dupCodigo').value
            })
        });

        const data = await response.json();

        if (data.success) {
            closeDuplicateModal();
            loadSessions();
            alert(`Sesión duplicada. Código: ${data.codigo}`);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        showLoading(false);
    }
}

// ============================================
// VER ENVÍOS
// ============================================

async function viewSubmissions(sessionId, materia, curso) {
    document.getElementById('subMateria').textContent = materia;
    document.getElementById('subCurso').textContent = curso;

    lastMateria = materia;
    lastCurso = curso;

    showLoading(true);
    // Reset stats
    document.getElementById('statsContainer').style.display = 'none';
    document.getElementById('statsCharts').innerHTML = '';

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getSubmissions',
                token: docenteToken,
                session_id: sessionId
            })
        });

        const data = await response.json();

        if (data.success) {
            lastSubmissions = data.submissions || [];
            document.getElementById('subTotal').textContent = lastSubmissions.length;
            renderSubmissionsTable(lastSubmissions);

            const session = currentSessions.find(s => s.session_id === sessionId);
            if (session && lastSubmissions.length > 0) {
                renderStats(session, lastSubmissions);
            }

            document.getElementById('submissionsModal').classList.add('show');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        showLoading(false);
    }
}

function renderStats(session, submissions) {
    const preguntas = session.preguntas || [];
    const parsedPreguntas = typeof preguntas === 'string' ? JSON.parse(preguntas) : preguntas;

    // Filtrar solo las de opción múltiple
    const multipleChoice = parsedPreguntas.map((p, i) => ({ ...p, index: i }))
        .filter(p => p.tipo === 'multiple');

    if (multipleChoice.length === 0) return;

    const statsContainer = document.getElementById('statsContainer');
    const chartsGrid = document.getElementById('statsCharts');
    chartsGrid.innerHTML = '';

    multipleChoice.forEach(pregunta => {
        const columnIdx = 9 + pregunta.index; // Respuestas empiezan en col 10 (idx 9)
        const counts = {};
        pregunta.opciones.forEach(opt => counts[opt] = 0);

        submissions.forEach(sub => {
            const resp = sub.respuestas[pregunta.index];
            if (resp && counts[resp] !== undefined) {
                counts[resp]++;
            }
        });

        const total = submissions.length;
        const chartItem = document.createElement('div');
        chartItem.className = 'chart-item';

        let barsHtml = '';
        pregunta.opciones.forEach(opt => {
            const count = counts[opt];
            const pct = total > 0 ? (count / total * 100) : 0;
            barsHtml += `
                <div class="stat-bar-row">
                    <div class="stat-bar-label" title="${opt}">${opt}</div>
                    <div class="stat-bar-outer">
                        <div class="stat-bar-inner" style="width: ${pct}%"></div>
                    </div>
                    <div class="stat-bar-value">${count}</div>
                </div>
            `;
        });

        chartItem.innerHTML = `
            <div class="chart-title">${pregunta.texto}</div>
            <div class="stat-bar-container">
                ${barsHtml}
            </div>
        `;
        chartsGrid.appendChild(chartItem);
    });

    statsContainer.style.display = 'block';
}

function exportSubmissionsCSV() {
    if (lastSubmissions.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    // Encabezados
    let csv = 'Estudiante,Email,Fecha,Estado,Materia,Curso';
    // Agregar encabezados de preguntas si existen
    if (lastSubmissions[0].respuestas) {
        lastSubmissions[0].respuestas.forEach((_, i) => {
            csv += `,Pregunta ${i + 1}`;
        });
    }
    csv += '\n';

    // Filas
    lastSubmissions.forEach(sub => {
        let row = `"${sub.nombre}","${sub.email}","${sub.timestamp}","${sub.estado}","${lastMateria}","${lastCurso}"`;
        if (sub.respuestas) {
            sub.respuestas.forEach(resp => {
                row += `,"${(resp || '').replace(/"/g, '""')}"`;
            });
        }
        csv += row + '\n';
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${lastMateria.replace(/ /g, '_')}_${lastCurso}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderSubmissionsTable(submissions) {
    const container = document.getElementById('submissionsTable');

    if (submissions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aún no hay envíos</p></div>';
        return;
    }

    container.innerHTML = `
    <table class="submissions-table">
      <thead>
        <tr>
          <th>Estudiante</th>
          <th>Estado</th>
          <th>Hora</th>
        </tr>
      </thead>
      <tbody>
        ${submissions.map(sub => `
          <tr>
            <td>
                <div style="font-weight: 600;">${sub.nombre || 'Sin nombre'}</div>
                <div style="font-size: 0.8rem; color: var(--text-light);">${sub.email}</div>
            </td>
            <td><span class="badge ${sub.estado === 'tarde' ? 'badge-warning' : 'badge-success'}">${sub.estado}</span></td>
            <td style="font-size: 0.85rem;">${sub.timestamp}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function closeSubmissionsModal() {
    document.getElementById('submissionsModal').classList.remove('show');
}

// ============================================
// ELIMINAR SESIÓN
// ============================================

async function deleteSessionConfirm(sessionId) {
    if (!confirm('¿Estás segura de que querés eliminar esta sesión? Esta acción no se puede deshacer.')) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'deleteSession',
                token: docenteToken,
                session_id: sessionId
            })
        });

        const data = await response.json();

        if (data.success) {
            loadSessions();
            alert('Sesión eliminada correctamente');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        showLoading(false);
    }
}

// ============================================
// CÓDIGO QR Y ENLACES
// ============================================

function getBaseUrl() {
    return window.location.href.split('/').slice(0, -1).join('/') + '/estudiante.html';
}

function showQrModal(codigo, materia) {
    const modal = document.getElementById('qrModal');
    const canvas = document.getElementById('qrCanvas');
    const linkEl = document.getElementById('directLink');
    const titleEl = document.getElementById('qrMateriaTitle');

    const directUrl = `${getBaseUrl()}?code=${codigo}`;

    titleEl.textContent = `Materia: ${materia} (Código: ${codigo})`;
    linkEl.textContent = directUrl;

    // Generar QR
    new QRious({
        element: canvas,
        value: directUrl,
        size: 300,
        level: 'H'
    });

    modal.style.display = 'flex';
}

function closeQrModal() {
    document.getElementById('qrModal').style.display = 'none';
}

function copyDirectLink() {
    const link = document.getElementById('directLink').textContent;
    copyToClipboard(link);
}

function copyDirectLinkFromSession(codigo) {
    const directUrl = `${getBaseUrl()}?code=${codigo}`;
    copyToClipboard(directUrl);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('¡Enlace copiado al portapapeles!');
    }).catch(err => {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar. Enlace: ' + text);
    });
}

// ============================================
// TEMAS (DARK MODE) - Reutilizado de app.js
// ============================================

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode-gradient');
    }
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (newTheme === 'dark') {
        document.body.classList.add('dark-mode-gradient');
    } else {
        document.body.classList.remove('dark-mode-gradient');
    }

    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌓';
    }
}
