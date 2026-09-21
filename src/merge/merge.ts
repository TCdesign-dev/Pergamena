import type { Editor } from '@tiptap/core'
import * as Y from 'yjs'
import { allinea } from './allinea'
import { costruisciPrompt } from './prompt'
import { applica, blocchiDi, righeDi, rimappaBlocchi, type Proposta } from './applica'
import { togliDoppioni } from './doppioni'
import { leggiRegistrazioni, mappaRegistrazioni } from '../registrazione/registrazione'
import { chiediJson } from '../lib/modello'
import { esponi } from '../lib/dev'
import { aggiungiConsigli, type Richiesta } from '../immagini/consigliate'

/*  Il merge dopo la lezione: UNA chiamata per lezione.
 *
 *  Col tetto di 50 chiamate al giorno della chiave gratuita, tre
 *  chiamate separate (segmentare, integrare, titolare) avrebbero fatto
 *  sei lezioni al massimo. Una sola chiamata fa la stessa cosa. */

const MASSIMO = 8

export type EsitoMerge = { proposte: number; scartate: number; immagini: number; costo: number | null }

/** A che punto è il merge, per dirlo mentre si aspetta. */
export type FaseMerge = 'preparo' | 'chiedo' | 'riprovo' | 'inserisco' | 'immagini'

export async function integraLezione(
  editor: Editor,
  doc: Y.Doc,
  idRegistrazione: string,
  materia: string,
  avanza: (fase: FaseMerge) => void = () => {},
): Promise<EsitoMerge> {
  const reg = leggiRegistrazioni(doc).find((r) => r.id === idRegistrazione)
  if (!reg) throw new Error('registrazione non trovata')
  if (!reg.segmenti.length) throw new Error('la registrazione non contiene parlato')

  avanza('preparo')
  const blocchi = blocchiDi(editor)
  const rimappa = rimappaBlocchi(editor)
  const tratti = allinea(reg.segmenti, reg.ancore.map((a) => ({ t: a.t, blocco: rimappa(a.blocco) })))

  avanza('chiedo')
  const { json, costo } = await chiediJson('merge', costruisciPrompt(materia, blocchi, tratti), {
    maxToken: 8000,
    riprovo: () => avanza('riprovo'),
  })
  const proposte = (Array.isArray(json.proposte) ? json.proposte : []) as Proposta[]
  const richiesteImmagini = (Array.isArray(json.immagini) ? json.immagini : []) as Richiesta[]

  avanza('inserisco')
  // si tiene solo ciò che è ben formato e punta a un blocco che esiste
  const idValidi = new Set(blocchi.map((b) => b.id))
  const ben = proposte
    .map((p, ordine) => ({ ...p, ordine }))
    .filter((p) => p && typeof p.testo === 'string' && p.testo.trim() && idValidi.has(p.dopo))
    .map((p) => ({ ...p, tipo: p.tipo === 'correggi' ? 'correggi' as const : 'integra' as const, importanza: Number(p.importanza) || 3 }))
    .sort((a, b) => b.importanza - a.importanza)

  // le più importanti, senza doppioni; poi di nuovo nell'ordine del modello
  const buone = togliDoppioni(ben, righeDi(editor))
    .slice(0, MASSIMO)
    .sort((a, b) => a.ordine - b.ordine)

  const fatte = applica(editor, buone)
  mappaRegistrazioni(doc).get(idRegistrazione)?.set('integrata', fatte)

  // i consigli di immagini arrivano gratis con la stessa chiamata
  if (richiesteImmagini.length) avanza('immagini')
  const immagini = await aggiungiConsigli(editor, doc, richiesteImmagini).catch(() => 0)

  return { proposte: fatte, scartate: proposte.length - fatte, immagini, costo }
}

esponi({ merge: { integraLezione, allinea } })
