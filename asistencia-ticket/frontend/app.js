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

// Forzar mayúsculas en el código del alumno
document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('codeInput');
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
});

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
    showScreen('codeScreen');
}

// ============================================
// VALIDACIÓN DE CÓDIGO
// ============================================

async function validateCode(event) {
    event.preventDefault();

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

            document.getElementById('sessionMateria').textContent = currentSession.materia;
            document.getElementById('sessionCurso').textContent = currentSession.curso;

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
// Acepta: "14:30", "14:30:00", "1899-12-30T14:30:00.000Z", Date serializado, etc.
function parseTimeValue(timeVal) {
    if (!timeVal) return null;
    const str = String(timeVal);
    // Formato HH:MM o HH:MM:SS
    const simple = str.match(/^(\d{1,2}):(\d{2})/);
    if (simple) return { h: Number(simple[1]), m: Number(simple[2]) };
    // ISO con T (ej: "1899-12-30T14:30:00.000Z" o "2026-03-16T14:30:00.000Z")
    const iso = str.match(/T(\d{2}):(\d{2})/);
    if (iso) return { h: Number(iso[1]), m: Number(iso[2]) };
    return null;
}

function startSessionTimer(horarioFin, ventanaTardios, aceptarTardios, fechaFin) {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);

    const timerElement = document.getElementById('sessionTimer');
    const badgeElement = document.getElementById('timerBadge');

    // Parsear la hora de fin
    const timeParsed = parseTimeValue(horarioFin);
    if (!timeParsed) {
        timerElement.textContent = '--:--';
        console.warn('startSessionTimer: no se pudo parsear horarioFin =', horarioFin);
        return;
    }
    const { h, m } = timeParsed;

    // Construir la fecha/hora de fin
    let endTime = new Date();
    if (fechaFin) {
        // Extraer YYYY-MM-DD de cualquier formato
        const strFin = String(fechaFin);
        const dateMatch = strFin.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch.map(Number);
            endTime.setFullYear(year, month - 1, day);
        }
    }
    endTime.setHours(h, m, 0, 0);

    // Agregar ventana de tardíos si aplica
    const extendedEndTime = new Date(endTime.getTime());
    if (aceptarTardios) {
        extendedEndTime.setMinutes(extendedEndTime.getMinutes() + (Number(ventanaTardios) || 0));
    }

    function updateTimer() {
        const now = new Date();
        const diff = extendedEndTime - now;

        if (diff <= 0) {
            clearInterval(sessionTimerInterval);
            timerElement.textContent = "00:00";
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

        // Estilos según el tiempo (regular o tardío)
        badgeElement.className = now > endTime
            ? "info-badge timer-badge warning"
            : "info-badge timer-badge";

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

    preguntas.forEach((pregunta, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';

        const questionTitle = document.createElement('h3');
        questionTitle.textContent = `${index + 1}. ${pregunta.texto}`;
        questionDiv.appendChild(questionTitle);

        if (pregunta.tipo === 'multiple') {
            // Opciones múltiples
            pregunta.opciones.forEach((opcion, optIndex) => {
                const label = document.createElement('label');
                label.className = 'option-label';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `pregunta_${index}`;
                radio.value = opcion;
                radio.required = true;

                label.appendChild(radio);
                label.appendChild(document.createTextNode(opcion));
                questionDiv.appendChild(label);
            });
        } else if (pregunta.tipo === 'corta') {
            // Respuesta corta
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'text-input';
            input.name = `pregunta_${index}`;
            input.placeholder = 'Tu respuesta...';
            input.required = true;
            questionDiv.appendChild(input);
        } else if (pregunta.tipo === 'parrafo') {
            // Párrafo
            const textarea = document.createElement('textarea');
            textarea.className = 'textarea-input';
            textarea.name = `pregunta_${index}`;
            textarea.placeholder = 'Escribí tu respuesta...';
            textarea.rows = 4;
            textarea.required = true;
            questionDiv.appendChild(textarea);
        }

        container.appendChild(questionDiv);
    });
}

// ============================================
// ENVÍO DE RESPUESTAS
// ============================================

async function submitAnswers(event) {
    event.preventDefault();

    const form = document.getElementById('answersForm');
    const formData = new FormData(form);

    const respuestas = [];
    currentSession.preguntas.forEach((pregunta, index) => {
        const name = `pregunta_${index}`;
        const value = formData.get(name);
        respuestas.push(value || '');
    });

    showLoading(true);
    showError('submitError', '');

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'submitAnswers',
                token: currentUser.email, // En producción, enviar googleToken
                session_id: currentSession.session_id,
                nombre: currentUser.name,
                respuestas: respuestas
            })
        });

        const data = await response.json();

        if (data.success) {
            // Mostrar confirmación
            document.getElementById('confirmationTitle').textContent =
                data.estado === 'tarde' ? '⚠️ Registrado como tardío' : '✅ ¡Asistencia registrada!';
            document.getElementById('confirmationMessage').textContent = data.message;
            document.getElementById('confirmMateria').textContent = currentSession.materia;
            document.getElementById('confirmCurso').textContent = currentSession.curso;
            document.getElementById('confirmTime').textContent = new Date().toLocaleTimeString('es-AR');

            showScreen('confirmationScreen');
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
