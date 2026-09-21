import * as Y from 'yjs'
import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { cercaSuCommons, type Trovata } from './commons'
import { blocchiDi } from '../merge/applica'
import { normalizza } from '../lib/testo'
import { esponi } from '../lib/dev'
import { chiediJson } from '../lib/modello'

/*  Le immagini consigliate dall'AI.
 *
 *  Vivono nel documento Yjs della pagina, come le lezioni: così
 *  «Non serve» se lo ricorda la pagina — anche sul telefono e dopo un
 *  ricaricamento — e un concetto scartato non torna.
 *
 *  Ogni consiglio è agganciato a un blocco degli appunti: sa già dove
 *  andare. È la differenza con una ricerca, che va dove la trascini. */

export type Consiglio = {
  id: string
  concetto: string
  query: string
  blocco: string          // l'id del blocco che lo nomina
  citazione: string       // un pezzo di quel blocco, per dire «perché»
  stato: 'nuovo' | 'inserito' | 'scartato'
  risultati: Trovata[]    // i primi quattro da Commons
  creato: number
}

export type Richiesta = { concetto: string; query: string; blocco: string }

const MASSIMO_PER_PAGINA = 5

export function mappaConsigli(doc: Y.Doc) {
  return doc.getMap<Consiglio>('immaginiConsigliate')
}

export function leggiConsigli(doc: Y.Doc): Consiglio[] {
  return [...mappaConsigli(doc).values()].sort((a, b) => a.creato - b.creato)
}

export function useConsigli(doc: Y.Doc | null) {
  const [elenco, setElenco] = useState<Consiglio[]>(() => (doc ? leggiConsigli(doc) : []))
  useEffect(() => {
    if (!doc) { setElenco([]); return }
    const m = mappaConsigli(doc)
    const aggiorna = () => setElenco(leggiConsigli(doc))
    aggiorna()
    m.observe(aggiorna)
    return () => m.unobserve(aggiorna)
  }, [doc])
  return elenco
}

/** Aggiunge i consigli nuovi, cercandoli su Commons. Salta quelli già
 *  presenti o già scartati, e quelli per cui Commons non ha niente. */
export async function aggiungiConsigli(editor: Editor, doc: Y.Doc, richieste: Richiesta[]) {
  const mappa = mappaConsigli(doc)
  const gia = new Set([...mappa.values()].map((c) => normalizza(c.concetto)))
  const blocchi = new Map(blocchiDi(editor).map((b) => [b.id, b.testo]))
  const liberi = MASSIMO_PER_PAGINA - [...mappa.values()].filter((c) => c.stato === 'nuovo').length

  const scelte = richieste
    .filter((r) => r && r.concetto?.trim() && r.query?.trim() && blocchi.has(r.blocco))
    .filter((r) => !gia.has(normalizza(r.concetto)))
    .slice(0, Math.max(0, liberi))

  let aggiunti = 0
  for (const r of scelte) {
    const risultati = await cercaSuCommons(r.query, 4).catch(() => [] as Trovata[])
    if (!risultati.length) continue
    const testo = blocchi.get(r.blocco) ?? ''
    const id = `c-${Date.now().toString(36)}-${aggiunti}`
    mappa.set(id, {
      id,
      concetto: r.concetto.trim(),
      query: r.query.trim(),
      blocco: r.blocco,
      citazione: testo.length > 70 ? `…${testo.slice(0, 68)}…` : testo,
      stato: 'nuovo',
      risultati,
      creato: Date.now() + aggiunti,
    })
    aggiunti++
  }
  return aggiunti
}

export function cambiaStato(doc: Y.Doc, id: string, stato: Consiglio['stato']) {
  const c = mappaConsigli(doc).get(id)
  if (c) mappaConsigli(doc).set(id, { ...c, stato })
}

/** Porta in cima la foto scelta fra le alternative. */
export function scegliFoto(doc: Y.Doc, id: string, indice: number) {
  const c = mappaConsigli(doc).get(id)
  if (!c || !c.risultati[indice]) return
  const r = [...c.risultati]
  const [scelta] = r.splice(indice, 1)
  mappaConsigli(doc).set(id, { ...c, risultati: [scelta, ...r] })
}

/*  Il prompt per i consigli a richiesta (le pagine senza lezione).
 *  Col merge, la stessa domanda viaggia dentro alla stessa chiamata. */
export const DOMANDA_IMMAGINI = `Indica al massimo 4 concetti degli appunti per cui un'immagine aiuterebbe
davvero a capire o a ricordare: luoghi, edifici, opere d'arte, persone, oggetti,
schemi, mappe. Niente concetti astratti che non hanno un'immagine chiara, niente
concetti che negli appunti hanno già un'immagine (blocchi di tipo «immagine»).
Per ciascuno: "concetto" (breve), "query" per Wikimedia Commons (nella lingua che
dà i risultati migliori, spesso l'inglese), "blocco" (l'id del blocco che lo nomina).`

export async function suggerisci(editor: Editor, doc: Y.Doc, materia: string) {
  const blocchi = blocchiDi(editor)
  if (!blocchi.length) return 0

  const appunti = blocchi.map((b) => `[${b.id}]${b.tipo !== 'paragrafo' ? ` (${b.tipo})` : ''} ${b.testo}`).join('\n')
  const { json } = await chiediJson('veloce', [
    { role: 'system', content: `Sei l'assistente di uno studente. ${DOMANDA_IMMAGINI}\nRispondi SOLO con un oggetto JSON: {"immagini":[{"concetto":"...","query":"...","blocco":"<id>"}]}` },
    { role: 'user', content: `MATERIA: ${materia || 'non indicata'}\n\nAPPUNTI:\n${appunti}` },
  ], { maxToken: 1500 })

  return aggiungiConsigli(editor, doc, Array.isArray(json.immagini) ? json.immagini as Richiesta[] : [])
}

esponi({ consigliate: { suggerisci, aggiungiConsigli, leggiConsigli, cambiaStato } })
