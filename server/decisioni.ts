import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/*  Il proxy verso Jev, il modello che decide invece di scrivere.
 *
 *  Jev non sta fra i modelli di chat di OpenRouter: ha un endpoint suo,
 *  `/api/alpha/decisions`, che riceve uno STATO e delle DOMANDE
 *  tipizzate (noul = sì/no con probabilità, choice, score) e risponde
 *  con numeri, non con testo. In 300-600 ms e per pochi millesimi di
 *  centesimo: è il filtro che decide se vale la pena scomodare il
 *  modello che scrive.
 *
 *  Come per `/api/llm`, la chiave resta qui e il browser non sceglie
 *  il modello: lo dice il .env (`MODELLO_TRIAGE`). */

const ATTESA = 8_000   // ms: una decisione che arriva dopo non serve più
const TENTATIVI = 2

async function chiama(chiave: string, corpo: string) {
  const interruttore = new AbortController()
  const timer = setTimeout(() => interruttore.abort(), ATTESA)
  try {
    return await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chiave}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5180',
        'X-Title': 'Pergamena',
      },
      body: corpo,
      signal: interruttore.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export function decisioni(env: Record<string, string>): Plugin {
  return {
    name: 'pergamena-decisioni',
    configureServer(server) {
      server.middlewares.use('/api/decisioni', async (req: IncomingMessage, res: ServerResponse) => {
        const rispondi = (stato: number, corpo: unknown) => {
          res.statusCode = stato
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(corpo))
        }

        if (req.method !== 'POST') return rispondi(405, { errore: 'solo POST' })

        // dal file, o dalle Impostazioni (vedi server/llm.ts)
        const chiave = env.OPENROUTER_API_KEY || String(req.headers['x-chiave-openrouter'] ?? '')
        const modello = env.MODELLO_TRIAGE
        if (!chiave) return rispondi(503, { errore: 'manca la chiave di OpenRouter: mettila in Impostazioni › Chiavi, o nel .env.local' })
        if (!modello) return rispondi(503, { errore: 'manca MODELLO_TRIAGE in .env.local' })

        let testo = ''
        for await (const pezzo of req) testo += pezzo
        let richiesta: { state?: unknown; questions?: unknown }
        try { richiesta = JSON.parse(testo) } catch { return rispondi(400, { errore: 'corpo non valido' }) }
        if (!richiesta.state || !richiesta.questions) return rispondi(400, { errore: 'servono state e questions' })

        const corpo = JSON.stringify({ model: modello, state: richiesta.state, questions: richiesta.questions })

        let ultimo = ''
        for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
          try {
            const r = await chiama(chiave, corpo)
            if ((r.status === 429 || r.status >= 500) && tentativo < TENTATIVI) {
              ultimo = `OpenRouter ha risposto ${r.status}`
              continue
            }
            res.statusCode = r.status
            res.setHeader('Content-Type', 'application/json')
            return res.end(await r.text())
          } catch (e) {
            ultimo = e instanceof Error && e.name === 'AbortError'
              ? `nessuna risposta in ${ATTESA / 1000} s`
              : `OpenRouter non raggiungibile: ${e instanceof Error ? e.message : e}`
          }
        }
        rispondi(504, { errore: ultimo })
      })
    },
  }
}
