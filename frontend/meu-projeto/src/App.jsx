import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PortalColaborador from './components/PortalColaborador';
import Historia from './components/Historia';
import Footer from './components/Footer';
import PoliticaPrivacidade from './components/PoliticaPrivacidade';
import CookieConsent from './components/CookieConsent';

import { getCurrentUserApi, logoutApi, clearAllAppStorage, getAuthToken } from './services/api';

function Home({ isLoggedIn, user, onLogin, onLogout }) {
  // Estado do modal de login elevado para cá, para que o Hero da home
  // também possa acionar o modal com o mesmo CTA "Entrar".
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="min-h-screen text-slate-900 flex flex-col antialiased selection:bg-red-700 selection:text-white bg-white">
      {/* Navbar institucional */}
      <Navbar
        isLoggedIn={isLoggedIn}
        user={user}
        onLogin={onLogin}
        onLogout={onLogout}
        isLoginOpen={isLoginOpen}
        setIsLoginOpen={setIsLoginOpen}
      />

      {/* Área principal corporativa */}
      <main className="flex-grow">
        <Historia
          isLoggedIn={isLoggedIn}
          onOpenLogin={() => setIsLoginOpen(true)}
        />
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-zinc-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 mx-auto flex items-center justify-center">
              <span className="text-2xl font-black">!</span>
            </div>
            <h2 className="text-lg font-black text-white">Falha ao carregar o módulo</h2>
            <p className="text-xs text-zinc-400">
              Ocorreu uma instabilidade pontual na exibição deste módulo.
            </p>
            <pre className="p-3 bg-black/60 rounded-xl text-left text-[11px] font-mono text-red-400 overflow-x-auto">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg transition cursor-pointer"
            >
              Recarregar Módulo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user_barreiro');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const token = sessionStorage.getItem('barreiro_token');
      const saved = sessionStorage.getItem('user_barreiro');
      return !!(token || saved);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let active = true;

    // Higienização de resíduos antigos em localStorage
    try {
      [
        'barreiro_token',
        'user_barreiro',
        'registros_funcionarios_cache',
        'epis_estoque_cache',
        'epis_funcionarios_cache',
        'lista_pts_cache',
        'diaristas_cache',
        'portal_active_module',
        'data_selecionada_diaristas',
      ].forEach((k) => localStorage.removeItem(k));
    } catch {}

    async function restoreValidatedSession() {
      const token = getAuthToken();
      if (!token) {
        if (active) {
          setIsLoggedIn(false);
          setUser(null);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUserApi();
        if (active && currentUser) {
          setUser(currentUser);
          setIsLoggedIn(true);
          sessionStorage.setItem('user_barreiro', JSON.stringify(currentUser));
        }
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        const isAuthError = msg.includes('401') || msg.includes('sessao invalida') || msg.includes('não autorizado');
        if (isAuthError && active) {
          setIsLoggedIn(false);
          setUser(null);
          clearAllAppStorage();
        } else {
          console.warn('Backend temporariamente indisponível, preservando sessão na aba.');
        }
      }
    }

    restoreValidatedSession();
    return () => {
      active = false;
    };
  }, []);

  function handleLogin(userData) {
    setIsLoggedIn(true);
    setUser(userData);
    try {
      sessionStorage.setItem('user_barreiro', JSON.stringify(userData));
    } catch (err) {
      console.warn('Erro ao salvar dados de sessão:', err);
    }
  }

  async function handleLogout() {
    setIsLoggedIn(false);
    setUser(null);
    try {
      await logoutApi();
    } catch (err) {
      console.warn('Erro ao encerrar sessão:', err);
      clearAllAppStorage();
    }
  }

  return (
    <BrowserRouter>
      <CookieConsent />
      <Routes>
        <Route
          path="/"
          element={
            <Home
              isLoggedIn={isLoggedIn}
              user={user}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          }
        />
        {/* Rota Protegida do Portal do Colaborador */}
        <Route
          path="/portal"
          element={
            isLoggedIn ? (
              <ErrorBoundary>
                <PortalColaborador
                  user={user}
                  onLogout={handleLogout}
                />
              </ErrorBoundary>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
        {/* Rota coringa */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
