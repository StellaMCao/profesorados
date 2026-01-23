// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  SPREADSHEET_ID: 'TU_SPREADSHEET_ID_AQUI', // Reemplazar con ID real
  TIMEZONE: 'America/Argentina/Buenos_Aires',
  MATERIAS: ['Sujetos', 'Educacional', 'Evaluación', 'Neurociencia', 'Problemáticas', 'Comunitaria']
};

// ============================================
// WEB APP ENTRY POINT
// ============================================

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    // Validar token de Google
    const userEmail = validateToken(params.token);
    if (!userEmail) {
      return jsonResponse({ success: false, error: 'Token inválido o expirado' });
    }
    
    // Rutas públicas (estudiantes)
    if (action === 'validateCode') {
      return validateCode(params.codigo, userEmail);
    }
    
    if (action === 'submitAnswers') {
      return submitAnswers(params, userEmail);
    }
    
    // Rutas docente (requieren autorización)
    if (!isDocente(userEmail)) {
      return jsonResponse({ success: false, error: 'No autorizado. Solo docentes.' });
    }
    
    switch (action) {
      case 'getSessions':
        return getSessions(userEmail);
      case 'createSession':
        return createSession(params, userEmail);
      case 'duplicateSession':
        return duplicateSession(params, userEmail);
      case 'toggleSession':
        return toggleSession(params);
      case 'getSubmissions':
        return getSubmissions(params.session_id);
      default:
        return jsonResponse({ success: false, error: 'Acción no reconocida' });
    }
  } catch (error) {
    Logger.log('Error en doPost: ' + error.toString());
    return jsonResponse({ success: false, error: 'Error del servidor: ' + error.message });
  }
}

function doGet(e) {
  return ContentService.createTextOutput('API de Asistencia + Ticket de Salida. Use POST requests.');
}

// ============================================
// HELPERS
// ============================================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Configurar encabezados según el tipo de hoja
    if (sheetName === '_sessions') {
      sheet.getRange(1, 1, 1, 13).setValues([[
        'session_id', 'materia', 'fecha', 'curso', 'horario_inicio', 'horario_fin',
        'codigo', 'preguntas_json', 'aceptar_tardios', 'ventana_tardios',
        'permitir_reenvio', 'activa', 'creado_por'
      ]]);
    } else if (sheetName === '_docentes') {
      sheet.getRange(1, 1, 1, 1).setValues([['email']]);
    } else {
      // Hoja de materia
      sheet.getRange(1, 1, 1, 12).setValues([[
        'session_id', 'fecha', 'curso', 'materia', 'email', 'nombre',
        'timestamp', 'estado', 'codigo', 'pregunta_1', 'pregunta_2', 'pregunta_3'
      ]]);
    }
    
    // Formato de encabezados
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold')
      .setBackground('#6366f1')
      .setFontColor('#ffffff');
  }
  
  return sheet;
}

function generateSessionId() {
  return Utilities.getUuid();
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O, I, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function validateToken(token) {
  // En producción, validar el token de Google OAuth
  // Por ahora, extraer email del token (simulado)
  // En frontend, enviar el ID token de Google Sign-In
  
  try {
    // Usar OAuth2 library o validar con Google API
    // Placeholder: asumir que token contiene email
    return token; // TEMPORAL: En producción, validar con Google
  } catch (e) {
    return null;
  }
}

function isDocente(email) {
  const sheet = getOrCreateSheet('_docentes');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.toLowerCase()) {
      return true;
    }
  }
  
  return false;
}

function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function parseTime(timeStr) {
  // Convierte "19:50" a minutos desde medianoche
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function isWithinTimeWindow(session, allowLate = false) {
  const now = new Date();
  const today = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  
  // Verificar fecha
  if (session.fecha !== today) {
    return { valid: false, reason: 'Sesión programada para otra fecha' };
  }
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(session.horario_inicio);
  const endMinutes = parseTime(session.horario_fin);
  
  // Dentro del horario normal
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return { valid: true, estado: 'a tiempo' };
  }
  
  // Fuera de horario - verificar tardíos
  if (allowLate && session.aceptar_tardios === 'true') {
    const lateWindow = parseInt(session.ventana_tardios) || 0;
    const extendedEnd = endMinutes + lateWindow;
    
    if (currentMinutes > endMinutes && currentMinutes <= extendedEnd) {
      return { valid: true, estado: 'tarde' };
    }
  }
  
  return { valid: false, reason: 'Fuera del horario permitido' };
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

function validateCode(codigo, userEmail) {
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  // Buscar sesión por código
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6] === codigo) { // columna 'codigo'
      const session = {
        session_id: row[0],
        materia: row[1],
        fecha: row[2],
        curso: row[3],
        horario_inicio: row[4],
        horario_fin: row[5],
        codigo: row[6],
        preguntas: JSON.parse(row[7] || '[]'),
        aceptar_tardios: row[8],
        ventana_tardios: row[9],
        permitir_reenvio: row[10],
        activa: row[11]
      };
      
      // Verificar si está activa
      if (session.activa !== 'true') {
        return jsonResponse({
          success: false,
          error: 'Esta sesión no está activa. Consultá con tu docente.'
        });
      }
      
      // Verificar horario
      const timeCheck = isWithinTimeWindow(session, true);
      if (!timeCheck.valid) {
        return jsonResponse({
          success: false,
          error: timeCheck.reason
        });
      }
      
      // Verificar si ya envió
      const yaEnvio = checkDuplicate(session.session_id, userEmail);
      if (yaEnvio && session.permitir_reenvio !== 'true') {
        return jsonResponse({
          success: false,
          error: 'Ya enviaste respuestas para esta sesión.'
        });
      }
      
      return jsonResponse({
        success: true,
        session: {
          session_id: session.session_id,
          materia: session.materia,
          curso: session.curso,
          preguntas: session.preguntas,
          ya_envio: yaEnvio,
          permitir_reenvio: session.permitir_reenvio === 'true'
        }
      });
    }
  }
  
  return jsonResponse({
    success: false,
    error: 'Código inválido. Verificá que esté bien escrito.'
  });
}

function checkDuplicate(sessionId, email) {
  // Buscar en todas las hojas de materias
  const ss = getSpreadsheet();
  
  for (const materia of CONFIG.MATERIAS) {
    const sheet = ss.getSheetByName(materia);
    if (!sheet) continue;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId && data[i][4].toLowerCase() === email.toLowerCase()) {
        return true;
      }
    }
  }
  
  return false;
}

function submitAnswers(params, userEmail) {
  const { session_id, nombre, respuestas } = params;
  
  // Obtener info de la sesión
  const sessionsSheet = getOrCreateSheet('_sessions');
  const sessionsData = sessionsSheet.getDataRange().getValues();
  
  let session = null;
  for (let i = 1; i < sessionsData.length; i++) {
    if (sessionsData[i][0] === session_id) {
      session = {
        session_id: sessionsData[i][0],
        materia: sessionsData[i][1],
        fecha: sessionsData[i][2],
        curso: sessionsData[i][3],
        horario_inicio: sessionsData[i][4],
        horario_fin: sessionsData[i][5],
        codigo: sessionsData[i][6],
        aceptar_tardios: sessionsData[i][8],
        ventana_tardios: sessionsData[i][9],
        permitir_reenvio: sessionsData[i][10],
        activa: sessionsData[i][11]
      };
      break;
    }
  }
  
  if (!session) {
    return jsonResponse({ success: false, error: 'Sesión no encontrada' });
  }
  
  // Verificar duplicado
  const yaEnvio = checkDuplicate(session_id, userEmail);
  if (yaEnvio && session.permitir_reenvio !== 'true') {
    return jsonResponse({ success: false, error: 'Ya enviaste respuestas para esta sesión' });
  }
  
  // Verificar horario
  const timeCheck = isWithinTimeWindow(session, true);
  if (!timeCheck.valid) {
    return jsonResponse({ success: false, error: timeCheck.reason });
  }
  
  // Escribir en la hoja de la materia
  const materiaSheet = getOrCreateSheet(session.materia);
  const timestamp = getCurrentTimestamp();
  
  const newRow = [
    session.session_id,
    session.fecha,
    session.curso,
    session.materia,
    userEmail,
    nombre || '',
    timestamp,
    timeCheck.estado,
    session.codigo,
    respuestas[0] || '',
    respuestas[1] || '',
    respuestas[2] || ''
  ];
  
  materiaSheet.appendRow(newRow);
  
  return jsonResponse({
    success: true,
    message: timeCheck.estado === 'tarde' 
      ? '⚠️ Asistencia registrada como tardío' 
      : '✅ Asistencia registrada correctamente',
    estado: timeCheck.estado
  });
}

function getSessions(userEmail) {
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  const sessions = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][12] === userEmail) { // creado_por
      sessions.push({
        session_id: data[i][0],
        materia: data[i][1],
        fecha: data[i][2],
        curso: data[i][3],
        horario_inicio: data[i][4],
        horario_fin: data[i][5],
        codigo: data[i][6],
        activa: data[i][11]
      });
    }
  }
  
  return jsonResponse({ success: true, sessions });
}

function createSession(params, userEmail) {
  const sheet = getOrCreateSheet('_sessions');
  
  const sessionId = generateSessionId();
  const codigo = params.codigo || generateCode();
  
  const newRow = [
    sessionId,
    params.materia,
    params.fecha,
    params.curso,
    params.horario_inicio,
    params.horario_fin,
    codigo,
    JSON.stringify(params.preguntas),
    params.aceptar_tardios ? 'true' : 'false',
    params.ventana_tardios || 0,
    params.permitir_reenvio ? 'true' : 'false',
    'false', // activa
    userEmail
  ];
  
  sheet.appendRow(newRow);
  
  // Asegurar que existe la hoja de la materia
  getOrCreateSheet(params.materia);
  
  return jsonResponse({
    success: true,
    session_id: sessionId,
    codigo: codigo,
    message: 'Sesión creada correctamente'
  });
}

function duplicateSession(params, userEmail) {
  const { session_id_original, nueva_fecha, nuevo_horario_inicio, nuevo_horario_fin, nuevo_codigo } = params;
  
  // Obtener sesión original
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  let originalSession = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === session_id_original && data[i][12] === userEmail) {
      originalSession = data[i];
      break;
    }
  }
  
  if (!originalSession) {
    return jsonResponse({ success: false, error: 'Sesión original no encontrada' });
  }
  
  // Crear nueva sesión con datos copiados
  const newSessionId = generateSessionId();
  const codigo = nuevo_codigo || generateCode();
  
  const newRow = [
    newSessionId,
    originalSession[1], // materia
    nueva_fecha,
    originalSession[3], // curso
    nuevo_horario_inicio,
    nuevo_horario_fin,
    codigo,
    originalSession[7], // preguntas_json
    originalSession[8], // aceptar_tardios
    originalSession[9], // ventana_tardios
    originalSession[10], // permitir_reenvio
    'false', // activa
    userEmail
  ];
  
  sheet.appendRow(newRow);
  
  return jsonResponse({
    success: true,
    session_id: newSessionId,
    codigo: codigo,
    message: 'Sesión duplicada correctamente'
  });
}

function toggleSession(params) {
  const { session_id, accion } = params;
  
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === session_id) {
      const newStatus = accion === 'activar' ? 'true' : 'false';
      sheet.getRange(i + 1, 12).setValue(newStatus); // columna 'activa'
      
      return jsonResponse({
        success: true,
        message: accion === 'activar' ? 'Sesión activada' : 'Sesión cerrada'
      });
    }
  }
  
  return jsonResponse({ success: false, error: 'Sesión no encontrada' });
}

function getSubmissions(sessionId) {
  const submissions = [];
  const ss = getSpreadsheet();
  
  // Buscar en todas las hojas de materias
  for (const materia of CONFIG.MATERIAS) {
    const sheet = ss.getSheetByName(materia);
    if (!sheet) continue;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId) {
        submissions.push({
          email: data[i][4],
          nombre: data[i][5],
          timestamp: data[i][6],
          estado: data[i][7],
          respuestas: [data[i][9], data[i][10], data[i][11]]
        });
      }
    }
  }
  
  return jsonResponse({ success: true, submissions });
}
