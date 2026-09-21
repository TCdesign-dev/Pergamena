import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/*  Il ponte fra il programma nativo di ascolto e l'app.
 *
 *  Vive dentro al server di sviluppo di Vite: lancia pergamena-ascolto,
 *  ne legge le righe JSON e le gira al browser come Server-Sent Events.
 *  Quando arriverà il guscio Tauri sarà lui a lanciare il programma;
 *  l'app non se ne accorgerà, perché parla sempre con /api/ascolto. */

const BINARIO = resolve(process.cwd(), 'build/pergamena-ascolto')
export const CARTELLA_AUDIO = join(homedir(), 'Library/Application Support/Pergamena/registrazioni')

let processo: ChildProcessWithoutNullStreams | null = null
let idCorrente: string | null = null
const ascoltatori = new Set<ServerResponse>()

function diffondi(riga: string) {
  for (const r of ascoltatori) r.write(`data: ${riga}\n\n`)
}

function leggiCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((risolvi) => {
    let dati = ''
    req.on('data', (c) => (dati += c))
    req.on('end', () => {
      try { risolvi(dati ? JSON.parse(dati) : {}) } catch { risolvi({}) }
    })
  })
}

function rispondi(res: ServerResponse, stato: number, corpo: unknown) {
  res.statusCode = stato
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(corpo))
}

const idValido = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{6,64}$/.test(id)

function avvia(corpo: Record<string, unknown>) {
  if (processo) return { ok: false, errore: 'sto già ascoltando' }
  if (!existsSync(BINARIO)) return { ok: false, errore: 'manca build/pergamena-ascolto: lancia nativo/ascolto/compila.sh' }
  if (!idValido(corpo.id)) return { ok: false, errore: 'id registrazione non valido' }

  const args: string[] = []
  if (typeof corpo.file === 'string') {
    // solo per i collaudi: una lezione registrata al posto del microfono
    args.push('--file', corpo.file, '--tempo-reale')
  }
  if (corpo.salvaAudio === true) {
    mkdirSync(CARTELLA_AUDIO, { recursive: true })
    args.push('--salva', join(CARTELLA_AUDIO, `${corpo.id}.m4a`))
  }
  if (typeof corpo.dispositivo === 'string' && corpo.dispositivo) {
    args.push('--dispositivo', corpo.dispositivo)
  }
  if (Array.isArray(corpo.contesto) && corpo.contesto.length) {
    args.push('--contesto', corpo.contesto.filter((x) => typeof x === 'string').slice(0, 100).join(','))
  }

  processo = spawn(BINARIO, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  idCorrente = corpo.id

  let avanzo = ''
  processo.stdout.on('data', (pezzo: Buffer) => {
    const righe = (avanzo + pezzo.toString()).split('\n')
    avanzo = righe.pop() ?? ''
    for (const r of righe) if (r.trim()) diffondi(r)
  })
  processo.stderr.on('data', (pezzo: Buffer) => {
    const testo = pezzo.toString().trim()
    if (testo) diffondi(JSON.stringify({ evento: 'diagnostica', messaggio: testo.slice(0, 300) }))
  })
  processo.on('exit', (codice) => {
    if (avanzo.trim()) diffondi(avanzo)
    diffondi(JSON.stringify({ evento: 'uscito', codice }))
    processo = null
    idCorrente = null
  })

  return { ok: true }
}

function ferma() {
  if (!processo) return { ok: false, errore: 'non sto ascoltando' }
  processo.kill('SIGINT')   // il programma finalizza ed esce da solo
  return { ok: true }
}

export function ascolto(): Plugin {
  return {
    name: 'pergamena-ascolto',
    configureServer(server) {
      server.middlewares.use('/api/ascolto', async (req, res) => {
        const url = req.url ?? '/'

        if (req.method === 'GET' && url.startsWith('/eventi')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          })
          res.write(`data: ${JSON.stringify({ evento: 'collegato', attivo: !!processo, id: idCorrente })}\n\n`)
          ascoltatori.add(res)
          const battito = setInterval(() => res.write(': ping\n\n'), 15_000)
          req.on('close', () => { clearInterval(battito); ascoltatori.delete(res) })
          return
        }

        if (req.method === 'GET' && url.startsWith('/dispositivi')) {
          if (!existsSync(BINARIO)) return rispondi(res, 503, { errore: 'programma di ascolto non compilato' })
          execFile(BINARIO, ['--dispositivi'], { timeout: 8000 }, (err, stdout) => {
            if (err) return rispondi(res, 500, { errore: err.message })
            try { rispondi(res, 200, JSON.parse(stdout.trim().split('\n').pop() ?? '{}')) }
            catch { rispondi(res, 500, { errore: 'risposta illeggibile' }) }
          })
          return
        }
        if (req.method === 'POST' && url.startsWith('/avvia')) return rispondi(res, 200, avvia(await leggiCorpo(req)))
        if (req.method === 'POST' && url.startsWith('/ferma')) return rispondi(res, 200, ferma())
        if (req.method === 'GET' && url.startsWith('/stato')) return rispondi(res, 200, { attivo: !!processo, id: idCorrente })

        rispondi(res, 404, { errore: 'non trovato' })
      })

      // ── l'audio salvato: si riascolta e si cancella ──
      server.middlewares.use('/api/audio', (req, res) => {
        const id = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0])
        if (!idValido(id)) return rispondi(res, 400, { errore: 'id non valido' })
        const file = join(CARTELLA_AUDIO, `${id}.m4a`)

        if (req.method === 'DELETE') {
          if (existsSync(file)) unlinkSync(file)
          return rispondi(res, 200, { ok: true })
        }
        if (!existsSync(file)) return rispondi(res, 404, { errore: 'audio non salvato' })

        // il riascolto salta nel mezzo: servono le richieste a intervalli
        const { size } = statSync(file)
        const intervallo = req.headers.range?.match(/bytes=(\d*)-(\d*)/)
        if (intervallo) {
          const da = Number(intervallo[1] || 0)
          const a = intervallo[2] ? Number(intervallo[2]) : size - 1
          res.writeHead(206, {
            'Content-Type': 'audio/mp4',
            'Content-Range': `bytes ${da}-${a}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': a - da + 1,
          })
          createReadStream(file, { start: da, end: a }).pipe(res)
        } else {
          res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Content-Length': size, 'Accept-Ranges': 'bytes' })
          createReadStream(file).pipe(res)
        }
      })

      // se il server si ferma, il microfono si spegne con lui
      server.httpServer?.on('close', () => processo?.kill('SIGINT'))
    },
  }
}
