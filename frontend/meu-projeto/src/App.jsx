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
              <PortalColaborador
                user={user}
                onLogout={handleLogout}
              />
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
