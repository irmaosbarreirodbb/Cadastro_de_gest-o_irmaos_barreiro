import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Origem (protocolo + domínio) da API, para liberar só ela nas chamadas do navegador.
function origemDaApi(url) {
  try {
    return url ? new URL(url.trim()).origin : ''
  } catch {
    return ''
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const api = origemDaApi(env.VITE_API_URL)

  // Política completa de origens permitidas. Vai como "Report-Only": o navegador
  // só avisa no console (F12) o que bloquearia, sem bloquear nada. Depois de
  // conferir que não aparece nenhum aviso no uso normal, dá para trocar o nome do
  // cabeçalho para "Content-Security-Policy" e passar a bloquear de verdade.
  const cspCompleta = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${api} https://viacep.com.br blob: data:`.replace(/\s+/g, ' '),
    "worker-src 'self' blob:",
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  // Cabeçalhos que já protegem sem risco de quebrar o site:
  // - frame-ancestors / X-Frame-Options: impedem que outro site embuta o portal (clickjacking)
  // - object-src 'none' / base-uri: fecham truques comuns de injeção
  // - nosniff, Referrer-Policy, Permissions-Policy, HSTS: endurecimento padrão
  const cabecalhosDeSeguranca = {
    'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    'Content-Security-Policy-Report-Only': cspCompleta,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000',
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    preview: {
      // Em produção (Railway) o site é servido pelo "vite preview" (npm start).
      allowedHosts: true,
      headers: cabecalhosDeSeguranca,
    },
  }
})
