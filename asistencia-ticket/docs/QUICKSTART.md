# Guía Rápida: Despliegue en 15 Minutos

Esta es la versión simplificada. Para más detalles, ver [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## ⚡ Paso a Paso

### 1️⃣ Google Spreadsheet (3 min)

```
1. Ir a sheets.google.com
2. Crear nuevo spreadsheet
3. Crear hoja "_sessions" con estas columnas:
   session_id, materia, fecha, curso, horario_inicio, horario_fin, 
   codigo, preguntas_json, aceptar_tardios, ventana_tardios, 
   permitir_reenvio, activa, creado_por

4. Crear hoja "_docentes" con columna: email
   Agregar emails de docentes (uno por fila)

5. Copiar ID del spreadsheet de la URL:
   https://docs.google.com/spreadsheets/d/[ESTE_ID]/edit
```

---

### 2️⃣ Apps Script (5 min)

```
1. En el Spreadsheet: Extensiones > Apps Script
2. Pegar código de backend/Code.gs
3. Cambiar línea 6:
   SPREADSHEET_ID: 'TU_ID_AQUI'
4. Guardar (Ctrl+S)
5. Implementar > Nueva implementación
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Acceso: Cualquier usuario
6. Copiar URL del Web App
```

---

### 3️⃣ Google Cloud Console (5 min)

```
1. Ir a console.cloud.google.com
2. Crear proyecto nuevo
3. APIs y servicios > Credenciales
4. Crear credenciales > ID de cliente OAuth 2.0
5. Tipo: Aplicación web
6. Orígenes autorizados: 
   - http://localhost (para testing)
   - https://tuusuario.github.io (tu dominio)
7. Copiar Client ID
```

---

### 4️⃣ Configurar Frontend (2 min)

**En `frontend/app.js` (líneas 6-9):**
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'PEGAR_URL_DEL_WEB_APP_AQUI',
  GOOGLE_CLIENT_ID: 'PEGAR_CLIENT_ID_AQUI'
};
```

**En `frontend/index.html` (línea 11):**
```html
data-client_id="PEGAR_CLIENT_ID_AQUI"
```

**En `frontend/docente.html` (línea 11):**
```html
data-client_id="PEGAR_CLIENT_ID_AQUI"
```

---

### 5️⃣ GitHub Pages

```
1. Crear cuenta en github.com (si no tenés)
2. Crear nuevo repositorio
3. Subir carpeta frontend/
4. Settings > Pages
5. Source: Deploy from a branch
6. Branch: main
7. Guardar
8. Esperar 2-3 minutos
9. Tu sitio estará en: https://tuusuario.github.io/nombre-repo/
```

---

## ✅ Verificar

1. Abrir `https://tuusuario.github.io/nombre-repo/index.html`
2. Login con Google
3. Crear sesión desde `docente.html`
4. Probar código en `index.html`

---

## 🐛 Si algo no funciona

### "Token inválido"
→ Verificá que el Client ID esté bien en los 3 archivos

### "No autorizado"
→ Agregá tu email en la hoja `_docentes`

### "Error de conexión"
→ Verificá que la URL del Apps Script esté correcta en `app.js`

---

## 📞 Necesitás ayuda?

1. Revisá los logs: Apps Script > Ver > Registros
2. Consola del navegador: F12 > Console
3. Verificá que todos los pasos estén completos

---

¡Listo! 🎉
