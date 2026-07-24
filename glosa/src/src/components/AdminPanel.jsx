import React, { useState, useEffect } from 'react';
import {
  db, storage,
  collection, addDoc, onSnapshot, query, orderBy,
  doc, getDocs, setDoc, deleteDoc, updateDoc,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from '../firebase';

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('¡Enlace copiado al portapapeles!');
  });
}

// Upload progress bar
function UploadProgress({ progress }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Subiendo PDF...</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// CSV export helper — includes replies as sub-rows
async function exportDocCSV(materia, docData) {
  const hlSnap = await getDocs(
    query(collection(db, `materias/${materia}/documentos/${docData.id}/highlights`), orderBy('createdAt', 'asc'))
  );
  if (hlSnap.empty) { alert('Este documento no tiene glosas aún.'); return; }

  const rows = [['Tipo', 'Estudiante', 'Página', 'Fragmento seleccionado', 'Etiqueta', 'Texto', 'Fecha', 'Reacciones']];

  for (const d of hlSnap.docs) {
    const h = d.data();
    const page = h.position?.pageNumber || h.position?.boundingRect?.pageNumber || '';
    const reactions = Object.entries(h.reactions || {}).map(([e, ids]) => `${e}×${ids.length}`).filter(s => !s.endsWith('×0')).join(' ');
    rows.push([
      'Glosa',
      h.user?.name || '',
      page,
      (h.content?.text || '').replace(/"/g, '""'),
      h.tag || '',
      (h.comment || '').replace(/"/g, '""'),
      h.createdAt ? new Date(h.createdAt).toLocaleString('es-AR') : '',
      reactions
    ]);

    // Fetch replies for this highlight
    const repliesSnap = await getDocs(
      query(
        collection(db, `materias/${materia}/documentos/${docData.id}/highlights/${d.id}/replies`),
        orderBy('createdAt', 'asc')
      )
    );
    repliesSnap.forEach(r => {
      const rep = r.data();
      rows.push([
        '  ↳ Respuesta',
        rep.user?.name || '',
        '',
        '',
        '',
        (rep.text || '').replace(/"/g, '""'),
        rep.createdAt ? new Date(rep.createdAt).toLocaleString('es-AR') : '',
        ''
      ]);
    });
  }

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `glosas_${docData.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const printStudentReport = async (materia, docId, studentName) => {
  const snap = await getDocs(query(
    collection(db, `materias/${materia}/documentos/${docId}/highlights`),
    orderBy('createdAt', 'asc')
  ));
  const studentHighlights = [];
  snap.forEach(d => {
    const h = d.data();
    if (h.user?.name === studentName) {
      studentHighlights.push(h);
    }
  });

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte de Participación - ${studentName}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; }
        h1 { color: #4338ca; font-size: 22px; margin-bottom: 4px; }
        h2 { color: #64748b; font-size: 14px; font-weight: normal; margin-top: 0; }
        .meta { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin: 20px 0; }
        .card { border: 1px solid #e2e8f0; border-left: 4px solid #4338ca; padding: 12px 16px; margin-bottom: 12px; border-radius: 6px; }
        .tag { display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: bold; }
        .quote { font-style: italic; color: #64748b; margin: 8px 0; border-left: 2px solid #cbd5e1; padding-left: 8px; }
        .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #94a3b8; border-t: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Reporte de Participación Individual</h1>
      <h2>Estudiante: <strong>${studentName}</strong> | Materia: <strong>${materia.replace(/-/g, ' ')}</strong></h2>
      <div class="meta">
        <strong>Documento:</strong> ${docId}<br>
        <strong>Total de glosas:</strong> ${studentHighlights.length}<br>
        <strong>Fecha de emisión:</strong> ${new Date().toLocaleDateString('es-AR')}
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      ${studentHighlights.map((h, i) => `
        <div class="card">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
            <span><strong>Anotación #${i + 1}</strong> ${h.position?.pageNumber ? `· Pág. ${h.position.pageNumber}` : ''}</span>
            <span>${h.createdAt ? new Date(h.createdAt).toLocaleString('es-AR') : ''}</span>
          </div>
          ${h.tag ? `<span class="tag" style="margin-top: 6px;">${h.tag}</span>` : ''}
          ${h.content?.text ? `<div class="quote">"${h.content.text}"</div>` : ''}
          <p style="font-size: 13px; font-weight: 500; margin: 6px 0 0 0;">${h.comment || ''}</p>
        </div>
      `).join('')}
      <div class="footer">Generado por Glosa App — ${new Date().toLocaleDateString('es-AR')}</div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

// ── Participation Stats ─────────────────────────────────────
function ParticipationStats({ materia, docId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDocs(query(
      collection(db, `materias/${materia}/documentos/${docId}/highlights`),
      orderBy('createdAt', 'asc')
    )).then(snap => {
      const byUser = {};
      const pageCount = {};
      snap.forEach(d => {
        const h = d.data();
        const name = h.user?.name || 'Anónimo';
        if (!byUser[name]) byUser[name] = { name, count: 0, pages: new Set(), color: h.user?.color };
        byUser[name].count++;
        const page = h.position?.pageNumber;
        if (page) { byUser[name].pages.add(page); pageCount[page] = (pageCount[page] || 0) + 1; }
      });
      const users = Object.values(byUser).sort((a, b) => b.count - a.count);
      const hotPages = Object.entries(pageCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([page, count]) => ({ page: parseInt(page), count }));
      setStats({ users, hotPages, total: snap.size });
    });
  }, [materia, docId]);

  if (!stats) return <p className="text-xs text-slate-400 py-3 text-center animate-pulse">Cargando estadísticas...</p>;
  if (stats.total === 0) return <p className="text-xs text-slate-400 py-3 text-center">Sin glosas aún en este documento.</p>;
  const maxCount = stats.users[0]?.count || 1;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Participación por estudiante</p>
        <div className="space-y-2">
          {stats.users.map(u => (
            <div key={u.name} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold text-slate-800 flex-shrink-0 shadow-xs" style={{ background: u.color || '#FDE68A' }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-slate-700 truncate">{u.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{u.count} glosa{u.count !== 1 ? 's' : ''} · {u.pages.size} pág.</span>
                    <button
                      onClick={() => printStudentReport(materia, docId, u.name)}
                      className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-semibold px-2 py-0.5 rounded border border-slate-200 transition-colors"
                      title="Imprimir reporte de este estudiante"
                    >🖨️ Reporte</button>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${(u.count / maxCount) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {stats.hotPages.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Páginas más anotadas 🔥</p>
          <div className="flex flex-wrap gap-2">
            {stats.hotPages.map(({ page, count }) => (
              <span key={page} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full font-semibold">
                Pág. {page} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] text-slate-400 text-right">{stats.total} glosas · {stats.users.length} participantes</p>
    </div>
  );
}

// ── Document Card ───────────────────────────────────────────
function DocCard({ docData, materia, baseUrl }) {
  const [commentCount, setCommentCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConsigna, setShowConsigna] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [consigna, setConsigna] = useState(docData.consigna || '');
  const [savingConsigna, setSavingConsigna] = useState(false);

  const link = `${baseUrl}?materia=${encodeURIComponent(materia)}&doc=${encodeURIComponent(docData.id)}`;

  useEffect(() => {
    const q = query(collection(db, `materias/${materia}/documentos/${docData.id}/highlights`));
    const unsub = onSnapshot(q, snap => setCommentCount(snap.size));
    return () => unsub();
  }, [materia, docData.id]);

  // Sync consigna if docData changes
  useEffect(() => { setConsigna(docData.consigna || ''); }, [docData.consigna]);

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar "${docData.nombre}"? Se perderán todos sus comentarios.`)) return;
    setDeleting(true);
    try {
      const fileRef = ref(storage, `materias/${materia}/${docData.id}.pdf`);
      await deleteObject(fileRef).catch(() => {});
      await deleteDoc(doc(db, `materias/${materia}/documentos/${docData.id}`));
    } catch (e) { alert('Error al eliminar el documento.'); }
    setDeleting(false);
  };

  const handleExport = async () => { setExporting(true); await exportDocCSV(materia, docData); setExporting(false); };

  const saveConsigna = async () => {
    setSavingConsigna(true);
    await updateDoc(doc(db, `materias/${materia}/documentos/${docData.id}`), { consigna: consigna.trim() });
    setSavingConsigna(false);
    setShowConsigna(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden hover:shadow-md transition-shadow">
      {/* Main row */}
      <div className="p-4 flex items-center gap-4">
        <div className="text-3xl">📄</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 truncate">{docData.nombre || docData.id}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{commentCount} {commentCount === 1 ? 'glosa' : 'glosas'}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          <button onClick={() => window.open(link, '_blank')} className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors">Abrir</button>
          <button onClick={() => copyToClipboard(link)} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium transition-colors">🔗 Enlace</button>
          <button onClick={handleExport} disabled={exporting} className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40">{exporting ? '...' : '📥'}</button>
          <button onClick={handleDelete} disabled={deleting} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 rounded-lg transition-colors">🗑️</button>
        </div>
      </div>

      {/* Secondary actions bar */}
      <div className="border-t border-slate-50 px-4 py-2 flex gap-3 bg-slate-50/50">
        <button
          onClick={() => { setShowConsigna(v => !v); setShowStats(false); }}
          className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${showConsigna ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
        >
          📝 {docData.consigna ? 'Editar consigna' : 'Agregar consigna'}
        </button>
        <button
          onClick={() => { setShowStats(v => !v); setShowConsigna(false); }}
          className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${showStats ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
        >
          📊 Participación
        </button>
      </div>

      {/* Consigna editor */}
      {showConsigna && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-2 bg-white">
          <label className="text-xs font-semibold text-slate-600 block">Consigna de lectura <span className="text-slate-400 font-normal">(visible para estudiantes en el sidebar)</span></label>
          <textarea
            value={consigna}
            onChange={e => setConsigna(e.target.value)}
            placeholder="Ej: Mientras leés, prestá atención a los conceptos de narratividad e intersubjetivación. ¿Cómo define la autora la relación entre tecnología y aprendizaje?"
            className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none h-24 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowConsigna(false)} className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg">Cancelar</button>
            <button onClick={saveConsigna} disabled={savingConsigna} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40">
              {savingConsigna ? 'Guardando...' : '✓ Guardar consigna'}
            </button>
          </div>
        </div>
      )}

      {/* Stats panel */}
      {showStats && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 bg-white">
          <ParticipationStats materia={materia} docId={docData.id} />
        </div>
      )}
    </div>
  );
}


// ── Tag Manager ────────────────────────────────────────────
// Default tags — shown as starting point and always editable
const DEFAULT_TAGS = [
  { label: '💡 Idea', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: '❓ Duda', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { label: '🎯 Clave', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: '💬 Comentario', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

// All 8 color options for new tags
const TAG_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-teal-100 text-teal-800 border-teal-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-lime-100 text-lime-800 border-lime-300',
  'bg-rose-100 text-rose-800 border-rose-300',
];

// TagManager: handles ALL tags (defaults + custom) in one unified list
function TagManager({ materiaId, tags: savedTags = [] }) {
  // If Firestore has no tags yet, use defaults as starting display
  const tags = savedTags.length > 0 ? savedTags : DEFAULT_TAGS;
  const [newLabel, setNewLabel] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [open, setOpen] = useState(false);

  // Always write to `tags` field (unified)
  const saveTags = async (updated) => {
    await updateDoc(doc(db, `materias/${materiaId}`), { tags: updated });
  };

  const addTag = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await saveTags([...tags, { label, color }]);
    setNewLabel('');
  };

  const deleteTag = async (idx) => {
    if (tags.length <= 1) { alert('Debe quedar al menos una etiqueta.'); return; }
    await saveTags(tags.filter((_, i) => i !== idx));
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditLabel(tags[idx].label);
  };

  const saveEdit = async () => {
    if (!editLabel.trim()) return;
    await saveTags(tags.map((t, i) => i === editingIdx ? { ...t, label: editLabel.trim() } : t));
    setEditingIdx(null);
  };

  const isUsingDefaults = savedTags.length === 0;

  return (
    <div className="border border-dashed border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span>🏷️ Gestionar etiquetas <span className="text-slate-400 font-normal">({tags.length} activas)</span></span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {isUsingDefaults && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Estas son las etiquetas predeterminadas. Podés editarlas, eliminarlas o agregar nuevas. Los cambios se guardan por materia.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {editingIdx === idx ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      className="text-xs border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 w-36"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="text-green-600 font-bold text-sm">✓</button>
                    <button onClick={() => setEditingIdx(null)} className="text-slate-400 text-sm">✕</button>
                  </div>
                ) : (
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${tag.color} flex items-center gap-1`}>
                    {tag.label}
                    <button
                      onClick={() => startEdit(idx)}
                      className="opacity-50 hover:opacity-100 transition-opacity ml-0.5 text-[10px]"
                      title="Editar etiqueta"
                    >✏️</button>
                    <button
                      onClick={() => deleteTag(idx)}
                      className="opacity-50 hover:opacity-100 transition-opacity text-[10px]"
                      title="Eliminar etiqueta"
                    >🗑️</button>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Ej: 📖 Cita, 🔗 Intertexto..."
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={addTag}
              disabled={!newLabel.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-2 rounded-lg disabled:opacity-40 transition-colors"
            >
              + Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Upload PDF form
function UploadPdfForm({ materia, onSuccess }) {
  const [nombre, setNombre] = useState('');
  const [consigna, setConsigna] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Por favor seleccioná un archivo PDF.');
      return;
    }
    if (!nombre.trim()) {
      alert('Por favor escribí un nombre para el documento.');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(10);

    const docId = nombre.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `pdf_${Date.now()}`;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const base64Data = evt.target.result;
          setProgress(30);

          // Chunk base64 string into 400KB pieces for Firestore (1MB limit per doc)
          const chunkSize = 400000;
          const totalChunks = Math.ceil(base64Data.length / chunkSize);

          // Save main metadata doc
          await setDoc(doc(db, `materias/${materia}/documentos/${docId}`), {
            nombre: nombre.trim(),
            consigna: consigna.trim(),
            isChunked: true,
            totalChunks,
            sizeBytes: file.size,
            createdAt: new Date().toISOString()
          });

          // Write each chunk to subcollection
          for (let i = 0; i < totalChunks; i++) {
            const chunkStr = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
            await setDoc(doc(db, `materias/${materia}/documentos/${docId}/chunks/${i}`), {
              index: i,
              data: chunkStr
            });
            setProgress(30 + Math.round(((i + 1) / totalChunks) * 65));
          }

          setProgress(100);
          setUploading(false);
          setNombre('');
          setFile(null);
          alert('¡PDF subido y guardado con éxito!');
          onSuccess && onSuccess();
        } catch (innerErr) {
          console.error('Error procesando chunks:', innerErr);
          setError(`Error al guardar en la base de datos: ${innerErr.message}`);
          alert(`Error al guardar el PDF: ${innerErr.message}`);
          setUploading(false);
        }
      };

      reader.onerror = (rErr) => {
        console.error('Error leyendo archivo:', rErr);
        setError('Error al leer el archivo PDF local.');
        alert('Error al leer el archivo PDF.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error subiendo PDF:', err);
      setError(`Error general: ${err.message}`);
      alert(`Error al subir PDF: ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-indigo-800">Subir nuevo PDF</h4>
      <input
        type="text"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        placeholder="Nombre del texto (ej: Stella Maris Cao - Narratividad)"
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition-colors"
      />
      <textarea
        value={consigna}
        onChange={e => setConsigna(e.target.value)}
        placeholder="Consigna de lectura para los estudiantes (opcional, ej: Prestá atención a las definiciones de tecnología...)"
        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition-colors h-16 resize-none"
      />
      <input
        type="file"
        accept=".pdf"
        onChange={e => {
          const f = e.target.files[0];
          setFile(f);
          if (f && !nombre) {
            setNombre(f.name.replace(/\.pdf$/i, ''));
          }
        }}
        className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
      />
      {uploading && <UploadProgress progress={progress} />}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={!file || !nombre.trim() || uploading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-40"
      >
        {uploading ? 'Subiendo...' : '⬆️ Subir PDF'}
      </button>
    </form>
  );
}

// Materia section
function MateriaSection({ materia, baseUrl }) {
  const [documentos, setDocumentos] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, `materias/${materia.id}/documentos`),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setDocumentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [materia.id]);

  const handleDeleteMateria = async () => {
    if (!window.confirm(`¿Eliminar la materia "${materia.nombre}"? Se eliminarán todos sus documentos.`)) return;
    await deleteDoc(doc(db, `materias/${materia.id}`));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{materia.emoji || '📚'}</span>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{materia.nombre}</h3>
            <p className="text-xs text-slate-400">{documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteMateria(); }}
            className="text-xs text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Eliminar materia
          </button>
          <span className="text-slate-400 text-lg">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
          {documentos.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No hay documentos aún. Subí el primer PDF.</p>
          )}
          {documentos.map(d => (
            <DocCard key={d.id} docData={d} materia={materia.id} baseUrl={baseUrl} />
          ))}

          <TagManager materiaId={materia.id} tags={materia.tags || []} />

          {showUpload ? (
            <UploadPdfForm materia={materia.id} onSuccess={() => setShowUpload(false)} />
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 text-sm font-medium py-3 rounded-xl transition-colors hover:bg-indigo-50"
            >
              + Subir PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// New materia form
function NewMateriaForm({ onCreated }) {
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const EMOJIS = ['📚', '📖', '📝', '🏛️', '🔬', '🎭', '🎨', '📐', '🌎', '⚖️'];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const id = nombre.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await setDoc(doc(db, `materias/${id}`), {
      nombre: nombre.trim(),
      emoji,
      createdAt: new Date().toISOString()
    });
    setNombre('');
    onCreated && onCreated();
  };

  return (
    <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-slate-800 text-lg">Nueva Materia</h3>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-2 block">Ícono</label>
        <div className="flex gap-2 flex-wrap">
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`text-xl p-1.5 rounded-lg transition-colors ${emoji === e ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-100'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <input
        type="text"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        placeholder="Nombre de la materia (ej: Literatura Argentina)"
        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 transition-colors"
        autoFocus
      />
      <button
        type="submit"
        disabled={!nombre.trim()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40"
      >
        Crear Materia
      </button>
    </form>
  );
}

export default function AdminPanel() {
  const [materias, setMaterias] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const baseUrl = window.location.origin + window.location.pathname;

  useEffect(() => {
    const q = query(collection(db, 'materias'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMaterias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)' }}>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h1 className="font-bold text-slate-800 text-xl">Glosa App</h1>
              <p className="text-xs text-slate-400">Panel de la Docente</p>
            </div>
          </div>
          <button
            onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Mis Materias</h2>
          <button
            onClick={() => setShowNewForm(s => !s)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-indigo-200"
          >
            {showNewForm ? '✕ Cancelar' : '+ Nueva Materia'}
          </button>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">💡 ¿Cómo funciona?</p>
          <ol className="list-decimal list-inside space-y-1 text-amber-700">
            <li>Creá una materia (ej: "Literatura Argentina").</li>
            <li>Subí un PDF dentro de esa materia.</li>
            <li>Copiá el enlace generado y pegalo en Moodle.</li>
            <li>Los estudiantes abren el enlace, se identifican y dejan sus glosas.</li>
          </ol>
        </div>

        {showNewForm && (
          <NewMateriaForm onCreated={() => setShowNewForm(false)} />
        )}

        {materias.length === 0 && !showNewForm && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg font-medium text-slate-500">Aún no tenés materias</p>
            <p className="text-sm mt-2">Hacé clic en "Nueva Materia" para empezar.</p>
          </div>
        )}

        {materias.map(m => (
          <MateriaSection key={m.id} materia={m} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
}
