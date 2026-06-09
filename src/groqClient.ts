/**
 * Cliente Groq — roteado via /api/groq (Vercel Serverless) em produção
 * para nunca expor a chave no bundle do browser.
 * Em dev local, usa VITE_GROQ_API_KEY diretamente (ou sessionStorage).
 */

const isDev = import.meta.env.DEV;
const localKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('groqApiKey') || '';

export async function groqChat(body: object): Promise<Response> {
  if (isDev && localKey) {
    // Dev: chama Groq diretamente com a chave local
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  // Produção: proxy seguro via Vercel Function (chave nunca chega ao browser)
  return fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
