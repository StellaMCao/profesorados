import React, { useState } from 'react';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
} from 'react-pdf-highlighter';
import 'react-pdf-highlighter/dist/style.css';
import { getUserColor } from './AuthModal';
import * as pdfjsLib from 'pdfjs-dist';

if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const DEFAULT_TAGS = [
  { label: '💡 Idea', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: '❓ Duda', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { label: '🎯 Clave', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: '💬 Comentario', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

function HighlightTip({ onConfirm, onOpen, onUpdate, customTags = [] }) {
  // customTags here is already the full unified list from App.jsx (defaults + teacher edits)
  // Only fall back to DEFAULT_TAGS if nothing was passed (e.g. local dummy PDF without materia)
  const allTags = customTags.length > 0 ? customTags : DEFAULT_TAGS;
  const [comment, setComment] = useState('');
  const [tag, setTag] = useState(allTags[3]?.label || allTags[0]?.label || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div
        className="animate-pop bg-indigo-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full cursor-pointer shadow-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-1.5 hover:scale-105 select-none"
        onClick={() => { setIsOpen(true); onOpen && onOpen(); }}
      >
        <span>✏️</span>
        <span>Añadir glosa</span>
      </div>
    );
  }

  return (
    <div className="animate-pop bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 p-4 w-80 font-sans z-50">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-heading">
          Nueva glosa marginal
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      {/* Tag selector */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {allTags.map(t => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTag(t.label)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
              tag === t.label ? `${t.color} font-semibold shadow-xs` : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        autoFocus
        placeholder="Escribé tu comentario sobre este fragmento..."
        value={comment}
        onChange={(e) => { setComment(e.target.value); onUpdate && onUpdate(); }}
        className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none h-24 transition-all"
      />

      {/* Privacy toggle */}
      <button
        type="button"
        onClick={() => setIsPrivate(v => !v)}
        className={`mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
          isPrivate
            ? 'bg-slate-800 text-white border-slate-700'
            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
        }`}
      >
        <span>{isPrivate ? '🔒' : '🔓'}</span>
        <span className="flex-1 text-left">
          {isPrivate ? 'Privada — solo vos y la docente la ven' : 'Pública — visible para toda la clase'}
        </span>
      </button>

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (comment.trim()) {
              onConfirm({ comment: comment.trim(), tag, isPrivate });
            }
          }}
          disabled={!comment.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-40"
        >
          Guardar glosa ✨
        </button>
      </div>
    </div>
  );
}

export default function DocumentViewer({ url, highlights, addHighlight, scrollRef, user, customTags = [] }) {
  const [showTip, setShowTip] = useState(() => {
    return localStorage.getItem('marginalia_hide_student_tip') !== 'true';
  });

  return (
    <div className="h-full w-full relative bg-slate-200">
      {/* Floating student tip banner */}
      {showTip && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3 border border-slate-700/60 animate-pop max-w-md">
          <span className="text-base flex-shrink-0">💡</span>
          <p className="flex-1 text-slate-200 leading-snug">
            <strong>¿Cómo comentar?</strong> Seleccioná cualquier fragmento de texto con el ratón para crear una glosa.
          </p>
          <button
            onClick={() => {
              setShowTip(false);
              localStorage.setItem('marginalia_hide_student_tip', 'true');
            }}
            className="text-slate-400 hover:text-white font-bold text-xs p-1 rounded-full hover:bg-slate-800 transition-colors"
            title="Cerrar sugerencia"
          >✕</button>
        </div>
      )}
      <PdfLoader
        url={url}
        beforeLoad={
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-heading text-sm text-slate-600 font-medium">Cargando documento PDF...</p>
          </div>
        }
      >
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={() => {}}
            scrollRef={(scrollTo) => {
              if (scrollRef) scrollRef.current = scrollTo;
            }}
            onSelectionFinished={(position, content, hideTipAndSelection, transformSelection) => (
              <HighlightTip
                onOpen={transformSelection}
                onUpdate={transformSelection}
                customTags={customTags}
                onConfirm={(commentData) => {
                  addHighlight({
                    content: { ...content },
                    position,
                    comment: commentData.comment,
                    tag: commentData.tag
                  });
                  hideTipAndSelection();
                }}
              />
            )}
            highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
              const isTextHighlight = !highlight.content?.image;

              const component = isTextHighlight ? (
                <Highlight
                  isScrolledTo={isScrolledTo}
                  position={highlight.position}
                  comment={highlight.comment}
                />
              ) : (
                <AreaHighlight
                  isScrolledTo={isScrolledTo}
                  highlight={highlight}
                  onChange={() => {}}
                />
              );

              return (
                <Popup
                  popupContent={
                    <div className="animate-pop bg-slate-900/90 backdrop-blur-md text-white text-xs px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/50 max-w-xs space-y-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-indigo-300 font-heading">{highlight.user?.name}</span>
                        {highlight.tag && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-200 px-1.5 py-0.5 rounded font-medium">
                            {highlight.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-200 leading-relaxed">{highlight.comment || highlight.content?.text}</p>
                    </div>
                  }
                  onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
                  onMouseOut={hideTip}
                  key={index}
                >
                  {component}
                </Popup>
              );
            }}
            highlights={highlights}
          />
        )}
      </PdfLoader>
    </div>
  );
}
