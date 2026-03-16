// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  SPREADSHEET_ID: 'TU_SPREADSHEET_ID_AQUI', // Reemplazar con ID real
  TIMEZONE: 'America/Argentina/Buenos_Aires'
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
    
    if (action === 'getPollResults') {
      return getPollResults(params.session_id);
    }
    
    // Rutas docente (requieren autorización)
    // Rutas docente (requieren autorización)
    if (!isDocente(userEmail)) {
      return jsonResponse({ success: false, error: 'No autorizado. Solo docentes.' });
    }
    
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
      sheet.getRange(1, 1, 1, 16).setValues([[
        'session_id', 'materia', 'fecha', 'curso', 'horario_inicio', 'horario_fin',
        'codigo', 'preguntas_json', 'aceptar_tardios', 'ventana_tardios',
        'permitir_reenvio', 'activa', 'creado_por', 'fecha_fin',
        'require_gps', 'ubicacion_docente'
      ]]);
    } else if (sheetName === '_docentes') {
      sheet.getRange(1, 1, 1, 1).setValues([['email']]);
    } else {
      // Hoja de materia (max 5 preguntas)
      sheet.getRange(1, 1, 1, 14).setValues([[
        'session_id', 'fecha', 'curso', 'materia', 'email', 'nombre',
        'timestamp', 'estado', 'codigo',
        'pregunta_1', 'pregunta_2', 'pregunta_3', 'pregunta_4', 'pregunta_5'
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
  const nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const chunks = nowStr.split(' ');
  const todayDate = chunks[0];
  const [todayHour, todayMins] = chunks[1].split(':').map(Number);
  const currentMinutes = todayHour * 60 + todayMins;
  
  // Normalizar fecha de la sesión (puede venir como Date o string)
  let sessionDate = session.fecha;
  if (sessionDate instanceof Date) {
    sessionDate = Utilities.formatDate(sessionDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  } else if (typeof sessionDate === 'string' && sessionDate.includes('T')) {
    sessionDate = sessionDate.split('T')[0];
  }

  // Normalizar fecha fin (fallback a fecha de inicio)
  let sessionDateFin = session.fecha_fin || session.fecha;
  if (sessionDateFin instanceof Date) {
    sessionDateFin = Utilities.formatDate(sessionDateFin, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  } else if (typeof sessionDateFin === 'string' && sessionDateFin.includes('T')) {
    sessionDateFin = sessionDateFin.split('T')[0];
  }
  
  Logger.log('Comparing dates - Hoy: ' + todayDate + ', Inicio: ' + sessionDate + ', Fin: ' + sessionDateFin);

  // Verificar fecha base
  if (todayDate < sessionDate) {
    return { valid: false, reason: 'La sesión comienza el ' + sessionDate };
  }
  if (todayDate > sessionDateFin) {
    return { valid: false, reason: 'La sesión finalizó el ' + sessionDateFin };
  }
  
  const startMinutes = parseTime(session.horario_inicio);
  const endMinutes = parseTime(session.horario_fin);
  const lateWindow = parseInt(session.ventana_tardios) || 0;
  const extendedEnd = endMinutes + lateWindow;

  // Si estamos en el día de inicio
  if (todayDate === sessionDate && currentMinutes < startMinutes) {
    return { valid: false, reason: 'La sesión aún no ha comenzado hoy.' };
  }

  // Si estamos en el día de fin
  if (todayDate === sessionDateFin) {
    if (currentMinutes > extendedEnd) {
      return { valid: false, reason: 'La sesión ya ha expirado por horario.' };
    }
    
    if (allowLate && isTrue(session.aceptar_tardios)) {
      if (currentMinutes > endMinutes && currentMinutes <= extendedEnd) {
        return { valid: true, estado: 'tarde' };
      }
    }
  }
  
  return { valid: true, estado: 'a tiempo' };
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
      const formatTime = (val) => val instanceof Date
        ? Utilities.formatDate(val, CONFIG.TIMEZONE, 'HH:mm')
        : String(val || '');

      const session = {
        session_id: row[0],
        materia: row[1],
        fecha: row[2],
        curso: row[3],
        horario_inicio: formatTime(row[4]),
        horario_fin: formatTime(row[5]),
        codigo: row[6],
        preguntas: JSON.parse(row[7] || '[]'),
        aceptar_tardios: row[8],
        ventana_tardios: row[9],
        permitir_reenvio: row[10],
        activa: row[11],
        fecha_fin: row[13] || row[2],
        require_gps: row[14] || 'false',
        ubicacion_docente: row[15] || ''
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

      // Calcular segundos restantes para el alumno
      const secondsRemaining = getSecondsRemaining(session);
      
      // Verificar si ya envió
      const yaEnvio = checkDuplicate(session.session_id, userEmail);
      const reenvioPermitido = isTrue(session.permitir_reenvio);
      
      Logger.log('DIAGNOSTIC - Session ID: ' + session.session_id);
      Logger.log('DIAGNOSTIC - User: ' + userEmail);
      Logger.log('DIAGNOSTIC - raw permitir_reenvio (col 11): [' + session.permitir_reenvio + '] type: ' + typeof session.permitir_reenvio);
      Logger.log('DIAGNOSTIC - isTrue(permitir_reenvio): ' + reenvioPermitido);
      Logger.log('DIAGNOSTIC - yaEnvio: ' + yaEnvio);
      Logger.log('DIAGNOSTIC - secondsRemaining: ' + secondsRemaining);

      if (yaEnvio && !reenvioPermitido) {
        return jsonResponse({
          success: false,
          error: 'Ya enviaste respuestas para esta sesión. (Reenvío: ' + reenvioPermitido + ')'
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
          permitir_reenvio: isTrue(session.permitir_reenvio),
          horario_fin: session.horario_fin,
          fecha_fin: session.fecha_fin || session.fecha,
          ventana_tardios: session.ventana_tardios,
          aceptar_tardios: isTrue(session.aceptar_tardios),
          require_gps: isTrue(session.require_gps),
          ubicacion_docente: session.ubicacion_docente,
          seconds_remaining: secondsRemaining
        }
      });
    }
  }
  
  return jsonResponse({
    success: false,
    error: 'Código inválido. Verificá que esté bien escrito.'
  });
}

function getSecondsRemaining(session) {
  try {
    const now = new Date();
    // Forzar la creación de la fecha fin combinando fecha_fin y horario_fin
    let datePart = session.fecha_fin || session.fecha;
    if (datePart instanceof Date) {
      datePart = Utilities.formatDate(datePart, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    } else if (typeof datePart === 'string' && datePart.includes('T')) {
      datePart = datePart.split('T')[0];
    }

    const timePart = session.horario_fin; // HH:mm
    const [h, m] = timePart.split(':').map(Number);
    
    // Crear objeto Date en la zona horaria de la sesión
    // Nota: JS Date siempre usa el reloj local del entorno, pero formatemos para comparar
    const endStr = datePart + ' ' + (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':00';
    const endDate = new Date(endStr.replace(/-/g, '/')); // Reemplazo para compatibilidad cross-platform en GAS
    
    // Si se aceptan tardíos, extender el tiempo
    if (isTrue(session.aceptar_tardios)) {
      const lateWindow = parseInt(session.ventana_tardios) || 0;
      endDate.setMinutes(endDate.getMinutes() + lateWindow);
    }

    const diffMs = endDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / 1000));
  } catch (e) {
    Logger.log('Error calculating seconds remaining: ' + e.toString());
    return 0;
  }
}


function checkDuplicate(sessionId, email) {
  // Buscar en todas las hojas de materias
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  
  for (const sheet of sheets) {
    const sheetName = sheet.getName();
    if (sheetName.startsWith('_')) continue; 
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][0]).trim();
      const rowEmail = String(data[i][4]).trim().toLowerCase();
      if (rowId === String(sessionId).trim() && rowEmail === email.toLowerCase().trim()) {
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
        activa: sessionsData[i][11],
        fecha_fin: sessionsData[i][13] || sessionsData[i][2]
      };
      break;
    }
  }
  
  if (!session) {
    return jsonResponse({ success: false, error: 'Sesión no encontrada' });
  }
  
  // Verificar duplicado
  const yaEnvio = checkDuplicate(session_id, userEmail);
  const reenvioPermitido = isTrue(session.permitir_reenvio);
  
  Logger.log('submitAnswers - Session ID: ' + session_id);
  Logger.log('submitAnswers - Ya envió: ' + yaEnvio);
  Logger.log('submitAnswers - Reenvío permitido: ' + reenvioPermitido);

  if (yaEnvio && !reenvioPermitido) {
    return jsonResponse({ success: false, error: 'Ya enviaste respuestas para esta sesión. El docente no habilitó el reenvío.' });
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
    respuestas[2] || '',
    respuestas[3] || '',
    respuestas[4] || ''
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

      // Safe time formatting - Sheets stores times as Date objects internally
      let horarioInicio = '';
      let horarioFin = '';
      try {
        const rawInicio = data[i][4];
        const rawFin = data[i][5];
        horarioInicio = rawInicio instanceof Date
          ? Utilities.formatDate(rawInicio, CONFIG.TIMEZONE, 'HH:mm')
          : String(rawInicio || '');
        horarioFin = rawFin instanceof Date
          ? Utilities.formatDate(rawFin, CONFIG.TIMEZONE, 'HH:mm')
          : String(rawFin || '');
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
        permitir_reenvio: isTrue(data[i][10]),
        activa: String(data[i][11] || 'false'),
        fecha_fin: data[i][13] ? (data[i][13] instanceof Date ? Utilities.formatDate(data[i][13], CONFIG.TIMEZONE, 'yyyy-MM-dd') : String(data[i][13])) : dateStr,
        require_gps: String(data[i][14] || 'false'),
        ubicacion_docente: String(data[i][15] || '')
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
    userEmail,
    params.fecha_fin || params.fecha,
    params.require_gps ? 'true' : 'false',
    params.ubicacion_docente || ''
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
    userEmail,
    params.nueva_fecha_fin || nueva_fecha,
    originalSession[14] || 'false', // require_gps
    originalSession[15] || ''       // ubicacion_docente (se omite al duplicar para re-capturar)
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
      codigo, preguntas, aceptar_tardios, ventana_tardios, permitir_reenvio,
      fecha_fin, require_gps, ubicacion_docente
  } = params;

  const sheet = getOrCreateSheet('_sessions');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
      if (data[i][0] === session_id) {
          // Update cols 2-11 (materia → permitir_reenvio)
          sheet.getRange(i + 1, 2, 1, 10).setValues([[
              materia, fecha, curso, horario_inicio, horario_fin,
              codigo.toUpperCase(), JSON.stringify(preguntas),
              aceptar_tardios ? 'true' : 'false', 
              ventana_tardios, 
              permitir_reenvio ? 'true' : 'false'
          ]]);
          // Update fecha_fin (col 14)
          sheet.getRange(i + 1, 14).setValue(fecha_fin || fecha);
          // Update GPS fields (cols 15-16)
          sheet.getRange(i + 1, 15).setValue(require_gps ? 'true' : 'false');
          if (ubicacion_docente) {
            sheet.getRange(i + 1, 16).setValue(ubicacion_docente);
          }

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

function getSecondsRemaining(session) {
  try {
    const now = new Date();
    let datePart = session.fecha_fin || session.fecha;
    
    // Normalizar datePart a YYYY-MM-DD
    if (datePart instanceof Date) {
      datePart = Utilities.formatDate(datePart, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    } else if (typeof datePart === 'string') {
      datePart = datePart.split('T')[0];
    }

    const timePart = session.horario_fin; // HH:mm
    
    // Crear string ISO-ish para parsear
    const fullDateStr = datePart + 'T' + timePart + ':00';
    const endDate = Utilities.parseDate(fullDateStr, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    
    // Si se aceptan tardíos, extender el tiempo
    if (isTrue(session.aceptar_tardios)) {
      const lateWindow = parseInt(session.ventana_tardios) || 0;
      endDate.setTime(endDate.getTime() + (lateWindow * 60 * 1000));
    }

    const diffMs = endDate.getTime() - now.getTime();
    const secs = Math.floor(diffMs / 1000);
    
    Logger.log('Timer Calculation: End=' + endDate + ' Now=' + now + ' Diff=' + secs);
    return Math.max(0, secs);
  } catch (e) {
    Logger.log('Error calculating seconds remaining: ' + e.toString());
    return 0;
  }
}

function getPollResults(sessionId) {
  const results = {};
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  
  // Buscar la sesión para conocer las preguntas
  const sessionsSheet = getOrCreateSheet('_sessions');
  const sessionsData = sessionsSheet.getDataRange().getValues();
  let session = null;
  const sIdStr = String(sessionId).trim();

  for (let i = 1; i < sessionsData.length; i++) {
    if (String(sessionsData[i][0]).trim() === sIdStr) {
      session = {
        materia: sessionsData[i][1],
        preguntas: JSON.parse(sessionsData[i][7] || '[]')
      };
      break;
    }
  }
  
  if (!session) return jsonResponse({ success: false, error: 'Sesión no encontrada' });

  // Inicializar contadores para preguntas de opción múltiple (solo si son encuestas)
  session.preguntas.forEach((q, idx) => {
    if (q.tipo === 'multiple' && q.show_results !== false) {
      results[idx + 1] = { 
        pregunta: q.texto,
        opciones: {} 
      };
      if (Array.isArray(q.opciones)) {
        q.opciones.forEach(opt => {
          results[idx + 1].opciones[opt] = 0;
        });
      }
    }
  });

  // Buscar todas las respuestas en la hoja de la materia
  const sheet = ss.getSheetByName(session.materia);
  if (!sheet) return jsonResponse({ success: true, results });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === sIdStr) {
      // Columnas J-N (indices 9-13) son pregunta_1 a pregunta_5
      for (let qIdx = 1; qIdx <= 5; qIdx++) {
        if (results[qIdx]) {
          const respuestaCompleta = String(data[i][8 + qIdx] || ''); // 8+1 = 9 (Col J)
          if (respuestaCompleta) {
            const respuestas = respuestaCompleta.split(',').map(r => r.trim());
            respuestas.forEach(r => {
              if (results[qIdx].opciones.hasOwnProperty(r)) {
                results[qIdx].opciones[r]++;
              }
            });
          }
        }
      }
    }
  }

  return jsonResponse({ success: true, results });
}

function getSubmissions(sessionId) {
  const submissions = [];
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  
  // Buscar en todas las hojas de materias
  for (const sheet of sheets) {
    const sheetName = sheet.getName();
    if (sheetName.startsWith('_')) continue; // Saltar hojas de sistema
    
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

