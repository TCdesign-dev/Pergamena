import type { Editor } from '@tiptap/core'
import * as Y from 'yjs'
import { allinea } from './allinea'
import { costruisciPrompt } from './prompt'
import { applica, blocchiDi, type Proposta } from './applica'
import { leggiRegistrazioni, mappaRegistrazioni } from '../registrazione/registrazione'
import { esponi } from '../lib/dev'
import { aggiungiConsigli, type Richiesta } from '../immagini/consigliate'

/*  Il merge dopo la lezione: UNA chiamata per lezione.
 *
 *  Col tetto di 50 chiamate al giorno della chiave gratuita, tre
 *  chiamate separate (segmentare, integrare, titolare) avrebbero fatto
 *  sei lezioni al massimo. Una sola chiamata fa la stessa cosa. */

const MASSIMO = 8

export type EsitoMerge = { proposte: number; scartate: number; immagini: number; costo: number | null }

export async function integraLezione(editor: Editor, doc: Y.Doc, idRegistrazione: string, materia: string): Promise<EsitoMerge> {
  const reg = leggiRegistrazioni(doc).find((r) => r.id === idRegistrazione)
  if (!reg) throw new Error('registrazione non trovata')
  if (!reg.segmenti.length) throw new Error('la registrazione non contiene parlato')

  const blocchi = blocchiDi(editor)
  const tratti = allinea(reg.segmenti, reg.ancore)

  const risposta = await fetch('/api/llm/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: costruisciPrompt(materia, blocchi, tratti),
      response_format: { type: 'json_object' },
      reasoning: { effort: 'low' },
      max_tokens: 4000,
      temperature: 0.2,
    }),
  })

  const dati = await risposta.json()
  if (!risposta.ok || dati.error) {
    throw new Error(dati.error?.message ?? dati.errore ?? `merge fallito (${risposta.status})`)
  }

  const grezzo = String(dati.choices?.[0]?.message?.content ?? '')
  let proposte: Proposta[]
  let richiesteImmagini: Richiesta[] = []
  try {
    const j = JSON.parse(grezzo.slice(grezzo.indexOf('{'), grezzo.lastIndexOf('}') + 1))
    proposte = Array.isArray(j.proposte) ? j.proposte : []
    richiesteImmagini = Array.isArray(j.immagini) ? j.immagini : []
  } catch {
    throw new Error('il modello non ha risposto in JSON')
  }

  // si tiene solo ciò che è ben formato e punta a un blocco che esiste
  const idValidi = new Set(blocchi.map((b) => b.id))
  const buone = proposte
    .filter((p) => p && typeof p.testo === 'string' && p.testo.trim() && idValidi.has(p.dopo))
    .map((p) => ({ ...p, tipo: p.tipo === 'correggi' ? 'correggi' as const : 'integra' as const, importanza: Number(p.importanza) || 3 }))
    .sort((a, b) => b.importanza - a.importanza)
    .slice(0, MASSIMO)

  const fatte = applica(editor, buone)
  mappaRegistrazioni(doc).get(idRegistrazione)?.set('integrata', fatte)

  // i consigli di immagini arrivano gratis con la stessa chiamata
  const immagini = await aggiungiConsigli(editor, doc, richiesteImmagini).catch(() => 0)

  return { proposte: fatte, scartate: proposte.length - fatte, immagini, costo: dati.usage?.cost ?? null }
}

esponi({ merge: { integraLezione, allinea } })
