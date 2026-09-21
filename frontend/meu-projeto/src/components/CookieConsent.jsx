import React, { useState } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'irmaos_barreiro_cookie_consent_session';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      // O aviso reaparece ao iniciar uma nova sessão/aba do site.
      return !sessionStorage.getItem(CONSENT_KEY);
    } catch {
      return true;
    }
  });

  function saveConsent(value) {
    try {
      sessionStorage.setItem(CONSENT_KEY, value);
    } catch {
      // O banner continua funcionando mesmo se o navegador bloquear armazenamento.
    }
    setIsVisible(false);
  }

  if (!isVisible) return null;

  return (
    <aside
      className="cookie-consent no-print animate-fadeIn"
      role="dialog"
      aria-label="Preferências de cookies"
      aria-live="polite"
    >
      <div className="cookie-consent__icon" aria-hidden="true">
        <Cookie className="w-7 h-7" strokeWidth={1.8} />
      </div>

      <div className="cookie-consent__content">
        <div className="cookie-consent__eyebrow">
          <ShieldCheck className="w-3.5 h-3.5" />
          Navegação segura
        </div>
        <h2>Cookies do Irmãos Barreiros</h2>
        <p>
          Usamos cookies essenciais para manter o site funcionando e lembrar suas preferências.
          Você escolhe como deseja continuar.
        </p>
        <Link to="/politica-de-privacidade" className="cookie-consent__link">
          Saiba mais na Política de Privacidade
        </Link>
      </div>

      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__secondary" onClick={() => saveConsent('rejected')}>
          Recusar
        </button>
        <button type="button" className="cookie-consent__primary" onClick={() => saveConsent('accepted')}>
          Aceitar cookies
        </button>
      </div>

      <button
        type="button"
        className="cookie-consent__close"
        onClick={() => saveConsent('dismissed')}
        aria-label="Fechar aviso de cookies"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
