import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, auth, signOut, doc, getDoc, getDocs } from './firebase';
import DocumentViewer from './components/DocumentViewer';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import AdminPanel, { exportDocPDF } from './components/AdminPanel';
import HelpModal from './components/HelpModal';

// Convert Base64 DataURL to Blob URL so PDF.js can load it natively
function dataURLtoBlobUrl(dataurl) {
  if (!dataurl) return null;
  if (!dataurl.startsWith('data:')) return dataurl; // already a URL
  try {
    const [header, b64] = dataurl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (e) {
    console.error('dataURLtoBlobUrl error:', e);
    return null;
  }
}

async function loadPdfFromFirestore(materia, docId) {
  // Clean docId
  const cleanId = decodeURIComponent(docId).replace(/\.pdf$/i, '');

  // Try exact path
  const paths = [
    `materias/${materia}/documentos/${cleanId}`,
    `materias/${encodeURIComponent(materia)}/documentos/${cleanId}`,
  ];

  let snap = null;
  for (const path of paths) {
    const ref = doc(db, path);
    snap = await getDoc(ref);
    if (snap.exists()) break;
  }

  if (!snap || !snap.exists()) {
    console.warn('Documento no encontrado en Firestore:', cleanId);
    return { nombre: cleanId, url: null, consigna: '' };
  }

  const data = snap.data();
  const nombre = data.nombre || cleanId;
  const consigna = data.consigna || '';

  if (!data.isChunked) {
    return { nombre, consigna, url: data.url ? dataURLtoBlobUrl(data.url) : null };
  }

  // Reconstruct chunked PDF
  const chunksRef = collection(db, `materias/${materia}/documentos/${cleanId}/chunks`);
  const chunksQ = query(chunksRef, orderBy('index', 'asc'));
  const chunksSnap = await getDocs(chunksQ);

  if (chunksSnap.empty) {
    console.warn('No se encontraron chunks para', cleanId);
    return { nombre, consigna, url: null };
  }

  const chunks = [];
  chunksSnap.forEach(c => chunks.push(c.data()));
  chunks.sort((a, b) => a.index - b.index);

  const fullBase64 = chunks.map(c => c.data).join('');
  const blobUrl = dataURLtoBlobUrl(fullBase64);
  return { nombre, consigna, url: blobUrl };
}

function App() {
  const [user, setUser] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [materia, setMateria] = useState(null);
  const [docNombre, setDocNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [customTags, setCustomTags] = useState([]);
  const [consigna, setConsigna] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('marginalia_sidebar_width');
    return saved ? parseInt(saved, 10) : 340;
  });
  const scrollRef = useRef(null);
  const sidebarRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Apply sidebar width to DOM on every change (desktop only)
  useLayoutEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    if (window.innerWidth >= 768) {
      el.style.width = sidebarWidth + 'px';
      el.style.minWidth = '220px';
    } else {
      el.style.width = '';
      el.style.minWidth = '';
    }
  }, [sidebarWidth]);

  // Resizable divider logic
  const handleDragStart = (e) => {
    isDragging.current = true;
    dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const delta = dragStartX.current - clientX; // drag left = sidebar wider
      const next = Math.min(Math.max(dragStartWidth.current + delta, 220), window.innerWidth - 320);
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('marginalia_sidebar_width', String(Math.round(sidebarWidth)));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docParam = params.get('doc');
    const materiaParam = params.get('materia');
    const adminParam = params.get('admin');

    if (materiaParam && docParam) {
      setIsAdmin(adminParam === 'true');
      setMateria(decodeURIComponent(materiaParam));
      setDocumentId(decodeURIComponent(docParam));
    } else if (docParam) {
      setIsAdmin(adminParam === 'true');
      setDocumentId(decodeURIComponent(docParam));
      setDocumentUrl(`/pdfs/${decodeURIComponent(docParam)}.pdf`);
    } else {
      // Default view when entering app: Panel Docente
      setIsAdmin(adminParam !== 'false');
      setDocumentId('dummy');
      setDocumentUrl('/pdfs/dummy.pdf');
      setDocNombre('Narratividad y tecnología en educación a distancia');
    }

    const savedUser = localStorage.getItem('marginalia_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
  }, []);

  // Load PDF from Firestore when materia + documentId are set
  useEffect(() => {
    if (!materia || !documentId) return;

    let cancelled = false;
    setLoadingPdf(true);
    setLoadError(null);
    setDocumentUrl(null);

    loadPdfFromFirestore(materia, documentId)
      .then(({ nombre, url, consigna: c }) => {
        if (cancelled) return;
        setDocNombre(nombre);
        setConsigna(c || '');
        if (url) {
          setDocumentUrl(url);
        } else {
          setLoadError('No se pudo cargar el PDF desde Firestore.');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Error cargando PDF:', err);
        setLoadError(`Error: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingPdf(false);
      });

    return () => { cancelled = true; };
  }, [materia, documentId]);

  // Listen to materia tags (unified field, with DEFAULT_TAGS fallback)
  useEffect(() => {
    if (!materia) return;
    const DEFAULT_TAGS = [
      { label: '💡 Idea', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      { label: '❓ Duda', color: 'bg-rose-100 text-rose-800 border-rose-300' },
      { label: '🎯 Clave', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { label: '💬 Comentario', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    ];
    const unsub = onSnapshot(doc(db, `materias/${materia}`), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setCustomTags(d.tags?.length > 0 ? d.tags : (d.customTags?.length > 0 ? d.customTags : DEFAULT_TAGS));
      }
    });
    return () => unsub();
  }, [materia]);

  // Listen to highlights from Firestore
  useEffect(() => {
    if (!documentId) return;
    const cleanId = documentId.replace(/\.pdf$/i, '');
    const path = materia
      ? `materias/${materia}/documentos/${cleanId}/highlights`
      : `documents/${cleanId}/highlights`;

    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Firestore highlights error:', err));
    return () => unsub();
  }, [documentId, materia]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('marginalia_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (user?.authType === 'google') signOut(auth);
    setUser(null);
    localStorage.removeItem('marginalia_user');
  };

  const addHighlight = async (highlight) => {
    if (!documentId) return;
    const cleanId = documentId.replace(/\.pdf$/i, '');
    const path = materia
      ? `materias/${materia}/documentos/${cleanId}/highlights`
      : `documents/${cleanId}/highlights`;
    try {
      await addDoc(collection(db, path), {
        ...JSON.parse(JSON.stringify(highlight)),
        user: { uid: user.uid, name: user.name, color: user.color || '#FDE68A' },
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error guardando glosa:', e);
      alert(`Error al guardar la glosa: ${e.message}`);
    }
  };

  const scrollToHighlight = (highlight) => {
    if (scrollRef.current) scrollRef.current(highlight);
  };

  if (isAdmin) {
    // Must be logged in as docente to access admin panel
    if (!user) {
      return <AuthModal onLogin={handleLogin} adminMode />;
    }
    if (user.role !== 'docente') {
      return (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-4">
            <span className="text-4xl">🔒</span>
            <h2 className="font-bold text-slate-800 text-lg">Acceso restringido</h2>
            <p className="text-sm text-slate-500">Este panel es exclusivo para la docente. Tu sesión actual es de estudiante.</p>
            <button
              onClick={() => { setUser(null); localStorage.removeItem('marginalia_user'); }}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm"
            >Iniciar sesión como Docente</button>
          </div>
        </div>
      );
    }
    return <AdminPanel />;
  }
  if (!user) return <AuthModal onLogin={handleLogin} />;

  const docTitle = docNombre || documentId || 'Documento PDF';

  const renderViewer = () => {
    if (loadingPdf) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-heading text-sm text-slate-600 font-medium">Cargando documento PDF...</p>
          <p className="text-xs text-slate-400">Ensamblando desde la base de datos, puede tardar unos segundos.</p>
        </div>
      );
    }
    if (loadError) {
      return (
        <div className="flex items-center justify-center h-full flex-col gap-3 text-center px-8">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm font-medium text-slate-700">No se pudo cargar el documento</p>
          <p className="text-xs text-red-500">{loadError}</p>
        </div>
      );
    }
    if (documentUrl) {
      return (
        <DocumentViewer
          url={documentUrl}
          highlights={highlights}
          addHighlight={addHighlight}
          scrollRef={scrollRef}
          user={user}
          customTags={customTags}
        />
      );
    }
    return (
      <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-heading text-sm text-slate-600">Preparando visor...</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-slate-100">
      {/* Top Header Bar */}
      <header className="flex-shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 py-3 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-200 flex-shrink-0">
            📝
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800 font-heading leading-tight">Glosa App</h1>
              {materia && (
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-100">
                  {materia.replace(/-/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate font-medium flex items-center gap-1">
              <span>📄</span>
              <span className="truncate">{docTitle}</span>
            </p>
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={async () => {
              setExportingPdf(true);
              await exportDocPDF(materia, { id: documentId, nombre: docTitle, consigna });
              setExportingPdf(false);
            }}
            disabled={exportingPdf}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all border border-slate-200 shadow-xs disabled:opacity-40"
            title="Exportar reporte PDF completo con consigna, citas de texto, capturas e hilos de respuesta"
          >
            <span>🖨️</span>
            <span>{exportingPdf ? 'Generando...' : 'Exportar PDF'}</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all border border-indigo-200/80 shadow-xs"
            title="Ver guía de uso y ayuda"
          >
            <span>❓</span>
            <span>Ayuda</span>
          </button>

          <button
            onClick={() => { window.location.href = window.location.origin + window.location.pathname + '?admin=true'; }}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all border border-slate-200/60"
          >
            <span>⚙️</span>
            <span>Panel Docente</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-800 shadow-sm border-2 border-white ring-2 ring-indigo-500/20"
              style={{ background: user.color || '#FDE68A' }}
            >
              {user.photo
                ? <img src={user.photo} className="w-8 h-8 rounded-full object-cover" alt="" />
                : user.name?.charAt(0).toUpperCase()
              }
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-800 font-heading leading-tight">{user.name}</p>
              <span className="text-[10px] text-slate-400 font-medium">{user.role === 'docente' ? 'Docente' : 'Estudiante'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-1"
              title="Cerrar sesión"
            >
              🚶
            </button>
          </div>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-base"
            aria-label="Abrir glosas"
          >
            {sidebarOpen ? '✕' : '💬'}
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* PDF Document Viewer */}
        <div className="flex-1 h-full overflow-hidden relative min-w-0">
          {renderViewer()}
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Resizable drag handle — desktop only */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="hidden md:flex flex-col items-center justify-center w-2.5 flex-shrink-0 cursor-col-resize bg-slate-100 hover:bg-indigo-400 border-x border-slate-200 transition-colors duration-150 z-20 group relative"
          title="Arrastrá para redimensionar"
        >
          {/* Wider invisible hit area */}
          <div className="absolute inset-y-0 -left-2 -right-2" />
          {/* Visual grip dots */}
          <div className="flex flex-col gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-slate-500 group-hover:bg-white" />
            ))}
          </div>
        </div>

        {/* Sidebar — fixed on mobile, resizable on desktop */}
        <div
          className={`
            fixed top-0 right-0 bottom-0 z-30 w-80
            md:relative md:top-auto md:right-auto md:bottom-auto md:z-10
            md:flex-shrink-0
            bg-white border-l border-slate-200/80 shadow-2xl
            flex flex-col transition-transform duration-300 ease-in-out md:transition-none
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
          style={{}}
          ref={sidebarRef}
        >
          <div className="flex-shrink-0 px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="text-base">📌</span>
              <h2 className="text-sm font-bold text-slate-800 font-heading">Glosas Marginales</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                {highlights.length}
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-slate-400 hover:text-slate-600 text-lg leading-none"
              >✕</button>
            </div>
          </div>
          <Sidebar
            highlights={highlights}
            user={user}
            documentId={documentId}
            materia={materia}
            scrollToHighlight={scrollToHighlight}
            consigna={consigna}
          />
        </div>
      </div>

      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}

export default App;
