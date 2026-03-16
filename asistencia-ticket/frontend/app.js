// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw3q75zkwXarG7ioDMvZTR9Du46pu2rtjMEAWobOgfc09-tTC_W-PQIVZhK-htIRbu2Wg/exec',
    GOOGLE_CLIENT_ID: '493373610143-nkdtu88hfa39ved9bf6kj72at1d30rul.apps.googleusercontent.com'
};

let currentUser = null;
let currentSession = null;
let googleToken = null;
let sessionTimerInterval = null;

// Forzar mayúsculas en el código del alumno y detectar parámetros URL
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const codeInput = document.getElementById('codeInput');
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    // Detectar código en la URL (?code=XYZ)
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl && codeInput) {
        codeInput.value = codeFromUrl.toUpperCase();
        // Opcional: Auto-validar si el usuario ya está logueado
        if (currentUser) {
            validateCode(new Event('submit'));
        }
    }
});

// ============================================
// TEMAS (DARK MODE)
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

// ============================================
// GOOGLE SIGN-IN
// ============================================

function handleCredentialResponse(response) {
    googleToken = response.credential;

    // Decodificar JWT para obtener info del usuario
    const payload = parseJwt(response.credential);

    currentUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };

    // Mostrar pantalla de código
    showScreen('codeScreen');
    updateUserInfo();

    // Si había un código en la URL, validarlo ahora que tenemos usuario
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl) {
        validateCode(new Event('submit'));
    }
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

function updateUserInfo() {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userAvatar').src = currentUser.picture;

    document.getElementById('userName2').textContent = currentUser.name;
    document.getElementById('userAvatar2').src = currentUser.picture;
}

function logout() {
    currentUser = null;
    googleToken = null;
    currentSession = null;
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    showScreen('loginScreen');
    document.getElementById('codeInput').value = '';
}

// ============================================
// NAVEGACIÓN
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
}

function backToCode() {
    currentSession = null;
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    document.getElementById('codeInput').value = '';
    document.getElementById('questionsContainer').innerHTML = '';
    showError('codeError', '');
    showError('submitError', '');

    // Reset Poll UI
    const pollSection = document.getElementById('pollSection');
    const btnVer = document.getElementById('btnVerResultados');
    if (pollSection) pollSection.style.display = 'none';
    if (btnVer) {
        btnVer.style.display = 'none';
        btnVer.textContent = 'Ver resultados de la clase';
    }
    const btnVerConfirm = document.getElementById('btnVerResultadosConfirm');
    if (btnVerConfirm) {
        btnVerConfirm.style.display = 'none';
        btnVerConfirm.textContent = 'Ver resultados de la clase';
    }
    const pollSectionConfirm = document.getElementById('pollSectionConfirm');
    if (pollSectionConfirm) pollSectionConfirm.style.display = 'none';

    const pollCont = document.getElementById('pollResultsContainer');
    if (pollCont) pollCont.innerHTML = '<p class="hint">Cargando resultados...</p>';

    showScreen('codeScreen');
}

// ============================================
// VALIDACIÓN DE CÓDIGO
// ============================================

async function validateCode(event) {
    if (event && event.preventDefault) event.preventDefault();

    const codigo = document.getElementById('codeInput').value.trim().toUpperCase();

    if (!codigo) {
        showError('codeError', 'Ingresá un código');
        return;
    }

    showLoading(true);
    showError('codeError', '');

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'validateCode',
                token: currentUser.email, // En producción, enviar googleToken
                codigo: codigo
            })
        });

        const data = await response.json();

        if (data.success) {
            currentSession = data.session;
            renderQuestions(currentSession.preguntas);

            document.getElementById('sessionDetails').textContent = `${currentSession.materia} (${currentSession.curso})`;

            // Compatibilidad con backend antiguo (por si no actualizaron Code.gs)
            if (currentSession.horario_fin) {
                startSessionTimer(currentSession.horario_fin, currentSession.ventana_tardios, currentSession.aceptar_tardios, currentSession.fecha_fin);
                document.getElementById('timerBadge').style.display = 'block';
            } else {
                document.getElementById('timerBadge').style.display = 'none';
            }

            showScreen('sessionScreen');

            // GPS check si aplica
            if (currentSession.require_gps && currentSession.ubicacion_docente) {
                verifyStudentLocation(currentSession.ubicacion_docente);
            }

            // GPS check si aplica
            if (currentSession.require_gps && currentSession.ubicacion_docente) {
                verifyStudentLocation(currentSession.ubicacion_docente);
            }
        } else {
            showError('codeError', data.error);
        }
    } catch (error) {
        showError('codeError', 'Error de conexión. Intentá de nuevo.');
        console.error('Error:', error);
    } finally {
        showLoading(false);
    }
}

// ============================================
// VERIFICACIÓN DE UBICACIÓN (GPS)
// ============================================

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Metros
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function verifyStudentLocation(ubicacionDocente) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;

    const gpsInicio = document.getElementById('gpsStatus');
    if (gpsInicio) {
        gpsInicio.textContent = '📍 Verificando tu ubicación física...';
        gpsInicio.style.display = 'block';
    }

    if (!navigator.geolocation) {
        showError('submitError', '⚠️ Tu navegador no soporta GPS. Consultá con tu docente.');
        submitBtn.disabled = false;
        return;
    }

    const [lat2, lon2] = ubicacionDocente.split(',').map(Number);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat1 = position.coords.latitude;
            const lon1 = position.coords.longitude;
            const distancia = haversineDistance(lat1, lon1, lat2, lon2);
            const MAX_METROS = 100;

            if (gpsInicio) gpsInicio.style.display = 'none';

            if (distancia > MAX_METROS) {
                showError('submitError',
                    `📍 Estás a ${Math.round(distancia)} m del aula. Debés estar a menos de ${MAX_METROS} m para registrar tu asistencia.`);
                submitBtn.disabled = true;
            } else {
                showError('submitError', '');
                submitBtn.disabled = false;
            }
        },
        (error) => {
            if (gpsInicio) gpsInicio.style.display = 'none';
            showError('submitError', '⚠️ No se pudo obtener tu ubicación GPS. Activá el GPS de tu dispositivo y recargá la página.');
            submitBtn.disabled = true;
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
}

// ============================================
// TEMPORIZADOR DE SESIÓN
// ============================================

// Extrae horas y minutos de cualquier formato de tiempo posible
function parseTimeValue(timeVal) {
    if (!timeVal) return null;
    const str = String(timeVal);
    const simple = str.match(/^(\d{1,2}):(\d{2})/);
    if (simple) return { h: Number(simple[1]), m: Number(simple[2]) };
    const iso = str.match(/T(\d{2}):(\d{2})/);
    if (iso) return { h: Number(iso[1]), m: Number(iso[2]) };
    return null;
}

function startSessionTimer(horarioFin, ventanaTardios, aceptarTardios, fechaFin) {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);

    const timerElement = document.getElementById('sessionTimer');
    const badgeElement = document.getElementById('timerBadge');
    const progressContainer = document.getElementById('timerProgressContainer');
    const progressBar = document.getElementById('timerProgressBar');

    const timeParsed = parseTimeValue(horarioFin);
    if (!timeParsed) {
        timerElement.textContent = '--:--';
        if (progressContainer) progressContainer.style.display = 'none';
        return;
    }
    const { h, m } = timeParsed;

    let endTime = new Date();
    if (fechaFin) {
        const strFin = String(fechaFin);
        const dateMatch = strFin.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch.map(Number);
            endTime.setFullYear(year, month - 1, day);
        }
    }
    endTime.setHours(h, m, 0, 0);

    const extendedEndTime = new Date(endTime.getTime());
    const tardiosMinutos = Number(ventanaTardios) || 0;
    if (aceptarTardios) {
        extendedEndTime.setMinutes(extendedEndTime.getMinutes() + tardiosMinutos);
    }

    const startTime = new Date(); // Referencia para la barra de progreso
    const totalDuration = extendedEndTime - startTime;
    if (progressContainer) progressContainer.style.display = 'block';

    function updateTimer() {
        const now = new Date();
        const diff = extendedEndTime - now;

        if (diff <= 0) {
            clearInterval(sessionTimerInterval);
            timerElement.textContent = "00:00";
            if (progressBar) progressBar.style.width = '0%';
            badgeElement.className = "info-badge timer-badge danger";
            showError('submitError', 'El tiempo de la sesión ha finalizado.');
            document.getElementById('submitBtn').disabled = true;
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const days = Math.floor(totalMinutes / (60 * 24));
        const hoursLeft = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minsLeft = totalMinutes % 60;

        // Actualizar barra de progreso
        if (progressBar && totalDuration > 0) {
            const progress = (diff / totalDuration) * 100;
            progressBar.style.width = `${progress}%`;

            if (progress < 20) {
                progressBar.className = 'progress-bar danger';
            } else if (progress < 50) {
                progressBar.className = 'progress-bar warning';
            } else {
                progressBar.className = 'progress-bar';
            }
        }

        // Estilos según el tiempo (regular o tardío)
        if (now > endTime) {
            badgeElement.className = "info-badge timer-badge warning pulse";
        } else {
            const criticalTime = 5 * 60 * 1000; // 5 minutos
            if (diff < criticalTime) {
                badgeElement.className = "info-badge timer-badge danger";
            } else {
                badgeElement.className = "info-badge timer-badge";
            }
        }

        if (days > 0) {
            timerElement.textContent = `${days}d ${hoursLeft}h ${minsLeft}m`;
        } else if (hoursLeft > 0) {
            timerElement.textContent = `${hoursLeft}h ${minsLeft}m ${secs}s`;
        } else {
            timerElement.textContent = `${minsLeft.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    document.getElementById('submitBtn').disabled = false;
    updateTimer();
    sessionTimerInterval = setInterval(updateTimer, 1000);
}

// ============================================
// RENDERIZADO DE PREGUNTAS
// ============================================

function renderQuestions(preguntas) {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    // Cargar respuestas guardadas localmente para esta sesión
    const savedAnswers = JSON.parse(localStorage.getItem(`answers_${currentSession.session_id}`) || '{}');

    preguntas.forEach((pregunta, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';

        const questionTitle = document.createElement('h3');
        questionTitle.textContent = `${index + 1}. ${pregunta.texto}`;
        questionDiv.appendChild(questionTitle);

        const name = `pregunta_${index}`;
        const savedValue = savedAnswers[name] || '';

        if (pregunta.tipo === 'multiple') {
            const isMultiple = pregunta.multiple_selection === true;
            pregunta.opciones.forEach((opcion) => {
                const label = document.createElement('label');
                label.className = 'option-label';
                const input = document.createElement('input');
                input.type = isMultiple ? 'checkbox' : 'radio';
                input.name = name;
                input.value = opcion;
                if (!isMultiple) input.required = true;

                if (isMultiple) {
                    try {
                        const vals = JSON.parse(savedValue || '[]');
                        if (Array.isArray(vals) && vals.includes(opcion)) input.checked = true;
                    } catch (e) { }
                } else if (opcion === savedValue) input.checked = true;

                input.addEventListener('change', () => {
                    let val = opcion;
                    if (isMultiple) {
                        val = JSON.stringify(Array.from(questionDiv.querySelectorAll('input:checked')).map(i => i.value));
                    }
                    autoSave(name, val);
                });
                label.appendChild(input);
                label.appendChild(document.createTextNode(opcion));
                questionDiv.appendChild(label);
            });
        } else if (pregunta.tipo === 'corta') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'text-input';
            input.name = name;
            input.placeholder = 'Tu respuesta...';
            input.required = true;
            input.value = savedValue;

            input.addEventListener('input', (e) => autoSave(name, e.target.value));

            questionDiv.appendChild(input);
        } else if (pregunta.tipo === 'parrafo') {
            const textarea = document.createElement('textarea');
            textarea.className = 'textarea-input';
            textarea.name = name;
            textarea.placeholder = 'Escribí tu respuesta...';
            textarea.rows = 4;
            textarea.required = true;
            textarea.value = savedValue;

            const counter = document.createElement('span');
            counter.className = 'char-counter';
            counter.textContent = `${savedValue.length} caracteres`;

            textarea.addEventListener('input', (e) => {
                autoSave(name, e.target.value);
                counter.textContent = `${e.target.value.length} caracteres`;
            });

            questionDiv.appendChild(textarea);
            questionDiv.appendChild(counter);
        }

        container.appendChild(questionDiv);
    });
}

function autoSave(name, value) {
    const key = `answers_${currentSession.session_id}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved[name] = value;
    localStorage.setItem(key, JSON.stringify(saved));
}

// ============================================
// ENVÍO DE RESPUESTAS (VISTA PREVIA Y SUBMIT)
// ============================================

function submitAnswers(event) {
    event.preventDefault();

    const form = document.getElementById('answersForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const container = document.getElementById('previewContent');
    container.innerHTML = '';

    currentSession.preguntas.forEach((pregunta, index) => {
        const name = `pregunta_${index}`;
        let value = formData.get(name);
        if (pregunta.multiple_selection === true) {
            value = Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value).join(', ');
        }
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <div class="preview-q">${pregunta.texto}</div>
            <div class="preview-a">${value || '(Sin respuesta)'}</div>
        `;
        container.appendChild(div);
    });

    document.getElementById('previewModal').style.display = 'flex';
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

async function confirmAndSubmit() {
    closePreview();
    showLoading(true);
    showError('submitError', '');

    // Feedback háptico si está disponible
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }

    const form = document.getElementById('answersForm');
    const respuestas = [];

    currentSession.preguntas.forEach((pregunta, index) => {
        const name = `pregunta_${index}`;
        if (pregunta.multiple_selection === true) {
            const vals = Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
            respuestas.push(vals.join(', '));
        } else {
            const formData = new FormData(form);
            respuestas.push(formData.get(name) || '');
        }
    });

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'submitAnswers',
                token: currentUser.email,
                session_id: currentSession.session_id,
                nombre: currentUser.name,
                respuestas: respuestas
            })
        });

        const data = await response.json();

        if (data.success) {
            // Limpiar auto-save
            localStorage.removeItem(`answers_${currentSession.session_id}`);

            triggerConfetti();

            document.getElementById('confirmationTitle').textContent =
                data.estado === 'tarde' ? '⚠️ Registrado como tardío' : '✅ ¡Asistencia registrada!';
            document.getElementById('confirmationMessage').textContent = data.message;
            document.getElementById('confirmMateria').textContent = currentSession.materia;
            document.getElementById('confirmCurso').textContent = currentSession.curso;
            document.getElementById('confirmTime').textContent = new Date().toLocaleTimeString('es-AR');

            showScreen('confirmationScreen');

            // Mostrar botón de resultados en pantalla de confirmación si aplica
            const hasPoll = currentSession.preguntas.some(q => q.tipo === 'multiple' && q.show_results);
            if (hasPoll) {
                const btnConfirm = document.getElementById('btnVerResultadosConfirm');
                if (btnConfirm) {
                    btnConfirm.style.display = 'block';
                    btnConfirm.textContent = 'Ver resultados de la clase';
                }
            }
        } else {
            showError('submitError', data.error);
        }
    } catch (error) {
        showError('submitError', 'Error de conexión. Intentá de nuevo.');
        console.error('Error:', error);
    } finally {
        showLoading(false);
    }
}

// ============================================
// EFECTOS ESPECIALES
// ============================================

function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'block';

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 8 + 6 + 'px';
        confetti.style.width = size;
        confetti.style.height = size;
        confetti.style.opacity = Math.random() * 0.5 + 0.5;

        // Animación mejorada
        const duration = Math.random() * 2 + 3;
        const delay = Math.random() * 2;
        confetti.style.animation = `fall ${duration}s linear ${delay}s infinite`;

        container.appendChild(confetti);
    }

    setTimeout(() => {
        container.style.display = 'none';
    }, 5000);
}

// ============================================
// ENCUESTAS EN TIEMPO REAL
// ============================================

function togglePollResults(sectionId = 'pollSection', btnId = 'btnVerResultados', containerId = 'pollResultsContainer') {
    const section = document.getElementById(sectionId);
    const btn = document.getElementById(btnId);
    if (!section || !btn) return;

    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = 'Ocultar resultados';
        loadPollResults(containerId);
    } else {
        section.style.display = 'none';
        btn.textContent = 'Ver resultados de la clase';
    }
}

async function loadPollResults(containerId = 'pollResultsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<p class="hint">Cargando resultados...</p>';
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getPollResults',
                token: currentUser.email,
                session_id: currentSession.session_id
            })
        });
        const data = await response.json();
        if (data.success) {
            renderPollResults(data.results, containerId);
        }
    } catch (e) {
        console.error('Error loading polls:', e);
    }
}

function renderPollResults(results, containerId = 'pollResultsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    let hasResults = false;
    for (const qIdx in results) {
        const qData = currentSession.preguntas[parseInt(qIdx) - 1];
        if (qData && qData.show_results === false) continue; // Saltear si no es encuesta

        hasResults = true;
        const q = results[qIdx];
        const qDiv = document.createElement('div');
        qDiv.className = 'poll-question-item';

        const qTitle = document.createElement('span');
        qTitle.className = 'poll-question-title';
        qTitle.textContent = q.pregunta;
        qDiv.appendChild(qTitle);

        const total = Object.values(q.opciones).reduce((a, b) => a + b, 0);

        for (const opt in q.opciones) {
            const count = q.opciones[opt];
            const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;

            const barRow = document.createElement('div');
            barRow.className = 'poll-bar-row';

            barRow.innerHTML = `
                <div class="poll-label-info">
                    <span>${opt}</span>
                    <span>${count} (${pct}%)</span>
                </div>
                <div class="poll-bar-bg">
                    <div class="poll-bar-fill" style="width: ${pct}%"></div>
                </div>
            `;
            qDiv.appendChild(barRow);
        }
        container.appendChild(qDiv);
    }

    if (!hasResults) {
        container.innerHTML = '<p class="hint">No hay preguntas de opción múltiple en esta sesión.</p>';
    }
}
