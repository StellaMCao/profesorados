// ============================================
// ESTADO GLOBAL DOCENTE
// ============================================

let docenteUser = null;
let docenteToken = null;
let currentSessions = [];
let currentSessionForDuplicate = null;
let questionCount = 0;

// ============================================
// AUTENTICACIÓN DOCENTE
// ============================================

function handleDocenteLogin(response) {
    docenteToken = response.credential;
    const payload = parseJwt(response.credential);

    docenteUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };

    // Verificar si es docente autorizado
    checkDocenteAuth();
}

async function checkDocenteAuth() {
    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getSessions',
                token: docenteUser.email
            })
        });

        const data = await response.json();

        if (data.success) {
            showScreen('docenteDashboard');
            document.getElementById('docenteName').textContent = docenteUser.name;
            document.getElementById('docenteAvatar').src = docenteUser.picture;
            loadSessions();
        } else {
            alert('No estás autorizado como docente. Contactá al administrador.');
        }
    } catch (error) {
        alert('Error de conexión');
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
                token: docenteUser.email
            })
        });

        const data = await response.json();

        if (data.success) {
            currentSessions = data.sessions;
            renderSessions();
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    } finally {
        showLoading(false);
    }
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
    container.innerHTML = currentSessions.map(session => `
    <div class="session-card ${session.activa === 'true' ? 'active' : ''}">
      <div class="session-header">
        <div class="session-materia">${session.materia}</div>
        <div class="session-status ${session.activa === 'true' ? 'status-active' : 'status-inactive'}">
          ${session.activa === 'true' ? '🟢 Activa' : '⚪ Inactiva'}
        </div>
      </div>
      <div class="session-info-grid">
        <div><strong>Curso:</strong> ${session.curso}</div>
        <div><strong>Fecha:</strong> ${session.fecha}</div>
        <div><strong>Horario:</strong> ${session.horario_inicio} - ${session.horario_fin}</div>
        <div><strong>Código:</strong> <code>${session.codigo}</code></div>
      </div>
      <div class="session-actions">
        <button onclick="toggleSessionStatus('${session.session_id}', '${session.activa}')" 
                class="btn-toggle ${session.activa === 'true' ? 'btn-deactivate' : 'btn-activate'}">
          ${session.activa === 'true' ? '⏸️ Cerrar' : '▶️ Activar'}
        </button>
        <button onclick="viewSubmissions('${session.session_id}', '${session.materia}', '${session.curso}')" 
                class="btn-view">
          👁️ Ver Envíos
        </button>
        <button onclick="duplicateSession('${session.session_id}')" class="btn-duplicate">
          📋 Duplicar
        </button>
      </div>
    </div>
  `).join('');
}

async function toggleSessionStatus(sessionId, currentStatus) {
    const accion = currentStatus === 'true' ? 'cerrar' : 'activar';

    if (!confirm(`¿Confirmar ${accion} sesión?`)) return;

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'toggleSession',
                token: docenteUser.email,
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

function addQuestion() {
    if (questionCount >= 3) {
        alert('Máximo 3 preguntas por sesión');
        return;
    }

    const container = document.getElementById('questionsBuilder');
    const questionId = questionCount++;

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-builder';
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
    <div class="options-container" style="display: none;"></div>
  `;

    container.appendChild(questionDiv);
}

function removeQuestion(btn) {
    btn.closest('.question-builder').remove();
    questionCount--;
}

function updateQuestionType(select) {
    const container = select.closest('.question-builder').querySelector('.options-container');

    if (select.value === 'multiple') {
        container.style.display = 'block';
        container.innerHTML = `
      <input type="text" placeholder="Opción A" required>
      <input type="text" placeholder="Opción B" required>
      <input type="text" placeholder="Opción C" required>
      <input type="text" placeholder="Opción D (opcional)">
    `;
    } else {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

async function saveSession(event) {
    event.preventDefault();

    const preguntas = [];
    document.querySelectorAll('.question-builder').forEach(qb => {
        const tipo = qb.querySelector('.question-type').value;
        const texto = qb.querySelector('.question-text').value;

        const pregunta = { tipo, texto };

        if (tipo === 'multiple') {
            const opciones = Array.from(qb.querySelectorAll('.options-container input'))
                .map(input => input.value)
                .filter(val => val.trim() !== '');
            pregunta.opciones = opciones;
        }

        preguntas.push(pregunta);
    });

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'createSession',
                token: docenteUser.email,
                materia: document.getElementById('inputMateria').value,
                fecha: document.getElementById('inputFecha').value,
                curso: document.getElementById('inputCurso').value,
                horario_inicio: document.getElementById('inputHorarioInicio').value,
                horario_fin: document.getElementById('inputHorarioFin').value,
                codigo: document.getElementById('inputCodigo').value,
                preguntas: preguntas,
                aceptar_tardios: document.getElementById('inputAceptarTardios').checked,
                ventana_tardios: document.getElementById('inputVentanaTardios').value,
                permitir_reenvio: document.getElementById('inputPermitirReenvio').checked
            })
        });

        const data = await response.json();

        if (data.success) {
            closeSessionModal();
            loadSessions();
            alert(`Sesión creada. Código: ${data.codigo}`);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        showLoading(false);
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
                token: docenteUser.email,
                session_id_original: currentSessionForDuplicate.session_id,
                nueva_fecha: document.getElementById('dupFecha').value,
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

    showLoading(true);

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getSubmissions',
                token: docenteUser.email,
                session_id: sessionId
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('subTotal').textContent = data.submissions.length;
            renderSubmissionsTable(data.submissions);
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
          <th>Email</th>
          <th>Hora</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${submissions.map(sub => `
          <tr>
            <td>${sub.nombre || 'Sin nombre'}</td>
            <td>${sub.email}</td>
            <td>${sub.timestamp}</td>
            <td><span class="badge ${sub.estado === 'tarde' ? 'badge-warning' : 'badge-success'}">${sub.estado}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function closeSubmissionsModal() {
    document.getElementById('submissionsModal').classList.remove('show');
}
