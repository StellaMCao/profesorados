import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from '../firebase';
import { getUserColor } from './AuthModal';

function truncate(str, n = 90) {
  return str && str.length > n ? str.substring(0, n) + '…' : str;
}

// ──────────────────────────────────────────────────────────
// Reaction Bar
// ──────────────────────────────────────────────────────────
const REACTIONS = ['👍', '🤔', '❤️', '✨'];

function ReactionBar({ highlight, basePath, user }) {
  const reactions = highlight.reactions || {};

  const toggle = async (emoji) => {
    if (!user) return;
    const uid = user.uid;
    const current = reactions[emoji] || [];
    const updated = current.includes(uid)
      ? current.filter(id => id !== uid)
      : [...current, uid];
    await updateDoc(doc(db, `${basePath}/${highlight.id}`), {
      [`reactions.${emoji}`]: updated
    });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
      {REACTIONS.map(emoji => {
        const count = (reactions[emoji] || []).length;
        const active = (reactions[emoji] || []).includes(user?.uid);
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-all ${
              active
                ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
            title={active ? 'Quitar reacción' : 'Reaccionar'}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-[10px] font-semibold">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Reply components
// ──────────────────────────────────────────────────────────
function ReplyForm({ onSubmit, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div className="animate-pop mt-3 pl-3 border-l-2 border-indigo-400">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribe tu respuesta..."
        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none h-16 transition-all"
      />
      <div className="flex gap-2 mt-1.5 justify-end">
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
          Cancelar
        </button>
        <button
          onClick={() => { if (text.trim()) { onSubmit(text.trim()); setText(''); } }}
          disabled={!text.trim()}
          className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-all shadow-xs"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ExpandableText (WhatsApp style "Leer más" / "Leer menos")
// ──────────────────────────────────────────────────────────
function ExpandableText({ text, maxLength = 140 }) {
  const [expanded, setExpanded] = useState(false);

  if (!text || text.length <= maxLength) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {expanded ? text : `${text.slice(0, maxLength).trim()}... `}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(prev => !prev);
        }}
        className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline text-xs ml-1 inline-block transition-colors"
      >
        {expanded ? 'Leer menos' : 'Leer más'}
      </button>
    </span>
  );
}

function ReplyItem({ reply, user, repliesPath }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.text || '');
  const color = reply.user?.color || getUserColor(reply.user?.uid || '');
  const canManage = user && (user.role === 'docente' || reply.user?.uid === user.uid || reply.user?.name === user.name);

  const handleDelete = async () => {
    if (window.confirm('¿Eliminar esta respuesta?')) {
      await deleteDoc(doc(db, `${repliesPath}/${reply.id}`));
    }
  };

  const handleUpdate = async () => {
    if (editText.trim()) {
      await updateDoc(doc(db, `${repliesPath}/${reply.id}`), {
        text: editText.trim(),
        editedAt: new Date().toISOString()
      });
      setIsEditing(false);
    }
  };

  return (
    <div className="animate-pop mt-2 pl-3 border-l-2 border-slate-200 group/reply">
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold text-slate-800 shadow-xs"
          style={{ background: color }}
        >
          {reply.user?.name?.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-bold text-slate-700">{reply.user?.name}</span>
        <span className="text-[10px] text-slate-400 ml-auto">
          {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
        {canManage && !isEditing && (
          <div className="flex items-center gap-1 ml-1 opacity-0 group-hover/reply:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="text-[10px] text-slate-400 hover:text-indigo-600" title="Editar">✏️</button>
            <button onClick={handleDelete} className="text-[10px] text-slate-400 hover:text-red-500" title="Eliminar">🗑️</button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="mt-1">
          <input
            type="text"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded p-1 outline-none focus:border-indigo-400"
          />
          <div className="flex justify-end gap-1 mt-1">
            <button onClick={() => setIsEditing(false)} className="text-[10px] text-slate-400 px-1.5 py-0.5">Cancelar</button>
            <button onClick={handleUpdate} className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded">Guardar</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-600 pl-5 leading-relaxed">
          <ExpandableText text={reply.text} maxLength={100} />
          {reply.editedAt && <span className="text-[9px] text-slate-400 italic ml-1">(editado)</span>}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Highlight Card
// ──────────────────────────────────────────────────────────
function HighlightCard({ highlight, user, documentId, materia, scrollToHighlight }) {
  const [replies, setReplies] = useState([]);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editComment, setEditComment] = useState(highlight.comment || '');

  const basePath = materia
    ? `materias/${materia}/documentos/${documentId}/highlights`
    : `documents/${documentId}/highlights`;
  const repliesPath = `${basePath}/${highlight.id}/replies`;

  useEffect(() => {
    if (!highlight.id) return;
    const q = query(collection(db, repliesPath), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [highlight.id, repliesPath]);

  const canManage = user && (user.role === 'docente' || highlight.user?.uid === user.uid || highlight.user?.name === user.name);

  const handleReply = async (text) => {
    await addDoc(collection(db, repliesPath), {
      text,
      user: { uid: user.uid, name: user.name, color: user.color },
      createdAt: new Date().toISOString()
    });
    setShowReplyForm(false);
  };

  const handleDeleteHighlight = async (e) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de eliminar esta glosa?')) {
      await deleteDoc(doc(db, `${basePath}/${highlight.id}`));
    }
  };

  const handleUpdateHighlight = async (e) => {
    e.stopPropagation();
    if (editComment.trim()) {
      await updateDoc(doc(db, `${basePath}/${highlight.id}`), {
        comment: editComment.trim(),
        editedAt: new Date().toISOString()
      });
      setIsEditing(false);
    }
  };

  const togglePin = async (e) => {
    e.stopPropagation();
    await updateDoc(doc(db, `${basePath}/${highlight.id}`), {
      isPinned: !highlight.isPinned
    });
  };

  const userColor = highlight.user?.color || getUserColor(highlight.user?.uid || '');
  const pageNum = highlight.position?.pageNumber || highlight.position?.boundingRect?.pageNumber;
  const isDocente = user?.role === 'docente';

  return (
    <div
      onClick={() => scrollToHighlight && scrollToHighlight(highlight)}
      className={`highlight-item rounded-2xl border p-4 shadow-xs hover:shadow-md cursor-pointer group transition-all ${
        highlight.isPinned
          ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-300/50'
          : 'bg-white border-slate-100 hover:border-slate-200'
      }`}
    >
      {/* Pinned badge */}
      {highlight.isPinned && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full w-fit mb-2 border border-amber-200">
          <span>⭐</span>
          <span>Nota Docente Destacada</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-800 shadow-xs"
            style={{ background: userColor }}
          >
            {highlight.user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="text-xs font-bold text-slate-800 font-heading">{highlight.user?.name || 'Estudiante'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {pageNum && (
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              Pág. {pageNum}
            </span>
          )}
          {isDocente && (
            <button
              onClick={togglePin}
              className={`text-xs p-1 rounded transition-colors ${
                highlight.isPinned ? 'text-amber-500 hover:text-amber-700' : 'text-slate-300 hover:text-amber-500'
              }`}
              title={highlight.isPinned ? 'Quitar destacado' : 'Destacar como nota docente'}
            >⭐</button>
          )}
          {canManage && !isEditing && (
            <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="text-xs p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors"
                title="Editar mi glosa"
              >✏️</button>
              <button
                onClick={handleDeleteHighlight}
                className="text-xs p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-colors"
                title="Eliminar mi glosa"
              >🗑️</button>
            </div>
          )}
        </div>
      </div>

      {/* Tag */}
      {highlight.tag && (
        <span className="inline-block text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md mb-2 border border-indigo-100">
          {highlight.tag}
        </span>
      )}

      {/* Quoted text */}
      {highlight.content?.text && (
        <blockquote
          className="border-l-3 pl-2.5 py-1 my-1.5 text-slate-500 text-xs italic rounded-r leading-relaxed"
          style={{ borderColor: userColor, background: `${userColor}20` }}
        >
          "{truncate(highlight.content.text)}"
        </blockquote>
      )}

      {/* Image / Area screenshot preview */}
      {highlight.content?.image && (
        <div className="my-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1">
          <img
            src={highlight.content.image}
            alt="Captura de imagen o esquema"
            className="w-full max-h-48 object-contain rounded-lg shadow-xs"
          />
        </div>
      )}

      {/* Comment / Edit mode */}
      {isEditing ? (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <textarea
            autoFocus
            value={editComment}
            onChange={e => setEditComment(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-xl p-2 outline-none focus:border-indigo-500 resize-none h-20"
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >Cancelar</button>
            <button
              onClick={handleUpdateHighlight}
              className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
            >Guardar cambios</button>
          </div>
        </div>
      ) : (
        highlight.comment && (
          <p className="text-slate-800 text-xs leading-relaxed font-medium mt-2">
            <ExpandableText text={highlight.comment} maxLength={140} />
            {highlight.editedAt && <span className="text-[10px] text-slate-400 italic ml-1.5">(editado)</span>}
          </p>
        )
      )}

      {/* Reactions */}
      <div className="mt-3 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
        <ReactionBar highlight={highlight} basePath={basePath} user={user} />
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
          {replies.map(r => <ReplyItem key={r.id} reply={r} user={user} repliesPath={repliesPath} />)}
        </div>
      )}

      {/* Reply action */}
      <div className="mt-2 flex items-center justify-between" onClick={e => e.stopPropagation()}>
        <span className="text-[10px] text-slate-400">
          {highlight.createdAt ? new Date(highlight.createdAt).toLocaleDateString('es-AR') : ''}
        </span>
        {showReplyForm ? (
          <div className="w-full">
            <ReplyForm onSubmit={handleReply} onCancel={() => setShowReplyForm(false)} />
          </div>
        ) : (
          <button
            onClick={() => setShowReplyForm(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors hover:underline"
          >
            <span>💬</span>
            <span>
              {replies.length > 0
                ? `${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'} · Responder`
                : 'Responder'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sidebar principal con búsqueda y filtros
// ──────────────────────────────────────────────────────────
export default function Sidebar({ highlights, user, documentId, materia, scrollToHighlight, consigna }) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy] = useState('pagina');

  // Filter: private highlights only visible to the author and docente
  const visible = highlights.filter(h => {
    if (!h.isPrivate) return true;
    if (user?.role === 'docente') return true;
    return h.user?.uid === user?.uid;
  });

  const allTags = [...new Set(visible.map(h => h.tag).filter(Boolean))];

  const filtered = visible.filter(h => {
    if (activeTag === '⭐ Destacadas') return h.isPinned;
    const matchTag = !activeTag || h.tag === activeTag;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      h.comment?.toLowerCase().includes(q) ||
      h.content?.text?.toLowerCase().includes(q) ||
      h.user?.name?.toLowerCase().includes(q) ||
      h.tag?.toLowerCase().includes(q);
    return matchTag && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'pagina') {
      const pageA = a.position?.pageNumber || a.position?.boundingRect?.pageNumber || 0;
      const pageB = b.position?.pageNumber || b.position?.boundingRect?.pageNumber || 0;
      return pageA - pageB;
    }
    if (sortBy === 'autor') {
      const nameA = a.user?.name || '';
      const nameB = b.user?.name || '';
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'fecha') {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA; // newest first
    }
    return 0;
  });

  const cleanId = documentId?.replace(/\.pdf$/i, '');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Consigna box — pinned at top when present */}
      {consigna && (
        <div className="flex-shrink-0 mx-3 mt-3 mb-1 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0 mt-0.5">📚</span>
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Consigna de lectura</p>
              <p className="text-xs text-indigo-900 leading-relaxed">{consigna}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {highlights.length === 0 && (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-400 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl mb-3 shadow-inner">
            📌
          </div>
          <p className="font-bold text-slate-700 font-heading">Sin glosas aún</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Seleccioná cualquier parte del texto en el PDF para añadir la primera anotación.
          </p>
        </div>
      )}

      {/* Search + filter + sort bar */}
      {highlights.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-slate-100 space-y-2 bg-white flex-shrink-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por texto, autor o etiqueta..."
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >✕</button>
            )}
          </div>

          {/* Tag and Special filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTag(null)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all font-semibold ${
                !activeTag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveTag(activeTag === '⭐ Destacadas' ? null : '⭐ Destacadas')}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all font-semibold ${
                activeTag === '⭐ Destacadas' ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              ⭐ Destacadas
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-all font-semibold ${
                  activeTag === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Count and Sort controls */}
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-heading">
              {sorted.length} {sorted.length === 1 ? 'anotación' : 'anotaciones'}
              {(search || activeTag) && ` de ${visible.length}`}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Orden:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
              >
                <option value="pagina">📄 Por página</option>
                <option value="fecha">🕒 Por fecha</option>
                <option value="autor">👤 Por autor</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Highlights list */}
      {highlights.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
          {sorted.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">Sin resultados para tu búsqueda</p>
              <button onClick={() => { setSearch(''); setActiveTag(null); }} className="text-xs text-indigo-600 mt-2 hover:underline">
                Limpiar filtros
              </button>
            </div>
          ) : (
            sorted.map((h, i) => (
              <HighlightCard
                key={h.id || i}
                highlight={h}
                user={user}
                documentId={cleanId}
                materia={materia}
                scrollToHighlight={scrollToHighlight}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
