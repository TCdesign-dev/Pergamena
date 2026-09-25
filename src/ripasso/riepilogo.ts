import { useEffect, useState } from 'react'
import { indice, mappaDocumenti } from '../documento/archivio'
import { leggiDocumento } from '../documento/leggi'
import { leggiRegistrazioni } from '../registrazione/voci'
import { chiediJson } from '../lib/modello'
import { argomentiDellaPagina } from './argomenti'
import { comeRispondere, locale } from '../lingua/lingua'

/*  «Dove eravamo rimasti»: il punto della situazione sulle ultime
 *  lezioni di una materia, da leggere prima di entrare in aula.
 *
 *  Una lezione è un GIORNO: le registrazioni si fanno a pezzi (le 15:15,
 *  le 15:34, le 16:30…) e insieme fanno la lezione. Se non ci sono
 *  registrazioni si guardano le ultime pagine scritte.
 *
 *  Il riepilogo sta nell'indice, sincronizzato: fatto sul Mac, lo si
 *  rilegge dal telefono sul tram. Si rifà solo quando le lezioni sono
 *  cambiate — lo dice `fonti`. */

export type LezioneRiassunta = { chiave: string; quando: number; pagine: string[]; punti: string[] }
export type Riepilogo = { creato: number; fonti: string; lezioni: LezioneRiassunta[] }

const mappa = indice.getMap<Riepilogo>('riepiloghi')
const TETTO = 20_000   // caratteri per lezione: una lezione di due ore

type Materiale = { chiave: string; quando: number; pagine: string[]; titoli: string[]; testo: string }

const giorno = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Le ultime due lezioni della materia, con quello che serve a riassumerle. */
async function ultimeLezioni(quadernoId: string): Promise<{ lezioni: Materiale[]; daAppunti: boolean }> {
  const pagine = [...mappaDocumenti.values()].filter((d) => d.quadernoId === quadernoId && !d.scheda)
  const perGiorno = new Map<string, Materiale & { pezzi: { t: number; testo: string }[] }>()
  const appunti: Materiale[] = []

  for (const d of pagine) {
    await leggiDocumento(d.id, (doc) => {
      const titoli = argomentiDellaPagina(doc, d).map((a) => a.titolo)
      for (const r of leggiRegistrazioni(doc)) {
        if (r.fine === null || !r.segmenti.length) continue
        const g = giorno(r.inizio)
        const voce = perGiorno.get(g) ?? { chiave: g, quando: r.inizio, pagine: [], titoli: [], testo: '', pezzi: [] }
        voce.quando = Math.max(voce.quando, r.inizio)
        if (!voce.pagine.includes(d.titolo || 'Senza titolo')) voce.pagine.push(d.titolo || 'Senza titolo')
        voce.titoli.push(...titoli.filter((t) => !voce.titoli.includes(t)))
        voce.pezzi.push({ t: r.inizio, testo: r.segmenti.map((s) => s.testo).join(' ') })
        perGiorno.set(g, voce)
      }
      const testo = argomentiDellaPagina(doc, d).map((a) => `## ${a.titolo}\n${a.blocchi.map((b) => b.testo).join('\n')}`).join('\n')
      if (testo.trim()) appunti.push({ chiave: `${d.id}@${d.modificato}`, quando: d.modificato, pagine: [d.titolo || 'Senza titolo'], titoli, testo })
    })
  }

  const lezioni = [...perGiorno.values()]
    .map((v) => ({ ...v, testo: v.pezzi.sort((a, b) => a.t - b.t).map((p) => p.testo).join(' ').slice(0, TETTO) }))
    .sort((a, b) => b.quando - a.quando)
    .slice(0, 2)
  if (lezioni.length) return { lezioni, daAppunti: false }
  return { lezioni: appunti.sort((a, b) => b.quando - a.quando).slice(0, 2), daAppunti: true }
}

const SISTEMA = `Sei l'assistente di uno studente universitario. Ricevi il materiale delle
ultime lezioni di una materia: la trascrizione automatica di ciò che ha detto
il professore (può storpiare nomi e numeri), oppure gli appunti.

Per ogni lezione scrivi il punto della situazione, da rileggere prima della
lezione successiva: da 3 a 6 punti brevi, in stile appunti, nell'ordine in
cui le cose sono state spiegate. Concetti, definizioni, dati e regole che
contano; niente saluti, niente battute, niente organizzazione del corso —
tranne ciò che riguarda l'esame. Mai inventare quello che non c'è.

Rispondi SOLO con un oggetto JSON:
{"lezioni":[{"chiave":"...","punti":["...","..."]}]}`

/** Da dove verrebbe il riepilogo adesso: se è diverso da quello salvato,
 *  il riepilogo salvato è vecchio. */
export async function fontiAttuali(quadernoId: string) {
  const { lezioni } = await ultimeLezioni(quadernoId)
  return lezioni.map((l) => `${l.chiave}:${l.testo.length}`).join('|')
}

export async function faiRiepilogo(quadernoId: string, materia: string): Promise<Riepilogo | null> {
  const { lezioni, daAppunti } = await ultimeLezioni(quadernoId)
  if (!lezioni.length) return null

  const materiale = lezioni.map((l) =>
    `LEZIONE ${l.chiave} — ${new Date(l.quando).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}` +
    ` (pagine: ${l.pagine.join(', ')})\n` +
    (l.titoli.length ? `Titoli negli appunti: ${l.titoli.join(' · ')}\n` : '') +
    `${daAppunti ? 'APPUNTI' : 'TRASCRIZIONE'}:\n${l.testo}`,
  ).join('\n\n')

  const { json } = await chiediJson('quiz', [
    { role: 'system', content: `${SISTEMA}\n\n${comeRispondere()}` },
    { role: 'user', content: `MATERIA: ${materia || 'non indicata'}\n\n${materiale}` },
  ], { maxToken: 2500 })

  const risposte = Array.isArray(json.lezioni) ? json.lezioni as { chiave?: string; punti?: unknown[] }[] : []
  const riepilogo: Riepilogo = {
    creato: Date.now(),
    fonti: lezioni.map((l) => `${l.chiave}:${l.testo.length}`).join('|'),
    lezioni: lezioni.map((l, k) => {
      const r = risposte.find((x) => x.chiave === l.chiave) ?? risposte[k]
      return {
        chiave: l.chiave,
        quando: l.quando,
        pagine: l.pagine,
        punti: (Array.isArray(r?.punti) ? r!.punti : []).map((p) => String(p).trim()).filter(Boolean).slice(0, 6),
      }
    }).filter((l) => l.punti.length),
  }
  mappa.set(quadernoId, riepilogo)
  return riepilogo
}

export function useRiepilogo(quadernoId: string) {
  const [r, setR] = useState(() => mappa.get(quadernoId) ?? null)
  useEffect(() => {
    const aggiorna = () => setR(mappa.get(quadernoId) ?? null)
    aggiorna()
    mappa.observe(aggiorna)
    return () => mappa.unobserve(aggiorna)
  }, [quadernoId])
  return r
}
