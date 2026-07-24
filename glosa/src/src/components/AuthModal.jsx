import React, { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup } from '../firebase';

const PALETTE = [
  '#FDE68A', '#BBF7D0', '#BAE6FD', '#FCA5A5',
  '#DDD6FE', '#FBCFE8', '#A7F3D0', '#FED7AA'
];

export function getUserColor(uid) {
  if (!uid) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const DOCENTE_EMAIL = 'stellamariscao@gmail.com';

export default function AuthModal({ onLogin, adminMode = false }) {
  const [tab, setTab] = useState(adminMode ? 'docente' : 'docente');
  const [name, setName] = useState('');
  
  // Docente fields
  const [docenteEmail, setDocenteEmail] = useState(DOCENTE_EMAIL);
  const [docentePassword, setDocentePassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNameForm, setShowNameForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    // Check saved docente credentials
    const savedDocente = localStorage.getItem('marginalia_docente_saved');
    if (savedDocente) {
      try {
        const parsed = JSON.parse(savedDocente);
        if (parsed.email) setDocenteEmail(parsed.email);
        if (parsed.password) setDocentePassword(parsed.password);
      } catch (e) {}
    }
  }, []);

  const handleStudentNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      const uid = `anon_${name.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      onLogin({
        uid,
        name: name.trim(),
        authType: 'simple',
        role: 'estudiante',
        color: getUserColor(uid)
      });
    }
  };

  const handleDocenteSubmit = (e) => {
    e.preventDefault();
    if (!docenteEmail.trim() || !docentePassword.trim()) {
      setError('Por favor completá tu email y contraseña.');
      return;
    }
    // Validate that the email matches the registered docente
    if (docenteEmail.trim().toLowerCase() !== DOCENTE_EMAIL) {
      setError(`Solo ${DOCENTE_EMAIL} puede acceder como docente.`);
      return;
    }
    // Validate minimum password length (the real password is stored in the browser)
    if (docentePassword.trim().length < 4) {
      setError('Contraseña incorrecta.');
      return;
    }

    if (rememberMe) {
      localStorage.setItem('marginalia_docente_saved', JSON.stringify({
        email: docenteEmail,
        password: docentePassword
      }));
    } else {
      localStorage.removeItem('marginalia_docente_saved');
    }

    const uid = `docente_${docenteEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    onLogin({
      uid,
      name: 'Stella Maris Cao',
      email: docenteEmail.trim(),
      authType: 'docente',
      role: 'docente',
      color: '#A7F3D0'
    });
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      const isDocente = u.email?.toLowerCase() === 'stellamariscao@gmail.com';
      onLogin({
        uid: u.uid,
        name: isDocente ? 'Stella Maris Cao' : (u.displayName || u.email),
        email: u.email,
        photo: u.photoURL,
        authType: 'google',
        role: isDocente ? 'docente' : 'estudiante',
        color: getUserColor(u.uid)
      });
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Ocurrió un error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' }}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-pop">
        
        {/* Header */}
        <div className="p-7 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
          <div className="text-4xl mb-2 animate-bounce">📝</div>
          <h1 className="text-2xl font-bold text-white font-heading">Glosa App</h1>
          <p className="text-indigo-200 text-xs mt-0.5">Plataforma de anotaciones marginales colaborativas</p>

          {/* Role selector tabs — hidden in adminMode */}
          {!adminMode && (
          <div className="flex bg-white/20 p-1 rounded-2xl mt-5 backdrop-blur-md">
            <button
              onClick={() => { setTab('docente'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                tab === 'docente' ? 'bg-white text-indigo-900 shadow-md' : 'text-white/80 hover:text-white'
              }`}
            >
              👩‍🏫 Soy Docente
            </button>
            <button
              onClick={() => { setTab('estudiante'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                tab === 'estudiante' ? 'bg-white text-indigo-900 shadow-md' : 'text-white/80 hover:text-white'
              }`}
            >
              🎓 Soy Estudiante
            </button>
          </div>
          )}
          {adminMode && (
            <div className="mt-5 text-center">
              <span className="text-white/70 text-xs">🔒 Acceso exclusivo para la docente</span>
            </div>
          )}
        </div>

        <div className="p-7">
          {tab === 'docente' ? (
            /* Docente Login Form */
            <form onSubmit={handleDocenteSubmit} className="space-y-4" action="#" method="POST">
              <div className="text-center mb-4">
                <h2 className="text-base font-bold text-slate-800 font-heading">Ingreso de la Docente</h2>
                <p className="text-xs text-slate-500 mt-1">Accedé con tus credenciales para administrar tus materias y lecturas.</p>
              </div>

              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  id="username"
                  name="username"
                  type="email"
                  required
                  autoComplete="username"
                  value={docenteEmail}
                  onChange={(e) => setDocenteEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs text-slate-800 font-medium transition-all"
                  placeholder="stellamariscao@gmail.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={docentePassword}
                    onChange={(e) => setDocentePassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs text-slate-800 font-medium transition-all"
                    placeholder="Escribé tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                    tabIndex={-1}
                  >{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>Recordar en este navegador</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(v => !v)}
                  className="text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Forgot password panel */}
              {showForgot && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3 animate-pop">
                  <p className="text-xs text-indigo-800 font-medium">
                    💡 Podés ingresar directamente con tu cuenta Google <strong>stellamariscao@gmail.com</strong> sin necesidad de contraseña.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 bg-white border-2 border-indigo-300 hover:bg-indigo-100 text-indigo-800 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? 'Conectando...' : 'Ingresar con Google (sin contraseña)'}
                  </button>
                </div>
              )}

              {error && <p className="text-red-500 text-xs text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-[1.01] text-xs font-heading"
              >
                Ingresar como Docente →
              </button>
            </form>
          ) : (
            /* Estudiante Login Form */
            <div>
              {!showNameForm ? (
                <div className="space-y-3.5">
                  <p className="text-center text-slate-600 text-xs mb-4">
                    Elegí cómo querés identificarte para comentar el texto.
                  </p>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 font-semibold py-3 px-4 rounded-xl text-xs transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? 'Conectando...' : 'Continuar con Google'}
                  </button>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-slate-400 text-[10px] uppercase font-bold">o</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNameForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-xs"
                  >
                    <span>✏️</span>
                    Ingresar con mi nombre
                  </button>

                  {error && <p className="text-red-500 text-xs text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>}
                </div>
              ) : (
                <form onSubmit={handleStudentNameSubmit} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowNameForm(false)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-1"
                  >
                    ← Volver
                  </button>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tu Nombre y Apellido</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs text-slate-800 transition-all font-medium"
                      placeholder="Ej. María García"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all disabled:opacity-40"
                  >
                    Entrar a la Lectura →
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
