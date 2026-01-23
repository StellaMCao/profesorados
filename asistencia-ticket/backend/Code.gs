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
    /*
    if (!isDocente(userEmail)) {
      return jsonResponse({ success: false, error: 'No autorizado. Solo docentes.' });
    }
    */
    
    switch (action) {
      case 'getSessions':
        return getSessions(userEmail);
      case 'createSession':
        return createSession(params, userEmail);
      case 'updateSession':
        return updateSession(params, userEmail);
      case 'duplicateSession':
        return duplicateSession(params, userEmail);
      case 'toggleSession':
        return toggleSession(params);
      case 'deleteSession':
        return deleteSession(params);
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
  // En producción, se debería validar la firma del token con la API de Google
  // Para este MVP, decodificamos el payload para obtener el email
  
  try {
    if (!token) return null;

    // El token JWT tiene 3 partes separadas por puntos
    var parts = token.split('.');
    if (parts.length !== 3) {
      // Si no es un JWT válido (por ejemplo si enviamos solo el email en pruebas anteriores)
      // intentamos ver si es un email simple
      if (token.includes('@')) return token;
      return null;
    }

    // Decodificar la parte del payload (segunda parte)
    // Se necesita reemplazar caracteres para que sea base64 válido URL-safe
    var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    var decoded = Utilities.newBlob(Utilities.base64Decode(base64)).getDataAsString();
    var payload = JSON.parse(decoded);

    return payload.email;
  } catch (e) {
    Logger.log('Error validating token: ' + e.toString());
    // FALLBACK FOR DEBUGGING: Return the token itself if it looks like an email, or a dummy email
    if (token && token.includes('@')) return token;
    return 'debug_teacher@example.com'; 
  }
}

function isTrue(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  if (typeof val === 'number') return val === 1;
  return false;
}

function isDocente(email) {
  const sheet = getOrCreateSheet('_docentes');
  const data = sheet.getDataRange().getValues();
  
  Logger.log('Checking authorization for email: ' + email);
  
  for (let i = 1; i < data.length; i++) {
    const sheetEmail = data[i][0].toString();
    Logger.log('Comparing with: ' + sheetEmail);
    if (sheetEmail.toLowerCase() === email.toLowerCase()) {
      Logger.log('Match found!');
      return true;
    }
  }
  
  Logger.log('No match found in user list.');
  return false;
}

function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function parseTime(timeVal) {
  // Si es un objeto Date (común en Google Sheets para celdas de tiempo)
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
  
  // Fallback o error
  Logger.log('Error: Formato de tiempo no reconocido: ' + timeVal);
  return 0;
}

function isWithinTimeWindow(session, allowLate = false) {
  const now = new Date();
  const today = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  
  // Normalizar fecha de la sesión (puede venir como Date o string)
  let sessionDate = session.fecha;
  if (sessionDate instanceof Date) {
    sessionDate = Utilities.formatDate(sessionDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  } else if (typeof sessionDate === 'string' && sessionDate.includes('T')) {
    // Manejar strings ISO
    sessionDate = sessionDate.split('T')[0];
  }
  
  Logger.log('Comparing dates - Session: ' + sessionDate + ', Today: ' + today);

  // Verificar fecha
  if (sessionDate !== today) {
    return { valid: false, reason: 'Sesión programada para otra fecha (' + sessionDate + ' vs ' + today + ')' };
  }
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(session.horario_inicio);
  const endMinutes = parseTime(session.horario_fin);
  const lateWindow = parseInt(session.ventana_tardios) || 0;
  const extendedEnd = endMinutes + lateWindow;

  // Lógica de expiración (Cierre automático)
  if (currentMinutes > extendedEnd) {
    return { valid: false, reason: 'La sesión ya ha expirado por horario.' };
  }
  
  // Dentro del horario normal
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return { valid: true, estado: 'a tiempo' };
  }
  
  // Fuera de horario - verificar tardíos
  if (allowLate && isTrue(session.aceptar_tardios)) {
    if (currentMinutes > endMinutes && currentMinutes <= extendedEnd) {
      return { valid: true, estado: 'tarde' };
    }
  }
  
  return { valid: false, reason: 'Fuera del horario permitido (Inicio: ' + session.horario_inicio + ')' };
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

function validateCode(codigo, userEmail) {
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  // Buscar sesión por código
  const codigoUpper = codigo.toUpperCase();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6].toString().toUpperCase() === codigoUpper) { // columna 'codigo'
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
      if (!isTrue(session.activa)) {
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
  
  Logger.log('Fetching sessions for email: ' + userEmail);
  Logger.log('Total rows in _sessions sheet: ' + data.length);
  
  const sessions = [];
  for (let i = 1; i < data.length; i++) {
    Logger.log('Row ' + i + ' creator: ' + data[i][12]);
    if (data[i][12] === userEmail) { // creado_por
      // Safe date formatting
      let rawDate = data[i][2];
      let dateStr = '';
      try {
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
        } else {
          dateStr = String(rawDate);
        }
      } catch (e) {
        dateStr = '';
      }

      // Safe time formatting
      let horarioInicio = '';
      let horarioFin = '';
      try {
        horarioInicio = String(data[i][4] || '');
        horarioFin = String(data[i][5] || '');
      } catch (e) {
        horarioInicio = '';
        horarioFin = '';
      }

      sessions.push({
        session_id: String(data[i][0] || ''),
        materia: String(data[i][1] || ''),
        fecha: dateStr,
        curso: String(data[i][3] || ''),
        horario_inicio: horarioInicio,
        horario_fin: horarioFin,
        codigo: String(data[i][6] || ''),
        preguntas: data[i][7] || '[]',
        aceptar_tardios: String(data[i][8] || 'false'),
        ventana_tardios: String(data[i][9] || '0'),
        permitir_reenvio: String(data[i][10] || 'false'),
        activa: String(data[i][11] || 'false')
      });
    }
  }
  
  Logger.log('Sessions found: ' + sessions.length);
  return jsonResponse({ success: true, sessions });
}

function createSession(params, userEmail) {
  const sheet = getOrCreateSheet('_sessions');
  
  const sessionId = generateSessionId();
  const codigo = (params.codigo || generateCode()).toUpperCase();
  
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
  const codigo = (nuevo_codigo || generateCode()).toUpperCase();
  
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

function updateSession(params, userEmail) {
  const {
      session_id, materia, fecha, curso, horario_inicio, horario_fin,
      codigo, preguntas, aceptar_tardios, ventana_tardios, permitir_reenvio
  } = params;

  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
      if (data[i][0] === session_id) {
          // Verificar que sea el creador (o ignorar si no hay auth estricta)
          // if (data[i][12] !== userEmail) return jsonResponse({ success: false, error: 'No autorizado' });

          sheet.getRange(i + 1, 2, 1, 10).setValues([[
              materia, fecha, curso, horario_inicio, horario_fin,
              codigo.toUpperCase(), JSON.stringify(preguntas),
              aceptar_tardios, ventana_tardios, permitir_reenvio
          ]]);

          return jsonResponse({ success: true, message: 'Sesión actualizada' });
      }
  }

  return jsonResponse({ success: false, error: 'Sesión no encontrada' });
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

function deleteSession(params) {
  const { session_id } = params;
  
  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();
  
  // Buscar y eliminar la fila de la sesión
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === session_id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({
        success: true,
        message: 'Sesión eliminada correctamente'
      });
    }
  }
  
  return jsonResponse({ success: false, error: 'Sesión no encontrada' });
}

