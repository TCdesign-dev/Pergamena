import * as Y from 'yjs'
import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { cercaSuCommons, type Trovata } from './commons'
import { daWikipedia } from './wikipedia'
import { cercaSulWeb } from './web'
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
  risultati: Trovata[]    // le prime quattro foto trovate
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

/** Aggiunge i consigli nuovi, cercandone le foto (vedi `fotoPer`).
 *  Salta quelli già presenti o già scartati, e quelli per cui non si
 *  è trovato niente. */
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
    const risultati = await fotoPer(r.query)
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

const unici = (t: Trovata[]) => t.filter((x, i) => t.findIndex((y) => y.chiave === x.chiave) === i)

/*  Le foto di un consiglio, in ordine di quanto è probabile che
 *  c'entrino.
 *
 *  Prima Wikipedia: l'immagine in cima all'articolo che parla di
 *  quella cosa l'ha scelta chi l'articolo l'ha scritto, ed è quasi
 *  sempre quella giusta. La ricerca a parole di Commons non ci
 *  arriva, perché guarda i nomi dei file: «cane» le fa tirare fuori
 *  «Cane cutters in Jamaica», e per questo le immagini consigliate
 *  quasi non c'entravano mai.
 *
 *  Poi Commons, ma col termine inglese che Wikipedia ha appena dato:
 *  i file, lì, si chiamano quasi tutti in inglese. Il web soltanto se
 *  le prime due non hanno trovato niente. */
async function fotoPer(query: string): Promise<Trovata[]> {
  const { inglese, immagini } = await daWikipedia(query, 2)
    .catch(() => ({ inglese: null, immagini: [] as Trovata[] }))
  const commons = await cercaSuCommons(inglese ?? query, 4).catch(() => [] as Trovata[])

  const insieme = unici([...immagini, ...commons])
  if (insieme.length) return insieme.slice(0, 4)

  const web = await cercaSulWeb(query, 4, inglese).catch(() => null)
  return (web?.risultati ?? []).map((t) => ({ ...t, fonte: web!.fonte })).slice(0, 4)
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
Per ciascuno: "concetto" (breve), "query" per cercare l'immagine — nella lingua degli appunti,
come la cosa si chiama davvero — e "blocco" (l'id del blocco che lo nomina).`

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
