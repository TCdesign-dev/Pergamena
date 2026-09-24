import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

/*  Le immagini dal web, oltre a Wikimedia Commons.
 *
 *  L'API ufficiale di Google per le immagini è chiusa ai nuovi utenti
 *  dal 2025 (e si spegne nel 2027). Allora, in ordine:
 *   · SERPER_API_KEY — i risultati di Google Immagini, tramite Serper
 *     (2.500 ricerche gratis, poi circa 1 $ ogni 1.000);
 *   · BRAVE_API_KEY  — la ricerca immagini di Brave;
 *   · nessuna chiave — Openverse: immagini con licenza libera da tutto
 *     il web (Flickr, musei, archivi), senza registrarsi.
 *  Le chiavi stanno nel .env.local e non arrivano mai al browser.
 *
 *  Il browser non può scaricare un'immagine da un sito qualunque (i
 *  siti non lo permettono): la scarica il server al posto suo, dopo
 *  aver controllato che sia davvero un'immagine e non troppo grande. */

type Trovata = {
  chiave: string
  titolo: string
  miniatura: string
  originale: string
  larghezza: number
  altezza: number
  autore: string
  licenza: string
  pagina: string
  fonte: 'google' | 'brave' | 'openverse'
}

const ATTESA = 12_000
const MASSIMO_BYTE = 15 * 1024 * 1024

const chiaveDi = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 16)
const dominio = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

async function conTempo(url: string, init: RequestInit = {}) {
  const interruttore = new AbortController()
  const t = setTimeout(() => interruttore.abort(), ATTESA)
  try { return await fetch(url, { ...init, signal: interruttore.signal }) } finally { clearTimeout(t) }
}

async function daSerper(chiave: string, q: string, n: number): Promise<Trovata[]> {
  const r = await conTempo('https://google.serper.dev/images', {
    method: 'POST',
    headers: { 'X-API-KEY': chiave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, gl: 'it', hl: 'it', num: Math.min(n, 30) }),
  })
  if (!r.ok) throw new Error(`Serper ha risposto ${r.status}`)
  const j = await r.json() as { images?: Record<string, unknown>[] }
  return (j.images ?? []).map((x) => ({
    chiave: chiaveDi(String(x.imageUrl)),
    titolo: String(x.title ?? ''),
    miniatura: String(x.thumbnailUrl ?? x.imageUrl),
    originale: String(x.imageUrl),
    larghezza: Number(x.imageWidth) || 0,
    altezza: Number(x.imageHeight) || 0,
    autore: String(x.domain ?? x.source ?? dominio(String(x.link ?? ''))),
    licenza: 'dal web',
    pagina: String(x.link ?? ''),
    fonte: 'google' as const,
  }))
}

async function daBrave(chiave: string, q: string, n: number): Promise<Trovata[]> {
  const p = new URLSearchParams({ q, count: String(Math.min(n, 50)), search_lang: 'it', safesearch: 'strict' })
  const r = await conTempo(`https://api.search.brave.com/res/v1/images/search?${p}`, {
    headers: { 'X-Subscription-Token': chiave, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`Brave ha risposto ${r.status}`)
  const j = await r.json() as { results?: Record<string, Record<string, unknown>>[] }
  return (j.results ?? []).map((x) => ({
    chiave: chiaveDi(String(x.properties?.url)),
    titolo: String(x.title ?? ''),
    miniatura: String(x.thumbnail?.src ?? x.properties?.url),
    originale: String(x.properties?.url),
    larghezza: Number(x.properties?.width) || 0,
    altezza: Number(x.properties?.height) || 0,
    autore: String(x.source ?? dominio(String(x.url ?? ''))),
    licenza: 'dal web',
    pagina: String(x.url ?? ''),
    fonte: 'brave' as const,
  }))
}

/*  Openverse indicizza in inglese: cercare «cane» dà canne da
 *  zucchero e bastoni da passeggio. Il termine inglese lo trova il
 *  browser su Wikipedia e lo manda qui; se non c'è, si cerca com'è. */
async function daOpenverse(q: string, n: number): Promise<Trovata[]> {
  const p = new URLSearchParams({ q, page_size: String(Math.min(n, 20)), mature: 'false' })
  const r = await conTempo(`https://api.openverse.org/v1/images/?${p}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Openverse ha risposto ${r.status}`)
  const j = await r.json() as { results?: Record<string, unknown>[] }
  return (j.results ?? []).map((x) => ({
    chiave: String(x.id),
    titolo: String(x.title ?? ''),
    miniatura: String(x.thumbnail ?? x.url),
    originale: String(x.url),
    larghezza: Number(x.width) || 0,
    altezza: Number(x.height) || 0,
    autore: String(x.creator || x.source || ''),
    licenza: `CC ${String(x.license ?? '').toUpperCase()} ${String(x.license_version ?? '')}`.trim(),
    pagina: String(x.foreign_landing_url ?? ''),
    fonte: 'openverse' as const,
  }))
}

/** Solo indirizzi pubblici: il server non deve diventare una porta
 *  verso la rete di casa (router, stampanti, altri servizi locali). */
function indirizzoAmmesso(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const h = url.hostname
  return !(
    h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0' || h === '[::1]' ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  )
}

function rispondi(res: ServerResponse, stato: number, corpo: unknown) {
  res.statusCode = stato
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(corpo))
}

export function immagini(env: Record<string, string>): Plugin {
  return {
    name: 'pergamena-immagini',
    configureServer(server) {
      server.middlewares.use('/api/immagini', async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://locale')

        if (req.method === 'GET' && url.pathname === '/cerca') {
          const q = (url.searchParams.get('q') ?? '').trim()
          const inglese = (url.searchParams.get('en') ?? '').trim()
          const n = Number(url.searchParams.get('n')) || 12
          if (q.length < 2) return rispondi(res, 400, { errore: 'ricerca troppo corta' })
          // la chiave può arrivare dalle Impostazioni; il file vince
          const serper = env.SERPER_API_KEY || String(req.headers['x-chiave-serper'] ?? '')
          try {
            // Google e Brave capiscono l'italiano, Openverse no
            if (serper) return rispondi(res, 200, { fonte: 'google', risultati: await daSerper(serper, q, n) })
            if (env.BRAVE_API_KEY) return rispondi(res, 200, { fonte: 'brave', risultati: await daBrave(env.BRAVE_API_KEY, q, n) })
            return rispondi(res, 200, { fonte: 'openverse', risultati: await daOpenverse(inglese || q, n) })
          } catch (e) {
            return rispondi(res, 502, { errore: e instanceof Error ? e.message : 'ricerca fallita' })
          }
        }

        if (req.method === 'GET' && url.pathname === '/scarica') {
          let bersaglio: URL
          try { bersaglio = new URL(url.searchParams.get('url') ?? '') } catch { return rispondi(res, 400, { errore: 'indirizzo non valido' }) }
          if (!indirizzoAmmesso(bersaglio)) return rispondi(res, 400, { errore: 'indirizzo non ammesso' })
          try {
            // i rimandi si seguono a mano: ognuno deve restare un indirizzo pubblico
            let r = await conTempo(bersaglio.toString(), {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) Pergamena', Accept: 'image/*' },
              redirect: 'manual',
            })
            for (let salti = 0; salti < 4 && r.status >= 300 && r.status < 400 && r.headers.get('location'); salti++) {
              bersaglio = new URL(r.headers.get('location')!, bersaglio)
              if (!indirizzoAmmesso(bersaglio)) return rispondi(res, 400, { errore: 'indirizzo non ammesso' })
              r = await conTempo(bersaglio.toString(), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) Pergamena', Accept: 'image/*' },
                redirect: 'manual',
              })
            }
            const tipo = r.headers.get('content-type') ?? ''
            if (!r.ok) return rispondi(res, 502, { errore: `il sito ha risposto ${r.status}` })
            if (!tipo.startsWith('image/')) return rispondi(res, 415, { errore: 'non è un\'immagine' })
            if (Number(r.headers.get('content-length')) > MASSIMO_BYTE) return rispondi(res, 413, { errore: 'immagine troppo grande' })
            const byte = Buffer.from(await r.arrayBuffer())
            if (byte.length > MASSIMO_BYTE) return rispondi(res, 413, { errore: 'immagine troppo grande' })
            res.statusCode = 200
            res.setHeader('Content-Type', tipo)
            res.setHeader('Content-Length', byte.length)
            return res.end(byte)
          } catch (e) {
            return rispondi(res, 502, { errore: e instanceof Error && e.name === 'AbortError' ? 'il sito non risponde' : 'scaricamento fallito' })
          }
        }

        rispondi(res, 404, { errore: 'non trovato' })
      })
    },
  }
}
