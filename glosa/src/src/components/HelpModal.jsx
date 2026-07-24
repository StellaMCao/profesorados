import React, { useState } from 'react';

export default function HelpModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('uso');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-pop">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl backdrop-blur-md">
              ❓
            </div>
            <div>
              <h3 className="font-bold text-lg font-heading leading-tight">Guía de uso & Ayuda</h3>
              <p className="text-xs text-indigo-100 mt-0.5">Glosa App — Lectura anotada y colaborativa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-4 pt-2 gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('uso')}
            className={`text-xs font-bold py-2 px-3 rounded-t-xl border-b-2 transition-all ${
              activeTab === 'uso'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            📖 Cómo usar
          </button>
          <button
            onClick={() => setActiveTab('funciones')}
            className={`text-xs font-bold py-2 px-3 rounded-t-xl border-b-2 transition-all ${
              activeTab === 'funciones'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ✨ Funcionalidades
          </button>
          <button
            onClick={() => setActiveTab('docente')}
            className={`text-xs font-bold py-2 px-3 rounded-t-xl border-b-2 transition-all ${
              activeTab === 'docente'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            👩‍🏫 Rol Docente
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {activeTab === 'uso' && (
            <>
              <div className="flex items-start gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <span className="text-xl">1️⃣</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-0.5">Seleccioná un fragmento de texto</h4>
                  <p>Arrastrá el cursor sobre las líneas del documento PDF que quieras comentar o analizar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <span className="text-xl">2️⃣</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-0.5">Añadí tu glosa marginal</h4>
                  <p>Hacé clic en el botón flotante <strong>✏️ Añadir glosa</strong>. Elegí una etiqueta (Idea, Duda, Clave...), escribí tu reflexión y guardá.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <span className="text-xl">🖼️</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-0.5">Comentá imágenes, gráficos o esquemas</h4>
                  <p>Cambiá al modo <strong>🖼️ Imagen / Área</strong> (arriba a la derecha) o mantené la tecla <code>Alt</code> para dibujar un recuadro sobre cualquier ilustración o gráfico del PDF.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <span className="text-xl">3️⃣</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-0.5">Interactuá en el panel lateral</h4>
                  <p>Hacé clic en cualquier glosa del panel derecho para ir directamente a la página correspondiente del PDF.</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'funciones' && (
            <>
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <span className="font-bold text-slate-800 text-xs block mb-1">🔒 Glosas Privadas vs Públicas</span>
                  <p className="text-slate-600">Al crear una glosa podés elegir si es <strong>pública</strong> (toda la clase la ve) o <strong>privada</strong> (únicamente visible para vos y la docente).</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <span className="font-bold text-slate-800 text-xs block mb-1">💬 Hilos de respuesta y reacciones</span>
                  <p className="text-slate-600">Podés responder a las anotaciones de tus compañeros haciendo clic en <strong>"Responder"</strong>, o reaccionar con emojis (👍, 🤔, ❤️, ✨).</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <span className="font-bold text-slate-800 text-xs block mb-1">↔️ Panel redimensionable</span>
                  <p className="text-slate-600">En computadoras, podés arrastrar la línea vertical entre el texto y el panel para dar más espacio de lectura o de comentarios.</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <span className="font-bold text-slate-800 text-xs block mb-1">🔍 Buscador y filtro por etiquetas</span>
                  <p className="text-slate-600">Usá el buscador superior del panel para encontrar glosas por autor, palabra clave o filtrar por categoría específica.</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'docente' && (
            <>
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                  <span className="font-bold text-xs block mb-1">⚙️ Gestión total desde el Panel Docente</span>
                  <p>Ingresando con tu contraseña o cuenta Google docente podés acceder a <code>?admin=true</code> para administrar todas las materias y lecturas.</p>
                </div>

                <ul className="space-y-2 text-slate-600 list-disc pl-4">
                  <li><strong>Consigna de lectura:</strong> Establecé una indicación o pregunta orientadora que los estudiantes verán fija en la parte superior del documento.</li>
                  <li><strong>Etiquetas personalizadas:</strong> Agregá, modificá o eliminá etiquetas globales para adaptar las categorías de anotación a cada materia.</li>
                  <li><strong>Dashboard de participación:</strong> Visualizá métricas en tiempo real sobre la cantidad de glosas por estudiante y un mapa de calor de las páginas más anotadas.</li>
                  <li><strong>Exportación a CSV / Excel:</strong> Descargá todas las glosas con sus respectivas respuestas estructuradas en un archivo de hoja de cálculo.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-all shadow-xs"
          >
            Entendido 👍
          </button>
        </div>
      </div>
    </div>
  );
}
