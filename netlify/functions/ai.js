// Funzione Netlify che fa da ponte tra l'app e un'API di AI compatibile con OpenAI.
// La chiave resta qui, nelle variabili d'ambiente di Netlify: non arriva mai al browser.
//
// Variabili da impostare su Netlify (Site configuration → Environment variables):
//   AI_API_KEY    obbligatoria: la tua chiave API
//   AI_MODEL      obbligatoria: il nome del modello da usare
//   AI_BASE_URL   facoltativa: indirizzo dell'API (predefinito: https://api.openai.com/v1)
//   ACCESS_CODE   consigliata: codice che gli utenti devono inserire nell'app per usare l'AI
//   AI_MAX_TOKENS facoltativa: lunghezza massima della risposta (predefinita 900; alzala per i modelli che "ragionano")

const MAX_PROMPT = 8000;       // caratteri massimi per richiesta
const LIMIT_PER_HOUR = 30;     // richieste per indirizzo IP all'ora (best effort)
const hits = new Map();

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { code: 'method', error: 'Usa POST.' });

  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const access = process.env.ACCESS_CODE;
  const maxTokens = Math.min(8000, Math.max(100, parseInt(process.env.AI_MAX_TOKENS || '900', 10) || 900));
  if (!key || !model) return reply(503, { code: 'not_configured', error: 'AI non configurata sul server.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { code: 'bad_request', error: 'Richiesta non valida.' }); }
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt) return reply(400, { code: 'bad_request', error: 'Manca il testo della richiesta.' });
  if (prompt.length > MAX_PROMPT) return reply(413, { code: 'too_long', error: 'Richiesta troppo lunga.' });
  if (access && body.code !== access) return reply(401, { code: 'bad_code', error: 'Codice di accesso mancante o sbagliato.' });

  // Limite semplice per IP: vale per la singola istanza della funzione, non è una protezione assoluta.
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || 'anon';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (recent.length >= LIMIT_PER_HOUR) return reply(429, { code: 'rate_limited', error: 'Troppe richieste.' });
  recent.push(now); hits.set(ip, recent);

  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.5,
        messages: [
          { role: 'system', content: 'Sei un tutor universitario per matricole italiane. Rispondi in italiano, in modo chiaro e corretto. Se la richiesta chiede JSON, rispondi solo con JSON valido.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Errore API', r.status, JSON.stringify(data).slice(0, 500));
      return reply(502, { code: r.status === 429 ? 'rate_limited' : 'upstream', error: 'Il servizio AI ha risposto con un errore.' });
    }
    const choice = (data.choices || [])[0] || {};
    return reply(200, { text: (choice.message && choice.message.content) || '', truncated: choice.finish_reason === 'length' });
  } catch (e) {
    console.error('Errore di rete', e);
    return reply(502, { code: 'upstream', error: 'Servizio AI non raggiungibile.' });
  }
};
