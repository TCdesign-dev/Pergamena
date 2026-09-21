import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/*  Il proxy verso OpenRouter.
 *
 *  La chiave NON deve finire nel browser: sta nel .env.local senza
 *  prefisso VITE_, la legge solo questo codice lato server, e il
 *  browser chiede un COMPITO («merge», «quiz»), non un modello. Il
 *  modello lo decide il .env: cambiarlo non tocca l'app. */

const COMPITI: Record<string, string> = {
  merge: 'MODELLO_MERGE',
  quiz: 'MODELLO_QUIZ',
  veloce: 'MODELLO_VELOCE',
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

        if (req.method !== 'POST') return rispondi(405, { errore: 'solo POST' })

        const compito = (req.url ?? '').replace(/^\//, '').split('?')[0]
        const variabile = COMPITI[compito]
        if (!variabile) return rispondi(404, { errore: `compito sconosciuto: ${compito}` })

        const chiave = env.OPENROUTER_API_KEY
        const modello = env[variabile]
        if (!chiave) return rispondi(503, { errore: 'manca OPENROUTER_API_KEY in .env.local' })
        if (!modello) return rispondi(503, { errore: `manca ${variabile} in .env.local` })

        let corpo = ''
        for await (const pezzo of req) corpo += pezzo
        let richiesta: Record<string, unknown>
        try { richiesta = JSON.parse(corpo) } catch { return rispondi(400, { errore: 'corpo non valido' }) }

        try {
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${chiave}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:5180',
              'X-Title': 'Pergamena',
            },
            body: JSON.stringify({ ...richiesta, model: modello }),
          })
          const testo = await r.text()
          res.statusCode = r.status
          res.setHeader('Content-Type', 'application/json')
          res.end(testo)
        } catch (e) {
          rispondi(502, { errore: `OpenRouter non raggiungibile: ${e instanceof Error ? e.message : e}` })
        }
      })
    },
  }
}
