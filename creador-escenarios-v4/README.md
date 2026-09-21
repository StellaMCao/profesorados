# Creador de Escenarios Ramificados (v4)

Herramienta interactiva para la creación, edición y exportación de escenarios ramificados (*branching scenarios*), narrativas interactivas, simulaciones y lecciones educativas con soporte multimedia enriquecido.

---

## 🚀 Nuevas características en la Versión 4

1. **⏱ Sincronización precisa de botones con Video:**
   - Define el **segundo exacto de aparición** (`videoAppearTime`) de cada botón de decisión.
   - Define el **segundo de desaparición** (`videoDisappearTime`) opcional para botones con límite de tiempo.
   - **Pausa automática configurable:** Pausa el video automáticamente cuando un botón u opción aparece en pantalla para dar tiempo a elegir.
   - **Botón "⏱ Actual":** Captura el timestamp actual del video en el editor con un solo clic.

2. **🎞 Línea de tiempo interactiva (Scrubber) en el editor:**
   - Barra de control y navegación temporal integrada bajo el canvas para escenas con video.
   - Marcas visuales de botones programados en la línea de tiempo.
   - Filtro para previsualizar únicamente los botones que coinciden con el segundo seleccionado.

3. **🎮 Comandos opcionales en el reproductor de video:**
   - Reproductor con interfaz moderna: Play/Pause, barra de progreso interactiva (timeline scrubber), indicador de tiempo transcurrido / total, volumen y pantalla completa.
   - **100% Configurable:** Puedes activar o desactivar la barra de controles tanto a nivel global del proyecto como individualmente por escena.

4. **💾 Exportación múltiple y portable:**
   - Exportación a archivo único autónomo (`.html`) sin dependencias externas.
   - Exportación a paquete `.zip` interactivo con assets locales.
   - Guardado y carga de borradores en formato `.branch`.
   - Exportación a guion gráfico en PDF.
   - Grabación y exportación de simulación a Video MP4/WebM.

---

## 🛠 Instalación y Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar versión autónoma (single-file HTML)
npm run build
```

El archivo compilado se genera en `dist/index.html` y puede ejecutarse directamente abriéndolo con doble clic en cualquier navegador moderno.

---

## 📄 Licencia

Desarrollado para uso educativo y pedagógico.
