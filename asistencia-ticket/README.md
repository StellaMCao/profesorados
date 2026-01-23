# 🎓 Sistema de Asistencia + Ticket de Salida

Sistema web responsive integrado con Google Workspace para registro de asistencia y tickets de salida mediante código de clase.

---

## ✨ Características

- ✅ **Login con Google** (OAuth automático)
- ✅ **Validación por código** de 6 caracteres
- ✅ **Control de horarios** con opción de tardíos
- ✅ **Tickets de salida** con 1-3 preguntas personalizables
- ✅ **Panel docente** con gestión completa de sesiones
- ✅ **Duplicar sesiones** (copiar config, nueva fecha/código)
- ✅ **Vista en tiempo real** de envíos
- ✅ **Almacenamiento en Google Sheets** (una hoja por materia)
- ✅ **Responsive** mobile-first

---

## 🚀 Despliegue Rápido (15 minutos)

### Paso 1: Google Spreadsheet (3 min)

1. Creá un [nuevo Google Sheet](https://sheets.google.com)
2. Creá estas hojas (tabs):
   - `_sessions` con columnas: `session_id | materia | fecha | curso | horario_inicio | horario_fin | codigo | preguntas_json | aceptar_tardios | ventana_tardios | permitir_reenvio | activa | creado_por`
   - `_docentes` con columna: `email` (agregá los emails de docentes autorizados)
3. Copiá el **ID del Spreadsheet** de la URL

### Paso 2: Apps Script (5 min)

1. En el Spreadsheet: **Extensiones > Apps Script**
2. Pegá el código de `backend/Code.gs`
3. Actualizá `SPREADSHEET_ID` con tu ID
4. **Implementar > Nueva implementación > Aplicación web**
   - Ejecutar como: Yo
   - Acceso: Cualquier usuario
5. Copiá la **URL del Web App**

### Paso 3: Google Cloud Console (5 min)

1. [Google Cloud Console](https://console.cloud.google.com/)
2. Creá proyecto nuevo
3. **APIs y servicios > Credenciales > Crear credenciales > OAuth 2.0**
4. Tipo: Aplicación web
5. Orígenes autorizados: tu dominio de GitHub Pages
6. Copiá el **Client ID**

### Paso 4: Configurar Frontend (2 min)

En `frontend/app.js`:
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'TU_WEB_APP_URL',
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID'
};
```

En `frontend/index.html` y `frontend/docente.html`:
```html
data-client_id="TU_CLIENT_ID"
```

### Paso 5: GitHub Pages

1. Creá repo en GitHub
2. Subí la carpeta `frontend/`
3. Settings > Pages > Deploy from branch
4. ¡Listo! Tu sitio está en `https://tuusuario.github.io/repo/`

---

## 📂 Estructura

```
asistencia-ticket/
├── backend/
│   └── Code.gs              # Google Apps Script
├── frontend/
│   ├── index.html           # Portal estudiante
│   ├── docente.html         # Portal docente
│   ├── app.js               # Lógica estudiante
│   ├── docente.js           # Lógica docente
│   ├── styles.css           # Estilos compartidos
│   └── docente-styles.css   # Estilos docente
└── docs/
    └── DEPLOYMENT.md        # Guía detallada
```

---

## 🎯 Uso

### Estudiantes

1. Abrir link compartido en Classroom
2. Login con Google
3. Ingresar código anunciado por docente
4. Completar ticket de salida
5. ¡Listo! Asistencia registrada

### Docentes

1. Abrir portal docente
2. Crear sesión (materia, fecha, horario, preguntas)
3. Activar sesión
4. Anunciar código a estudiantes
5. Ver envíos en tiempo real

---

## 🔧 Materias Configuradas

- Sujetos
- Educacional
- Evaluación
- Neurociencia
- Problemáticas
- Comunitaria

*(Modificables en `backend/Code.gs` → `CONFIG.MATERIAS`)*

---

## 📱 Integración con Classroom

Compartí el link del frontend como material o enlace en Google Classroom. Los estudiantes usarán su cuenta institucional para acceder.

---

## 🛡️ Seguridad

- OAuth con Google (mail automático, no editable)
- Lista blanca de docentes en `_docentes`
- Validación de horarios y duplicados
- Un envío por estudiante por sesión (salvo reenvío habilitado)

---

## 📖 Documentación Completa

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para guía paso a paso detallada.

---

## 🤝 Soporte

Si tenés problemas:
1. Revisá los logs en Apps Script
2. Verificá la consola del navegador (F12)
3. Asegurate de que todos los IDs estén correctos

---

## 📄 Licencia

Uso libre para instituciones educativas.

---

**Hecho por S. M. Cao** 🚀
