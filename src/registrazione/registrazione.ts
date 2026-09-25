import * as Y from 'yjs'
import type { Editor } from '@tiptap/core'
import { apriDocumento, mappaDocumenti } from '../documento/archivio'
import { aggiorna, azzera, leggiRegistrazione } from './statoRegistrazione'
import type { Segmento, Ancora } from './tipi'
import {
  avviatoDi, chiave, chiudiPausa, chiudiVoce, contaPause, mappaRegistrazioni, segnaPausa,
} from './voci'
import { recuperaInterrotte, recuperaSospese } from './recupero'
import { esponi } from '../lib/dev'
import { leggiImpostazioni } from '../impostazioni'
import { togliCorrezioniDi } from '../correzioni/deposito'
import { linguaCorrente, tr } from '../lingua/lingua'

export { mappaRegistrazioni, leggiRegistrazioni } from './voci'
export { chiudiOrfane, recuperaInterrotte } from './recupero'

/*  Avvia e ferma l'ascolto, e scrive nel documento ciò che arriva.
 *
 *  I segmenti vanno nel documento man mano che il riconoscitore li
 *  chiude, non tutti alla fine: se il Mac si spegne a metà lezione,
 *  quello che è stato detto fino a lì è già salvo e sincronizzato.
 *
 *  UNA pagina sola scrive (il server tiene lo «scrivente»). Le altre
 *  sanno che si sta registrando e possono prendere il posto con
 *  «continua qui». Quando il collegamento cade conta capire perché:
 *   · un intoppo (il Mac che dorme): il browser si ricollega da solo e
 *     il server gli rimanda le frasi perse;
 *   · il server ripartito: il programma di ascolto è morto con lui. La
 *     registrazione si chiude con quello che contiene e lo si dice;
 *   · la pagina ricaricata: il programma è ancora acceso. La pagina
 *     nuova si ricollega e il server le rimanda tutto. */

const OGNI = 5_000            // ms fra un controllo e l'altro della posizione del cursore
const PAZIENZA = 15_000       // ms senza collegamento prima di dare la registrazione per persa
const ATTESA_USCITA = 10_000  // ms dopo «ferma» o dopo un'uscita annunciata
const RIPROVE = 3             // «occupato» appena ricaricato: la connessione vecchia sta ancora chiudendo
const SORVEGLIANZA = 10_000   // ms fra un'occhiata e l'altra a una registrazione scritta altrove

type Opzioni = { documentoId: string; editor: () => Editor | null }
type Modo = 'nuova' | 'riprendi' | 'prendi'

let sorgente: EventSource | null = null
let voceCorrente: Y.Map<unknown> | null = null
let modoCorrente: Modo = 'nuova'
let idAtteso: string | null = null
let istanzaServer: string | null = null
let giaScritti = new Set<string>()
let riprove = 0
let timerAncore: number | undefined
let timerCollegamento: number | undefined
let timerUscita: number | undefined
let timerRiprova: number | undefined
let timerAltrove: number | undefined

/*  Ogni pagina aperta dice come raggiungere il suo editor. Serve a chi
 *  riprende una registrazione dopo un ricaricamento: le àncore vanno
 *  prese nell'editor della pagina registrata, se è quella aperta. */
const editori = new Map<string, () => Editor | null>()
export function collegaEditore(documentoId: string, editor: () => Editor | null) {
  editori.set(documentoId, editor)
  return () => { if (editori.get(documentoId) === editor) editori.delete(documentoId) }
}

const chiediStato = () => fetch('/api/ascolto/stato').then((r) => r.json()).catch(() => null)
const gettone = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const posta = (dove: string, corpo: object) => fetch(`/api/ascolto/${dove}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo),
}).then((x) => x.json()).catch(() => ({ ok: false, errore: tr('server non raggiungibile') }))

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

// ── avviare, riprendere, prendere il posto ──────────────────────────

export async function avviaRegistrazione(opzioni: {
  documentoId: string
  editor: () => Editor | null
  materia: string
  salvaAudio: boolean
  file?: string   // solo per i collaudi: una lezione registrata al posto del microfono
}) {
  if (leggiRegistrazione().attiva) return
  // il microfono è già acceso (un'altra finestra, o questa prima di
  // ricaricarla): si continua quella registrazione, non se ne apre un'altra
  const s = await chiediStato()
  if (s?.attivo) return prendiQui()

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

  aggiorna({ attiva: true, avvio: 'parto', id, documentoId: opzioni.documentoId, errore: null, provvisorio: '', altrove: null })

  const ed = opzioni.editor()
  ascolta(voce, opzioni, 'nuova')

  const r = await posta('avvia', {
    id,
    documentoId: opzioni.documentoId,
    salvaAudio: opzioni.salvaAudio,
    contesto: ed ? vocabolario(ed, opzioni.materia) : [opzioni.materia],
    dispositivo: leggiImpostazioni().microfono,
    lingua: linguaCorrente().ascolto ?? linguaCorrente().locale,
    file: opzioni.file,
  })

  if (!r.ok) {
    chiudi()
    mappaRegistrazioni(doc).delete(id)
    azzera(r.errore ?? tr('avvio fallito'))
  }
}

/** All'avvio della pagina: se il microfono è acceso e nessuno lo sta
 *  ascoltando (la pagina è stata ricaricata), ci si ricollega. Se lo
 *  ascolta un'altra finestra, lo si dice senza portarglielo via. */
export const riprendiSeInCorso = () => aggancia('riprendi')

/** «Continua qui»: questa pagina prende il posto di quella che scriveva. */
export const prendiQui = () => aggancia('prendi')

async function aggancia(modo: 'riprendi' | 'prendi') {
  window.clearTimeout(timerRiprova)
  if (leggiRegistrazione().attiva || sorgente) return
  const s = await chiediStato()
  if (!s?.attivo || !s.id) return lasciaAltrove()

  // partita da una versione vecchia dell'app, o pagina che non c'è più
  if (!s.documentoId || !mappaDocumenti.has(s.documentoId)) return segnaAltrove(s.id, s.documentoId ?? null)

  const documentoId = s.documentoId as string
  const { doc, pronto } = apriDocumento(documentoId)
  await pronto
  const voce = mappaRegistrazioni(doc).get(s.id)
  if (!voce || voce.get('fine') !== null) return segnaAltrove(s.id, documentoId)
  if (leggiRegistrazione().attiva || sorgente) return

  idAtteso = s.id
  ascolta(voce, { documentoId, editor: () => editori.get(documentoId)?.() ?? null }, modo)
}

/** La registrazione la scrive un'altra finestra: lo si mostra, e ogni
 *  tanto si guarda se è finita — o se è rimasta senza nessuno che la
 *  scriva, e allora la si prende. */
function segnaAltrove(id: string, documentoId: string | null) {
  aggiorna({ altrove: { id, documentoId } })
  window.clearInterval(timerAltrove)
  timerAltrove = window.setInterval(async () => {
    const s = await chiediStato()
    // finita altrove: se nessuno l'ha scritta fino in fondo, le frasi
    // mancanti sono nel file del server
    if (!s?.attivo || s.id !== id) { lasciaAltrove(); return void recuperaInterrotte() }
    if (s.ascoltatori === 0) void riprendiSeInCorso()
  }, SORVEGLIANZA)
}

function lasciaAltrove() {
  window.clearInterval(timerAltrove)
  timerAltrove = undefined
  if (leggiRegistrazione().altrove) aggiorna({ altrove: null })
}

// ── il collegamento col server ──────────────────────────────────────

function ascolta(voce: Y.Map<unknown>, opzioni: Opzioni, modo: Modo) {
  voceCorrente = voce
  modoCorrente = modo
  istanzaServer = null
  giaScritti = new Set((voce.get('segmenti') as Y.Array<Segmento>).toArray().map(chiave))

  const parametri = new URLSearchParams({ chi: gettone(), modo: modo === 'nuova' ? 'prendi' : modo })
  if (modo !== 'nuova') parametri.set('tutto', '1')   // chi si aggancia si fa rimandare tutto
  sorgente = new EventSource(`/api/ascolto/eventi?${parametri}`)
  sorgente.onmessage = (e) => ricevi(JSON.parse(e.data), voce, opzioni)
  sorgente.onerror = () => {
    // l'EventSource riprova da solo; se entro PAZIENZA non torna, è finita
    if (!leggiRegistrazione().attiva || timerCollegamento !== undefined) return
    aggiorna({ scollegato: true })
    timerCollegamento = window.setTimeout(() => {
      timerCollegamento = undefined
      concludi(voce, tr('il collegamento con il server si è interrotto'), true)
    }, PAZIENZA)
  }
}

function ricevi(evento: Record<string, unknown>, voce: Y.Map<unknown>, opzioni: Opzioni) {
  switch (evento.evento) {
    case 'collegato': {
      const primo = istanzaServer === null
      const stessoServer = primo || evento.istanza === istanzaServer
      istanzaServer = String(evento.istanza ?? '')
      window.clearTimeout(timerCollegamento)
      timerCollegamento = undefined
      aggiorna({ scollegato: false })

      if (primo && modoCorrente !== 'nuova') {
        // aggancio a una registrazione già in corso: da qui la scrive questa pagina
        if (!evento.attivo || evento.id !== idAtteso) { chiudi(); break }
        riprove = 0
        lasciaAltrove()
        aggiorna({
          attiva: true, avvio: 'ascolto', id: idAtteso, documentoId: opzioni.documentoId,
          errore: null, provvisorio: '', inizio: avviatoDi(voce), pausa: evento.pausa === true, ...contaPause(voce),
        })
        break
      }
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
      concludi(voce, tr('il server si è riavviato'), true)
      break
    }
    case 'occupato': {
      // un'altra pagina scrive. Appena ricaricato può essere la connessione
      // vecchia di questa stessa pagina che sta ancora chiudendo: si riprova
      chiudi()
      if (++riprove <= RIPROVE) {
        timerRiprova = window.setTimeout(() => void riprendiSeInCorso(), 1500)
        break
      }
      riprove = 0
      segnaAltrove(String(evento.id), (evento.documentoId as string | null) ?? null)
      break
    }
    case 'sostituito': {
      // un'altra finestra ha detto «continua qui»
      const { id, documentoId } = leggiRegistrazione()
      chiudi()
      azzera()
      if (id) segnaAltrove(id, documentoId)
      break
    }
    case 'pronto': {
      // ripresa dopo un ricaricamento: il tempo zero resta quello vero
      if (!voce.get('avviato')) voce.set('avviato', Date.now())
      aggiorna({
        avvio: 'ascolto',
        inizio: avviatoDi(voce),
        dispositivo: typeof evento.dispositivo === 'string' ? evento.dispositivo : null,
        virtuale: evento.virtuale === true,
      })
      // ogni 5 s: se il cursore è passato a un altro blocco, àncora
      window.clearInterval(timerAncore)
      timerAncore = window.setInterval(() => annotaAncora(voce, opzioni), OGNI)
      annotaAncora(voce, opzioni)
      break
    }
    case 'pausa':
      segnaPausa(voce, Number(evento.quando) || Date.now())
      aggiorna({ pausa: true, provvisorio: '', ...contaPause(voce) })
      break
    case 'ripresa':
      chiudiPausa(voce, Number(evento.quando) || Date.now())
      aggiorna({ pausa: false, ...contaPause(voce) })
      break
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
        scriviSegmento(voce, {
          inizio: Number(evento.inizio),
          fine: Number(evento.fine),
          testo: String(evento.testo),
          parole: (evento.parole as Segmento['parole']) ?? [],
        })
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
      concludi(voce, leggiRegistrazione().errore, false, Date.now())
      break
    }
  }
}

/** Una frase nuova nel documento — se non c'è già: rimandata dal server
 *  dopo una ripresa, o arrivata da un'altra pagina che scriveva prima. */
function scriviSegmento(voce: Y.Map<unknown>, segmento: Segmento) {
  const k = chiave(segmento)
  if (giaScritti.has(k)) return
  giaScritti.add(k)
  const segmenti = voce.get('segmenti') as Y.Array<Segmento>
  if (segmenti.toArray().slice(-10).some((s) => chiave(s) === k)) return
  segmenti.push([segmento])
}

/** La fine di una registrazione, comunque sia andata. Se si è
 *  interrotta da sola, prima si recuperano le ultime frasi messe da
 *  parte dal server. */
function concludi(voce: Y.Map<unknown>, errore: string | null, interrotta: boolean, quando?: number) {
  const id = leggiRegistrazione().id
  chiudi()
  if (interrotta) {
    azzera(tr('{motivo}. Quello che era già trascritto è salvo.', { motivo: errore ?? tr('si è interrotta') }))
    void (id ? recuperaSospese(voce, id) : Promise.resolve()).then(() => chiudiVoce(voce, true))
    return
  }
  chiudiVoce(voce, false, errore, quando)
  azzera(errore)
  // tutto scritto da qui: le frasi messe da parte dal server non servono
  if (id) void fetch(`/api/ascolto/sospese/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

function annotaAncora(voce: Y.Map<unknown>, opzioni: Opzioni) {
  const { inizio, documentoId, pausa } = leggiRegistrazione()
  const editor = opzioni.editor()
  // le àncore hanno senso solo nella pagina che si sta registrando, e non in pausa
  if (!inizio || !editor || pausa || documentoId !== opzioni.documentoId) return

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
  idAtteso = null
  window.clearInterval(timerAncore)
  window.clearTimeout(timerCollegamento)
  window.clearTimeout(timerUscita)
  timerCollegamento = undefined
  timerUscita = undefined
}

// ── i comandi ───────────────────────────────────────────────────────

export async function fermaRegistrazione() {
  const { attiva, id } = leggiRegistrazione()
  const voce = voceCorrente
  if (!attiva || !voce) return
  aggiorna({ avvio: 'chiudo' })
  const r = await posta('ferma', { id })

  // il programma non c'era più (server ripartito): si chiude da qui
  if (!r.ok) return concludi(voce, null, false)
  // la chiusura vera arriva con l'evento «uscito», dopo gli ultimi
  // risultati; se non arriva, non si resta appesi per sempre
  window.clearTimeout(timerUscita)
  timerUscita = window.setTimeout(() => concludi(voce, null, false), ATTESA_USCITA)
}

/*  Pausa e ripresa si CHIEDONO al programma di ascolto: lo stato cambia
 *  quando lui risponde, così l'interfaccia dice sempre la verità. */
export async function pausaRegistrazione() {
  const { attiva, id, pausa, avvio } = leggiRegistrazione()
  if (attiva && avvio === 'ascolto' && !pausa) await posta('pausa', { id })
}

export async function riprendiRegistrazione() {
  const { attiva, id, pausa } = leggiRegistrazione()
  if (attiva && pausa) await posta('riprendi', { id })
}

/** Toglie una registrazione dal documento, il suo audio dal disco e le
 *  sue correzioni in diretta rimaste senza risposta. */
export async function eliminaRegistrazione(doc: Y.Doc, id: string) {
  const audio = mappaRegistrazioni(doc).get(id)?.get('audio')
  mappaRegistrazioni(doc).delete(id)
  togliCorrezioniDi(doc, id)
  if (audio) await fetch(`/api/audio/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

esponi({
  registrazione: {
    avviaRegistrazione, fermaRegistrazione, pausaRegistrazione, riprendiRegistrazione,
    riprendiSeInCorso, prendiQui, eliminaRegistrazione, leggiRegistrazione,
  },
})
