import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { loginApi } from '../services/api';
import { LogIn, LogOut, X, Lock, Mail, AlertCircle, Loader2, LayoutDashboard } from 'lucide-react';

export default function Navbar({ isLoggedIn, user, onLogin, onLogout, isLoginOpen = false, setIsLoginOpen = () => {} }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  function handleClose() {
    setIsLoginOpen(false);
    setErrorMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      // Valida credenciais diretamente contra o banco de dados PostgreSQL (Barreiro)
      const data = await loginApi(email.trim(), password);
      
      if (onLogin) {
        onLogin(data.user || { email: email.trim() });
      }
      handleClose();
      navigate('/portal');
    } catch (err) {
      console.error("Erro na autenticação:", err);
      setErrorMsg(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha no banco de dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-white/95 py-3.5 text-zinc-900 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Esquerda: Logo + Nome do Sistema */}
          <div className="flex items-center gap-3">
            <Logo isDark={false} className="h-9 sm:h-10" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="h-6 w-px bg-zinc-200"></div>
              <div>
                <div className="font-condensed text-sm font-bold uppercase leading-none tracking-wide text-zinc-900">
                  Portal RH
                </div>
                <div className="text-xs font-semibold leading-tight text-zinc-500">
                  Irmãos Barreiro
                </div>
              </div>
            </div>
          </div>

          {/* Direita: Login ou Status Conectado */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/portal')}
                  className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 sm:text-sm rounded-xl shadow-xs"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Área do Colaborador</span>
                </button>

                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200 sm:text-sm rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="inline-flex items-center gap-2 bg-red-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 rounded-xl shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Modal de Acesso - Entrar no Sistema */}
      {isLoginOpen && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 relative my-auto">
            
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-[11px] font-bold uppercase tracking-wider mb-3 border border-red-100">
                <Lock className="w-3 h-3 text-red-600" />
                <span>Área Restrita</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Entrar no Sistema
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Informe suas credenciais para acessar o portal da Distribuidora Irmãos Barreiro.
              </p>
            </div>

            {/* Mensagem de Erro de Autenticação */}
            {errorMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  E-mail ou Usuário
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colaborador@irmaosbarreiro.com.br"
                    required
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm"
                  />
                </div>
              </div>

              <button
                id="btn-submit-modal"
                type="submit"
                disabled={loading}
                className="w-full py-3 font-bold text-sm transition-colors duration-150 mt-2 bg-red-700 hover:bg-red-800 text-white cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}
