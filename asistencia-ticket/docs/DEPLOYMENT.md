# Guía de Despliegue: Sistema de Asistencia + Ticket de Salida

Esta guía te llevará paso a paso por el proceso de despliegue completo del sistema.

---

## 📋 Requisitos Previos

- Cuenta de Google (Gmail o Google Workspace)
- Acceso a Google Drive y Google Sheets
- Navegador web actualizado

---

## 🗂️ Paso 1: Configurar Google Spreadsheet

### 1.1 Crear el Spreadsheet

1. Abrí [Google Sheets](https://sheets.google.com)
2. Creá un nuevo spreadsheet
3. Nombralo "Asistencia - [Nombre de tu institución]"
4. Copiá el **ID del Spreadsheet** de la URL:
   ```
   https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
   ```

### 1.2 Crear Hojas Necesarias

Creá las siguientes hojas (tabs) manualmente:

#### Hoja: `_sessions`
Columnas (fila 1):
```
session_id | materia | fecha | curso | horario_inicio | horario_fin | codigo | preguntas_json | aceptar_tardios | ventana_tardios | permitir_reenvio | activa | creado_por
```

#### Hoja: `_docentes`
Columnas (fila 1):
```
email
```

Agregá los emails de los docentes autorizados (uno por fila):
```
docente1@ejemplo.com
docente2@ejemplo.com
```

#### Hojas de Materias
El sistema creará automáticamente estas hojas cuando se registre el primer envío:
- Sujetos
- Educacional
- Evaluación
- Neurociencia
- Problemáticas
- Comunitaria

**Opcional**: Podés crearlas manualmente con estas columnas:
```
session_id | fecha | curso | materia | email | nombre | timestamp | estado | codigo | pregunta_1 | pregunta_2 | pregunta_3
```

---

## 🔧 Paso 2: Desplegar Google Apps Script

### 2.1 Abrir Apps Script

1. Desde el Spreadsheet, andá a **Extensiones > Apps Script**
2. Se abrirá el editor de Apps Script

### 2.2 Pegar el Código

1. Borrá el código por defecto
2. Copiá TODO el contenido de `backend/Code.gs`
3. Pegalo en el editor

### 2.3 Configurar Variables

En la parte superior del código, actualizá:

```javascript
const CONFIG = {
  SPREADSHEET_ID: 'TU_ID_AQUI', // El ID que copiaste en el Paso 1.1
  TIMEZONE: 'America/Argentina/Buenos_Aires', // Tu zona horaria
  MATERIAS: ['Sujetos', 'Educacional', 'Evaluación', 'Neurociencia', 'Problemáticas', 'Comunitaria']
};
```

### 2.4 Guardar y Desplegar

1. Guardá el proyecto (Ctrl+S o Cmd+S)
2. Nombralo "Asistencia Backend"
3. Click en **Implementar > Nueva implementación**
4. Tipo: **Aplicación web**
5. Configuración:
   - **Ejecutar como**: Yo (tu email)
   - **Quién tiene acceso**: Cualquier usuario
6. Click **Implementar**
7. Autorizá los permisos cuando te lo pida
8. **Copiá la URL del Web App** que aparece (la vas a necesitar)

---

## 🌐 Paso 3: Configurar Google Cloud Console

### 3.1 Crear Proyecto

1. Andá a [Google Cloud Console](https://console.cloud.google.com/)
2. Creá un nuevo proyecto o seleccioná uno existente
3. Nombralo "Asistencia App"

### 3.2 Habilitar Google Sign-In API

1. En el menú lateral, andá a **APIs y servicios > Biblioteca**
2. Buscá "Google+ API" y habilitala
3. Buscá "Google Identity" y habilitala

### 3.3 Crear Credenciales OAuth

1. Andá a **APIs y servicios > Credenciales**
2. Click **Crear credenciales > ID de cliente de OAuth 2.0**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: "Asistencia Frontend"
5. **Orígenes autorizados de JavaScript**:
   - `http://localhost` (para testing local)
   - Tu dominio de producción (ej: `https://tudominio.com`)
6. Click **Crear**
7. **Copiá el Client ID** que aparece

---

## 💻 Paso 4: Configurar Frontend

### 4.1 Actualizar Configuración

En `frontend/app.js`, actualizá:

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'TU_WEB_APP_URL_AQUI', // URL del Paso 2.4
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID_AQUI'   // Client ID del Paso 3.3
};
```

### 4.2 Actualizar HTML

En `frontend/index.html` y `frontend/docente.html`, actualizá:

```html
<div id="g_id_onload"
     data-client_id="TU_CLIENT_ID_AQUI"
     ...>
</div>
```

---

## 🚀 Paso 5: Publicar Frontend

Elegí una de estas opciones:

### Opción A: GitHub Pages (Recomendado)

1. Creá un repositorio en GitHub
2. Subí la carpeta `frontend/`
3. Andá a Settings > Pages
4. Source: Deploy from a branch
5. Branch: main, carpeta: /frontend
6. Guardá y esperá unos minutos
7. Tu sitio estará en `https://tuusuario.github.io/repo-name/`

### Opción B: Google Sites

1. Creá un nuevo Google Site
2. Insertá un "Embed" (HTML personalizado)
3. Pegá el contenido de `index.html`
4. Publicá el sitio

### Opción C: Netlify/Vercel

1. Creá cuenta en [Netlify](https://netlify.com) o [Vercel](https://vercel.com)
2. Arrastrá la carpeta `frontend/` al dashboard
3. Deploy automático

---

## 📱 Paso 6: Compartir en Google Classroom

### Para Estudiantes

1. Copiá el link del frontend (index.html)
2. En Classroom, creá un nuevo Material o Tarea
3. Agregá el link
4. Título sugerido: "Asistencia y Ticket de Salida"
5. Instrucciones: "Ingresá con tu cuenta del colegio y usá el código que anuncie en clase"

### Para Docentes

1. Compartí el link de `docente.html` solo con docentes
2. Asegurate de que sus emails estén en la hoja `_docentes`

---

## ✅ Paso 7: Verificación

### Test Estudiante

1. Abrí el link de estudiante en modo incógnito
2. Iniciá sesión con Google
3. Creá una sesión de prueba desde el panel docente
4. Ingresá el código en el portal estudiante
5. Completá el ticket de salida
6. Verificá que aparezca en Google Sheets

### Test Docente

1. Abrí el link de docente
2. Iniciá sesión con un email autorizado
3. Creá una sesión de prueba
4. Activala
5. Duplicala
6. Verificá que todo funcione

---

## 🔐 Seguridad

### Importante

- **NUNCA** compartas el Spreadsheet ID públicamente
- **NUNCA** compartas la URL del Apps Script Web App
- Mantené la lista de docentes actualizada en `_docentes`
- Revisá periódicamente los permisos del proyecto de Google Cloud

### Recomendaciones

- Usá un dominio institucional para Google Workspace
- Configurá restricciones de dominio en Google Cloud Console
- Hacé backups periódicos del Spreadsheet

---

## 🐛 Troubleshooting

### "Token inválido o expirado"
- Verificá que el Client ID esté bien configurado
- Asegurate de que los dominios estén autorizados en Google Cloud Console

### "No autorizado. Solo docentes"
- Verificá que el email esté en la hoja `_docentes`
- Revisá que no haya espacios extra en el email

### "Error de conexión"
- Verificá que la URL del Apps Script esté correcta
- Asegurate de que el Web App esté implementado como "Cualquier usuario"

### Los envíos no aparecen en Sheets
- Verificá que el SPREADSHEET_ID sea correcto
- Revisá los logs en Apps Script (Ver > Registros)

---

## 📞 Soporte

Si tenés problemas:

1. Revisá los logs en Apps Script
2. Usá la consola del navegador (F12) para ver errores
3. Verificá que todos los pasos se hayan completado correctamente

---

## 🎉 ¡Listo!

Tu sistema de asistencia está funcionando. Los estudiantes pueden registrar su presencia y completar tickets de salida, y vos podés ver todo en tiempo real desde el panel docente.

**Próximos pasos sugeridos:**
- Personalizá los colores en `styles.css`
- Agregá más materias si es necesario
- Configurá recordatorios automáticos (opcional)
