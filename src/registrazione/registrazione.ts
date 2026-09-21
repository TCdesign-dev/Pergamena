import * as Y from 'yjs'
import type { Editor } from '@tiptap/core'
import { apriDocumento } from '../documento/archivio'
import { aggiorna, azzera, leggiRegistrazione } from './statoRegistrazione'
import type { Segmento, Ancora, Registrazione } from './tipi'
import { esponi } from '../lib/dev'
import { leggiImpostazioni } from '../impostazioni'

/*  Avvia e ferma l'ascolto, e scrive nel documento ciò che arriva.
 *
 *  I segmenti vanno nel documento man mano che il riconoscitore li
 *  chiude, non tutti alla fine: se il Mac si spegne a metà lezione,
 *  quello che è stato detto fino a lì è già salvo e sincronizzato. */

const OGNI = 5_000   // ms fra un controllo e l'altro della posizione del cursore

let sorgente: EventSource | null = null
let timerAncore: number | undefined

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
    })
  })
  return elenco.sort((a, b) => a.inizio - b.inizio)
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
  sorgente = new EventSource('/api/ascolto/eventi')
  sorgente.onmessage = (e) => ricevi(JSON.parse(e.data), voce, opzioni)

  const r = await fetch('/api/ascolto/avvia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
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

function ricevi(
  evento: Record<string, unknown>,
  voce: Y.Map<unknown>,
  opzioni: { documentoId: string; editor: () => Editor | null },
) {
  switch (evento.evento) {
    case 'pronto': {
      aggiorna({
        avvio: 'ascolto',
        inizio: Date.now(),
        dispositivo: typeof evento.dispositivo === 'string' ? evento.dispositivo : null,
        virtuale: evento.virtuale === true,
      })
      // ogni 5 s: se il cursore è passato a un altro blocco, àncora
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
        ;(voce.get('segmenti') as Y.Array<Segmento>).push([{
          inizio: Number(evento.inizio),
          fine: Number(evento.fine),
          testo: String(evento.testo),
          parole: (evento.parole as Segmento['parole']) ?? [],
        }])
        aggiorna({ provvisorio: '' })
      } else {
        aggiorna({ provvisorio: String(evento.testo) })
      }
      break
    case 'errore':
      aggiorna({ errore: String(evento.messaggio) })
      break
    case 'uscito': {
      chiudi()
      const errore = leggiRegistrazione().errore
      const segmenti = voce.get('segmenti') as Y.Array<Segmento>
      // un tentativo fallito senza parlato non lascia una lezione vuota
      if (errore && segmenti.length === 0) {
        voce.doc?.getMap('registrazioni').forEach((v, k) => { if (v === voce) mappaRegistrazioni(voce.doc!).delete(k) })
      } else {
        voce.set('fine', Date.now())
      }
      azzera(errore)
      break
    }
  }
}

function annotaAncora(voce: Y.Map<unknown>, opzioni: { documentoId: string; editor: () => Editor | null }) {
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
  window.clearInterval(timerAncore)
}

export async function fermaRegistrazione() {
  if (!leggiRegistrazione().attiva) return
  aggiorna({ avvio: 'chiudo' })
  await fetch('/api/ascolto/ferma', { method: 'POST' }).catch(() => {})
  // la chiusura vera arriva con l'evento «uscito», dopo gli ultimi risultati
}

/** Toglie una registrazione dal documento, e il suo audio dal disco. */
export async function eliminaRegistrazione(doc: Y.Doc, id: string) {
  const audio = mappaRegistrazioni(doc).get(id)?.get('audio')
  mappaRegistrazioni(doc).delete(id)
  if (audio) await fetch(`/api/audio/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

esponi({ registrazione: { avviaRegistrazione, fermaRegistrazione, leggiRegistrazioni, eliminaRegistrazione } })
