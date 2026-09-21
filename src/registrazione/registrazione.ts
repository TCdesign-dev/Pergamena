import * as Y from 'yjs'
import type { Editor } from '@tiptap/core'
import { apriDocumento, mappaDocumenti } from '../documento/archivio'
import { aggiorna, azzera, leggiRegistrazione } from './statoRegistrazione'
import type { Segmento, Ancora, Registrazione } from './tipi'
import { esponi } from '../lib/dev'
import { leggiImpostazioni } from '../impostazioni'

/*  Avvia e ferma l'ascolto, e scrive nel documento ciò che arriva.
 *
 *  I segmenti vanno nel documento man mano che il riconoscitore li
 *  chiude, non tutti alla fine: se il Mac si spegne a metà lezione,
 *  quello che è stato detto fino a lì è già salvo e sincronizzato.
 *
 *  Il collegamento col server può cadere, e allora conta capire PERCHÉ:
 *   · un intoppo (il Mac che dorme, la rete locale): il browser si
 *     ricollega da solo e il server gli rimanda le frasi perse;
 *   · il server ripartito: il programma di ascolto è morto con lui.
 *     La registrazione si chiude con quello che contiene e lo si dice,
 *     invece di far correre un cronometro che non registra niente;
 *   · la pagina ricaricata: il programma è ancora acceso ma nessuno lo
 *     ascolta. Ci si ricollega e il server rimanda tutto. */

const OGNI = 5_000            // ms fra un controllo e l'altro della posizione del cursore
const PAZIENZA = 15_000       // ms senza collegamento prima di dare la registrazione per persa
const ATTESA_USCITA = 10_000  // ms dopo «ferma» o dopo un'uscita annunciata

type Opzioni = { documentoId: string; editor: () => Editor | null }

let sorgente: EventSource | null = null
let voceCorrente: Y.Map<unknown> | null = null
let timerAncore: number | undefined
let timerCollegamento: number | undefined
let timerUscita: number | undefined
let collegamenti = 0
let istanzaServer: string | null = null
let giaScritti = new Set<string>()

/** La mappa delle registrazioni di un documento. */
export function mappaRegistrazioni(doc: Y.Doc) {
  return doc.getMap<Y.Map<unknown>>('registrazioni')
}

/** Lettura comoda di tutte le registrazioni di un documento. */
export function leggiRegistrazioni(doc: Y.Doc): Registrazione[] {
  const elenco: Registrazione[] = []
  mappaRegistrazioni(doc).forEach((m, id) => {
    elenco.push({
      id,
      inizio: m.get('inizio') as number,
      fine: (m.get('fine') as number | null) ?? null,
      audio: Boolean(m.get('audio')),
      segmenti: ((m.get('segmenti') as Y.Array<Segmento>)?.toArray() ?? []),
      ancore: ((m.get('ancore') as Y.Array<Ancora>)?.toArray() ?? []),
      integrata: (m.get('integrata') as number | null) ?? null,
      interrotta: Boolean(m.get('interrotta')),
    })
  })
  return elenco.sort((a, b) => a.inizio - b.inizio)
}

/*  Ogni pagina aperta dice come raggiungere il suo editor. Serve a chi
 *  riprende una registrazione dopo un ricaricamento: le àncore vanno
 *  prese nell'editor della pagina registrata, se è quella aperta. */
const editori = new Map<string, () => Editor | null>()
export function collegaEditore(documentoId: string, editor: () => Editor | null) {
  editori.set(documentoId, editor)
  return () => { if (editori.get(documentoId) === editor) editori.delete(documentoId) }
}

/** Il blocco di primo livello in cui si trova il cursore. */
function bloccoSottoAlCursore(editor: Editor): string | null {
  const { $from } = editor.state.selection
  if ($from.depth < 1) return null
  const nodo = $from.node(1)
  return (nodo?.attrs?.idBlocco as string | undefined) ?? null
}

/** Parole ricorrenti con la maiuscola: nomi propri, luoghi, termini
 *  della materia. Aiutano il riconoscitore a non storpiarli. */
function vocabolario(editor: Editor, materia: string): string[] {
  const testo = editor.getText()
  const conte = new Map<string, number>()
  for (const m of testo.matchAll(/(?<![.!?]\s)(?<!^)\b([A-ZÀ-Ý][a-zà-ÿ]{3,})\b/g)) {
    conte.set(m[1], (conte.get(m[1]) ?? 0) + 1)
  }
  const nomi = [...conte.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 60)
  return [materia, ...nomi].filter(Boolean)
}

const chiave = (s: { inizio: number; testo: string }) => `${s.inizio.toFixed(2)}|${s.testo}`

/** Quando è finita davvero: all'ultima frase, non quando ce ne si accorge. */
function fineDa(voce: Y.Map<unknown>) {
  const segmenti = voce.get('segmenti') as Y.Array<Segmento>
  const partenza = (voce.get('avviato') as number | undefined) ?? (voce.get('inizio') as number)
  return segmenti.length ? partenza + Math.round(segmenti.get(segmenti.length - 1).fine * 1000) : Date.now()
}

function togli(voce: Y.Map<unknown>) {
  const doc = voce.doc
  if (!doc) return
  mappaRegistrazioni(doc).forEach((v, k) => { if (v === voce) mappaRegistrazioni(doc).delete(k) })
}

export async function avviaRegistrazione(opzioni: {
  documentoId: string
  editor: () => Editor | null
  materia: string
  salvaAudio: boolean
  file?: string   // solo per i collaudi: una lezione registrata al posto del microfono
}) {
  if (leggiRegistrazione().attiva) return
  const id = `reg-${Date.now().toString(36)}`
  const { doc } = apriDocumento(opzioni.documentoId)

  // la voce nel documento nasce subito, prima ancora che il microfono parta
  const voce = new Y.Map<unknown>()
  doc.transact(() => {
    voce.set('inizio', Date.now())
    voce.set('fine', null)
    voce.set('audio', opzioni.salvaAudio)
    voce.set('segmenti', new Y.Array<Segmento>())
    voce.set('ancore', new Y.Array<Ancora>())
    voce.set('integrata', null)
    mappaRegistrazioni(doc).set(id, voce)
  })

  aggiorna({ attiva: true, avvio: 'parto', id, documentoId: opzioni.documentoId, errore: null, provvisorio: '' })

  const ed = opzioni.editor()
  ascolta('/api/ascolto/eventi', voce, opzioni)

  const r = await fetch('/api/ascolto/avvia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      documentoId: opzioni.documentoId,
      salvaAudio: opzioni.salvaAudio,
      contesto: ed ? vocabolario(ed, opzioni.materia) : [opzioni.materia],
      dispositivo: leggiImpostazioni().microfono,
      file: opzioni.file,
    }),
  }).then((x) => x.json()).catch(() => ({ ok: false, errore: 'server non raggiungibile' }))

  if (!r.ok) {
    chiudi()
    mappaRegistrazioni(doc).delete(id)
    azzera(r.errore ?? 'avvio fallito')
  }
}

/** Dopo un ricaricamento della pagina il programma di ascolto è ancora
 *  acceso — il server non si è fermato — ma nessuno lo ascolta più, e
 *  le frasi andrebbero perse. Ci si ricollega, e il server rimanda
 *  tutto quello che ha sentito; i doppioni si saltano. */
export async function riprendiSeInCorso() {
  if (leggiRegistrazione().attiva) return
  const s = await fetch('/api/ascolto/stato').then((r) => r.json()).catch(() => null)
  // qualcuno lo sta già ascoltando: un'altra finestra, lasciamola fare
  if (!s?.attivo || !s.id || !s.documentoId || s.ascoltatori > 0) return

  const { doc, pronto } = apriDocumento(s.documentoId)
  await pronto
  const voce = mappaRegistrazioni(doc).get(s.id)
  if (!voce || voce.get('fine') !== null || leggiRegistrazione().attiva) return

  const documentoId = s.documentoId as string
  aggiorna({
    attiva: true, avvio: 'ascolto', id: s.id, documentoId, errore: null, provvisorio: '',
    inizio: (voce.get('avviato') as number | undefined) ?? (voce.get('inizio') as number),
  })
  ascolta('/api/ascolto/eventi?tutto=1', voce, { documentoId, editor: () => editori.get(documentoId)?.() ?? null })
}

/** Registrazioni rimaste «in corso» per sempre: il server si è fermato
 *  mentre registravi e la pagina non c'era a vederlo. Si chiudono con
 *  quello che contengono — a meno che non stiano registrando davvero,
 *  magari in un'altra finestra: lo sa solo il server. */
export async function chiudiOrfane(doc: Y.Doc) {
  const aperte = [...mappaRegistrazioni(doc).entries()].filter(([, v]) => v.get('fine') === null)
  if (!aperte.length) return
  const s = await fetch('/api/ascolto/stato').then((r) => r.json()).catch(() => null)
  if (!s) return   // server irraggiungibile: meglio non decidere niente
  for (const [id, voce] of aperte) {
    const qui = leggiRegistrazione()
    if ((s.attivo && s.id === id) || (qui.attiva && qui.id === id)) continue
    // la pagina aperta e il giro all'avvio possono arrivare insieme
    if (inChiusura.has(id)) continue
    inChiusura.add(id)
    try {
      await recuperaSospese(voce, id)
      if (voce.get('fine') === null) chiudiVoce(voce, true)
    } finally {
      inChiusura.delete(id)
    }
  }
}

const inChiusura = new Set<string>()

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Le ultime frasi, dette mentre il server si fermava: il server le ha
 *  messe da parte in un file. Si aggiungono quelle che mancano. Se il
 *  programma di ascolto sta ancora finendo di scriverle, si aspetta. */
async function recuperaSospese(voce: Y.Map<unknown>, id: string) {
  for (let giro = 0; giro < 12; giro++) {
    const r = await fetch(`/api/ascolto/sospese/${encodeURIComponent(id)}`).catch(() => null)
    if (!r || !r.ok) return
    const j = await r.json().catch(() => null)
    if (!j) return
    if (!j.chiusa && giro < 11) { await pausa(1000); continue }

    const segmenti = voce.get('segmenti') as Y.Array<Segmento>
    const presenti = new Set(segmenti.toArray().map(chiave))
    const nuovi: Segmento[] = (Array.isArray(j.eventi) ? j.eventi : [])
      .map((e: Record<string, unknown>) => ({
        inizio: Number(e.inizio), fine: Number(e.fine), testo: String(e.testo),
        parole: (e.parole as Segmento['parole']) ?? [],
      }))
      .filter((x: Segmento) => !presenti.has(chiave(x)))
    if (nuovi.length) segmenti.push(nuovi)
    await fetch(`/api/ascolto/sospese/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    return
  }
}

/** All'avvio: le registrazioni che il server ha messo da parte, anche
 *  in pagine che non sono aperte. */
export async function recuperaInterrotte() {
  const elenco = await fetch('/api/ascolto/sospese').then((r) => r.json()).catch(() => [])
  for (const { id, documentoId } of Array.isArray(elenco) ? elenco : []) {
    // la pagina non c'è più: le frasi non hanno dove andare
    if (!documentoId || !mappaDocumenti.has(documentoId)) {
      await fetch(`/api/ascolto/sospese/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
      continue
    }
    const { doc, pronto } = apriDocumento(documentoId)
    await pronto
    await chiudiOrfane(doc)
  }
}

function ascolta(url: string, voce: Y.Map<unknown>, opzioni: Opzioni) {
  voceCorrente = voce
  collegamenti = 0
  istanzaServer = null
  giaScritti = new Set((voce.get('segmenti') as Y.Array<Segmento>).toArray().map(chiave))

  sorgente = new EventSource(url)
  sorgente.onmessage = (e) => ricevi(JSON.parse(e.data), voce, opzioni)
  sorgente.onerror = () => {
    // l'EventSource riprova da solo; se entro PAZIENZA non torna, è finita
    if (!leggiRegistrazione().attiva || timerCollegamento !== undefined) return
    aggiorna({ scollegato: true })
    timerCollegamento = window.setTimeout(() => {
      timerCollegamento = undefined
      concludi(voce, 'il collegamento con il server si è interrotto', true)
    }, PAZIENZA)
  }
}

function ricevi(evento: Record<string, unknown>, voce: Y.Map<unknown>, opzioni: Opzioni) {
  switch (evento.evento) {
    case 'collegato': {
      collegamenti++
      const primo = istanzaServer === null
      const stessoServer = primo || evento.istanza === istanzaServer
      istanzaServer = String(evento.istanza ?? '')
      window.clearTimeout(timerCollegamento)
      timerCollegamento = undefined
      aggiorna({ scollegato: false })

      // il primo arriva prima ancora che il programma parta: non dice niente
      if (primo && leggiRegistrazione().avvio === 'parto') break
      if (evento.attivo && evento.id === leggiRegistrazione().id) break
      if (stessoServer) {
        // stesso server, programma già uscito: l'uscita arriva fra le
        // frasi rimandate. Se non arriva, si chiude lo stesso.
        window.clearTimeout(timerUscita)
        timerUscita = window.setTimeout(() => concludi(voce, null, false), ATTESA_USCITA)
        break
      }
      // un server nuovo: il programma di ascolto è morto col vecchio
      concludi(voce, 'il server si è riavviato', true)
      break
    }
    case 'pronto': {
      // ripresa dopo un ricaricamento: il tempo zero resta quello vero
      const avviato = (voce.get('avviato') as number | undefined) ?? Date.now()
      if (!voce.get('avviato')) voce.set('avviato', avviato)
      aggiorna({
        avvio: 'ascolto',
        inizio: avviato,
        dispositivo: typeof evento.dispositivo === 'string' ? evento.dispositivo : null,
        virtuale: evento.virtuale === true,
      })
      // ogni 5 s: se il cursore è passato a un altro blocco, àncora
      window.clearInterval(timerAncore)
      timerAncore = window.setInterval(() => annotaAncora(voce, opzioni), OGNI)
      annotaAncora(voce, opzioni)
      break
    }
    case 'livello':
      aggiorna({ livello: Number(evento.db) })
      break
    case 'silenzio':
      aggiorna({ silenzio: true })
      break
    case 'suono':
      aggiorna({ silenzio: false })
      break
    case 'testo':
      if (evento.finale) {
        const segmento: Segmento = {
          inizio: Number(evento.inizio),
          fine: Number(evento.fine),
          testo: String(evento.testo),
          parole: (evento.parole as Segmento['parole']) ?? [],
        }
        // rimandato dal server dopo una ripresa, ma già scritto: si salta
        if (!giaScritti.has(chiave(segmento))) {
          giaScritti.add(chiave(segmento))
          ;(voce.get('segmenti') as Y.Array<Segmento>).push([segmento])
        }
        aggiorna({ provvisorio: '' })
      } else {
        aggiorna({ provvisorio: String(evento.testo) })
      }
      break
    case 'errore':
      aggiorna({ errore: String(evento.messaggio) })
      break
    case 'uscito': {
      if (evento.id && evento.id !== leggiRegistrazione().id) break
      const errore = leggiRegistrazione().errore
      concludi(voce, errore, false, Date.now())
      break
    }
  }
}

/** La fine di una registrazione, comunque sia andata. Se si è
 *  interrotta da sola, prima si recuperano le ultime frasi messe da
 *  parte dal server. */
function concludi(voce: Y.Map<unknown>, errore: string | null, interrotta: boolean, quando?: number) {
  const id = leggiRegistrazione().id
  chiudi()
  if (interrotta) {
    azzera(`${errore ?? 'si è interrotta'}. Quello che era già trascritto è salvo.`)
    void (id ? recuperaSospese(voce, id) : Promise.resolve()).then(() => chiudiVoce(voce, true))
    return
  }
  chiudiVoce(voce, false, errore, quando)
  azzera(errore)
}

/** Una registrazione senza nemmeno una frase non resta: sarebbe una
 *  lezione vuota. Le altre si chiudono all'ultima frase. */
function chiudiVoce(voce: Y.Map<unknown>, interrotta: boolean, errore: string | null = null, quando?: number) {
  if (!(voce.get('segmenti') as Y.Array<Segmento>).length && (errore || interrotta)) return togli(voce)
  voce.doc?.transact(() => {
    voce.set('fine', quando ?? fineDa(voce))
    if (interrotta) voce.set('interrotta', true)
  })
}

function annotaAncora(voce: Y.Map<unknown>, opzioni: Opzioni) {
  const { inizio, documentoId } = leggiRegistrazione()
  const editor = opzioni.editor()
  // le àncore hanno senso solo nella pagina che si sta registrando
  if (!inizio || !editor || documentoId !== opzioni.documentoId) return

  const blocco = bloccoSottoAlCursore(editor)
  if (!blocco) return

  const ancore = voce.get('ancore') as Y.Array<Ancora>
  const ultima = ancore.length ? ancore.get(ancore.length - 1) : null
  const t = Math.round((Date.now() - inizio) / 100) / 10

  // si annota solo quando cambia blocco, più un battito ogni 30 s
  if (!ultima || ultima.blocco !== blocco || t - ultima.t >= 30) {
    ancore.push([{ t, blocco }])
  }
}

function chiudi() {
  sorgente?.close()
  sorgente = null
  voceCorrente = null
  window.clearInterval(timerAncore)
  window.clearTimeout(timerCollegamento)
  window.clearTimeout(timerUscita)
  timerCollegamento = undefined
  timerUscita = undefined
}

export async function fermaRegistrazione() {
  const { attiva, id } = leggiRegistrazione()
  const voce = voceCorrente
  if (!attiva || !voce) return
  aggiorna({ avvio: 'chiudo' })
  const r = await fetch('/api/ascolto/ferma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).then((x) => x.json()).catch(() => ({ ok: false }))

  // il programma non c'era più (server ripartito): si chiude da qui
  if (!r.ok) return concludi(voce, null, false)
  // la chiusura vera arriva con l'evento «uscito», dopo gli ultimi
  // risultati; se non arriva, non si resta appesi per sempre
  window.clearTimeout(timerUscita)
  timerUscita = window.setTimeout(() => concludi(voce, null, false), ATTESA_USCITA)
}

/** Toglie una registrazione dal documento, e il suo audio dal disco. */
export async function eliminaRegistrazione(doc: Y.Doc, id: string) {
  const audio = mappaRegistrazioni(doc).get(id)?.get('audio')
  mappaRegistrazioni(doc).delete(id)
  if (audio) await fetch(`/api/audio/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

esponi({ registrazione: { avviaRegistrazione, fermaRegistrazione, leggiRegistrazioni, eliminaRegistrazione, riprendiSeInCorso, chiudiOrfane, recuperaInterrotte, leggiRegistrazione } })
