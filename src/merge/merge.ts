import type { Editor } from '@tiptap/core'
import * as Y from 'yjs'
import { allinea } from './allinea'
import { costruisciPrompt, type TrattoDiLezione } from './prompt'
import { applica, applicaTitoli, blocchiDi, righeDi, rimappaBlocchi, type Proposta, type Titolo } from './applica'
import { istruzioniDiStile, stileDellaPagina } from './marcatura'
import { togliDoppioni } from './doppioni'
import { leggiRegistrazioni, mappaRegistrazioni } from '../registrazione/registrazione'
import type { Registrazione } from '../registrazione/tipi'
import { chiediJson } from '../lib/modello'
import { leggiImpostazioni } from '../impostazioni'
import { esponi } from '../lib/dev'
import { aggiungiConsigli, type Richiesta } from '../immagini/consigliate'
import { locale, tr } from '../lingua/lingua'

/*  Il merge dopo la lezione: UNA chiamata per lezione.
 *
 *  Col tetto di 50 chiamate al giorno della chiave gratuita, tre
 *  chiamate separate (segmentare, integrare, titolare) avrebbero fatto
 *  sei lezioni al massimo. Una sola chiamata fa la stessa cosa.
 *
 *  Si integra in due modi. Una lezione alla volta, appena finita:
 *  è il modo di tutti i giorni. Oppure tutte insieme, a fine corso o
 *  prima dell'esame: il modello vede la materia intera e capisce che
 *  la frase lasciata a metà a ottobre è quella ripresa a novembre.
 *  Una lezione alla volta non potrebbe saperlo. */

const MASSIMO = 8
const MASSIMO_INSIEME = 16

export type EsitoMerge = { proposte: number; scartate: number; immagini: number; costo: number | null }

/** A che punto è il merge, per dirlo mentre si aspetta. */
export type FaseMerge = 'preparo' | 'chiedo' | 'riprovo' | 'inserisco' | 'immagini'

/** I tratti di una registrazione, agganciati ai blocchi di adesso. */
function trattiDi(editor: Editor, reg: Registrazione, lezione?: string): TrattoDiLezione[] {
  const rimappa = rimappaBlocchi(editor)
  return allinea(reg.segmenti, reg.ancore.map((a) => ({ t: a.t, blocco: rimappa(a.blocco) })))
    .map((t) => ({ ...t, lezione }))
}

const giorno = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })

export async function integraLezione(
  editor: Editor,
  doc: Y.Doc,
  idRegistrazione: string,
  materia: string,
  avanza: (fase: FaseMerge) => void = () => {},
): Promise<EsitoMerge> {
  const reg = leggiRegistrazioni(doc).find((r) => r.id === idRegistrazione)
  if (!reg) throw new Error(tr('registrazione non trovata'))
  if (!reg.segmenti.length) throw new Error(tr('la registrazione non contiene parlato'))

  avanza('preparo')
  const esito = await integra(editor, doc, materia, trattiDi(editor, reg), 1, MASSIMO, avanza)
  mappaRegistrazioni(doc).get(idRegistrazione)?.set('integrata', esito.proposte)
  return esito
}

/*  Tutte le lezioni della pagina, in una chiamata sola.
 *
 *  Le trascrizioni si mettono in fila, ognuna col suo giorno, e il
 *  modello le legge insieme: un dato ripetuto in due lezioni diventa
 *  una proposta sola, e una precisazione fatta dopo vince su ciò che
 *  era stato detto prima. Con una lezione sola non c'è niente da
 *  mettere insieme: si fa il merge normale. */
export async function integraTutto(
  editor: Editor,
  doc: Y.Doc,
  materia: string,
  avanza: (fase: FaseMerge) => void = () => {},
): Promise<EsitoMerge> {
  const lezioni = leggiRegistrazioni(doc).filter((r) => r.fine !== null && r.segmenti.length)
  if (!lezioni.length) throw new Error(tr('questa pagina non ha lezioni finite da integrare'))
  if (lezioni.length === 1) return integraLezione(editor, doc, lezioni[0].id, materia, avanza)

  avanza('preparo')
  const tratti = lezioni.flatMap((r) => trattiDi(editor, r, tr('lezione del {giorno}', { giorno: giorno(r.inizio) })))
  const esito = await integra(editor, doc, materia, tratti, lezioni.length, MASSIMO_INSIEME, avanza)
  const adesso = Date.now()
  for (const r of lezioni) mappaRegistrazioni(doc).get(r.id)?.set('insieme', adesso)
  return esito
}

/*  Il motore, uguale per tutti e due: chiede, tiene solo ciò che è
 *  ben formato e non è già scritto, e lo mette in pagina. */
async function integra(
  editor: Editor,
  doc: Y.Doc,
  materia: string,
  tratti: TrattoDiLezione[],
  lezioni: number,
  massimo: number,
  avanza: (fase: FaseMerge) => void,
): Promise<EsitoMerge> {
  const blocchi = blocchiDi(editor)

  avanza('chiedo')
  const stile = istruzioniDiStile(stileDellaPagina(editor.state.doc))
  // le istruzioni possono essere le tue: Impostazioni › Integratore
  const istruzioni = leggiImpostazioni().promptMerge
  const { json, costo } = await chiediJson('merge', costruisciPrompt(materia, blocchi, tratti, stile, { lezioni, massimo, istruzioni }), {
    maxToken: lezioni > 1 ? 12000 : 8000,
    riprovo: () => avanza('riprovo'),
  })
  const proposte = (Array.isArray(json.proposte) ? json.proposte : []) as Proposta[]
  const richiesteImmagini = (Array.isArray(json.immagini) ? json.immagini : []) as Richiesta[]
  const titoli = (Array.isArray(json.titoli) ? json.titoli : []) as Titolo[]

  avanza('inserisco')
  // si tiene solo ciò che è ben formato e punta a un blocco che esiste
  const idValidi = new Set(blocchi.map((b) => b.id))
  const ben = proposte
    .map((p, ordine) => ({ ...p, ordine }))
    .filter((p) => p && typeof p.testo === 'string' && p.testo.trim() && idValidi.has(p.dopo))
    .map((p) => ({
      ...p,
      tipo: p.tipo === 'correggi' ? 'correggi' as const : p.tipo === 'completa' ? 'completa' as const : 'integra' as const,
      punto: typeof p.punto === 'string' ? p.punto : undefined,
      titolo: typeof p.titolo === 'string' ? p.titolo : undefined,
      importanza: Number(p.importanza) || 3,
    }))
    .sort((a, b) => b.importanza - a.importanza)

  // le più importanti, senza doppioni; poi di nuovo nell'ordine del modello
  const buone = togliDoppioni(ben, righeDi(editor))
    .slice(0, massimo)
    .sort((a, b) => a.ordine - b.ordine)

  const titoliBuoni = titoli.filter((t) => t && typeof t.titolo === 'string' && t.titolo.trim() && idValidi.has(t.prima))
  const fatte = applica(editor, buone) + applicaTitoli(editor, titoliBuoni)

  // i consigli di immagini arrivano gratis con la stessa chiamata
  if (richiesteImmagini.length) avanza('immagini')
  const immagini = await aggiungiConsigli(editor, doc, richiesteImmagini).catch(() => 0)

  return { proposte: fatte, scartate: proposte.length - fatte, immagini, costo }
}

esponi({ merge: { integraLezione, integraTutto, allinea, applica, applicaTitoli } })
