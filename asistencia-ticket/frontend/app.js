// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbytUbUtOcBbTbypbLcqW3hYTif63JfELzP2LAek2BgG0rHBPcvyiOvu7BIB5G4TmBirfQ/exec',
    GOOGLE_CLIENT_ID: '493373610143-nkdtu88hfa39ved9bf6kj72at1d30rul.apps.googleusercontent.com'
};

// ============================================
// ESTADO GLOBAL
// ============================================

let currentUser = null;
let currentSession = null;
let googleToken = null;

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

            showScreen('sessionScreen');
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
