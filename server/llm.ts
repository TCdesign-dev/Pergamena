import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/*  Il proxy verso OpenRouter.
 *
 *  La chiave sta nel .env.local senza prefisso VITE_, la legge solo
 *  questo codice, e il browser chiede un COMPITO («merge», «quiz»),
 *  non un modello. Il modello lo decide il .env: cambiarlo non tocca
 *  l'app.
 *
 *  Chi non vuole aprire un file può incollare la sua chiave nelle
 *  Impostazioni: arriva qui nell'intestazione `x-chiave-openrouter` e
 *  vale solo per quella richiesta. Il .env.local, se c'è, vince: sta
 *  fuori dal browser, ed è il posto più sicuro dei due.
 *
 *  OpenRouter smista lo stesso modello fra decine di fornitori, e
 *  qualcuno ogni tanto non risponde più: senza un tempo massimo, la
 *  richiesta restava aperta per sempre e l'app diceva «confronto la
 *  lezione…» all'infinito. Quindi:
 *   · un tempo massimo per compito;
 *   · un secondo tentativo, che di solito finisce su un altro fornitore;
 *   · la preferenza per i fornitori veloci invece che per i più economici. */

type Compito = { variabile: string; attesa: number; ordine: 'throughput' | 'latency' }

const COMPITI: Record<string, Compito> = {
  merge: { variabile: 'MODELLO_MERGE', attesa: 90_000, ordine: 'throughput' },
  quiz: { variabile: 'MODELLO_QUIZ', attesa: 60_000, ordine: 'throughput' },
  // anche il veloce per «throughput»: misurato il 21/09, ordinando per
  // «latency» le richieste in JSON finivano su un fornitore degradato che
  // rispondeva dopo 10-13 s ripiegando su un altro; per «throughput», 1,2-1,6 s
  veloce: { variabile: 'MODELLO_VELOCE', attesa: 30_000, ordine: 'throughput' },
}

const TENTATIVI = 2

async function chiama(chiave: string, corpo: string, attesa: number) {
  const interruttore = new AbortController()
  const timer = setTimeout(() => interruttore.abort(), attesa)
  try {
    return await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

export function llm(env: Record<string, string>): Plugin {
  return {
    name: 'pergamena-llm',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req: IncomingMessage, res: ServerResponse) => {
        const rispondi = (stato: number, corpo: unknown) => {
          res.statusCode = stato
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(corpo))
        }

        const nome = (req.url ?? '').replace(/^\//, '').split('?')[0]
        const dalBrowser = String(req.headers['x-chiave-openrouter'] ?? '')

        /*  Come sta messa la configurazione, per le Impostazioni: se la
         *  chiave è nel file, se i modelli ci sono. La chiave non torna
         *  mai indietro, solo il fatto che c'è. */
        if (req.method === 'GET' && nome === 'stato') {
          return rispondi(200, {
            chiaveDalFile: Boolean(env.OPENROUTER_API_KEY),
            chiave: Boolean(env.OPENROUTER_API_KEY || dalBrowser),
            modelli: Object.fromEntries(Object.entries(COMPITI).map(([k, c]) => [k, env[c.variabile] ?? null])),
          })
        }

        /*  «Prova la chiave»: chiede a OpenRouter chi è. Serve a
         *  capire subito se una chiave incollata è buona, invece di
         *  scoprirlo a fine lezione quando il merge non parte. */
        if (req.method === 'GET' && nome === 'prova') {
          const chiaveDaProvare = env.OPENROUTER_API_KEY || dalBrowser
          if (!chiaveDaProvare) return rispondi(400, { errore: 'nessuna chiave da provare' })
          try {
            const r = await fetch('https://openrouter.ai/api/v1/key', {
              headers: { Authorization: `Bearer ${chiaveDaProvare}` },
            })
            if (!r.ok) return rispondi(200, { ok: false, errore: `OpenRouter ha risposto ${r.status}` })
            const j = await r.json() as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null } }
            return rispondi(200, {
              ok: true,
              speso: j.data?.usage ?? null,
              tetto: j.data?.limit ?? null,
              residuo: j.data?.limit_remaining ?? null,
            })
          } catch (e) {
            return rispondi(200, { ok: false, errore: e instanceof Error ? e.message : 'OpenRouter non risponde' })
          }
        }

        if (req.method !== 'POST') return rispondi(405, { errore: 'solo POST' })

        const compito = COMPITI[nome]
        if (!compito) return rispondi(404, { errore: `compito sconosciuto: ${nome}` })


        const chiave = env.OPENROUTER_API_KEY || dalBrowser
        const modello = env[compito.variabile]
        if (!chiave) return rispondi(503, { errore: 'manca la chiave di OpenRouter: mettila in Impostazioni › Chiavi, o nel .env.local' })
        if (!modello) return rispondi(503, { errore: `manca ${compito.variabile} in .env.local` })

        let testo = ''
        for await (const pezzo of req) testo += pezzo
        let richiesta: Record<string, unknown>
        try { richiesta = JSON.parse(testo) } catch { return rispondi(400, { errore: 'corpo non valido' }) }

        const corpo = JSON.stringify({
          ...richiesta,
          model: modello,
          provider: { sort: compito.ordine, allow_fallbacks: true },
        })

        let ultimo = ''
        for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
          try {
            const r = await chiama(chiave, corpo, compito.attesa)
            // 429 e 5xx: il fornitore è in difficoltà, vale la pena riprovare
            if ((r.status === 429 || r.status >= 500) && tentativo < TENTATIVI) {
              ultimo = `OpenRouter ha risposto ${r.status}`
              continue
            }
            const risposta = await r.text()
            res.statusCode = r.status
            res.setHeader('Content-Type', 'application/json')
            return res.end(risposta)
          } catch (e) {
            ultimo = e instanceof Error && e.name === 'AbortError'
              ? `nessuna risposta in ${compito.attesa / 1000} s`
              : `OpenRouter non raggiungibile: ${e instanceof Error ? e.message : e}`
          }
        }
        rispondi(504, { errore: `${ultimo}, anche al secondo tentativo. Riprova fra poco.` })
      })
    },
  }
}
