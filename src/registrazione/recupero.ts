import * as Y from 'yjs'
import { apriDocumento, mappaDocumenti } from '../documento/archivio'
import { leggiRegistrazione } from './statoRegistrazione'
import { chiave, chiudiVoce, mappaRegistrazioni } from './voci'
import type { Segmento } from './tipi'

/*  Le registrazioni rimaste a metà.
 *
 *  Se il server si ferma mentre registri, la pagina non c'è a vederlo:
 *  la registrazione resta «in corso» per sempre, e le ultime frasi —
 *  quelle che il programma di ascolto scrive mentre si chiude — il
 *  server le ha messe da parte in un file. Qui si recuperano e si
 *  chiude tutto, segnato «interrotta». */

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
const url = (id: string) => `/api/ascolto/sospese/${encodeURIComponent(id)}`

/** Le ultime frasi, messe da parte dal server. Se il programma di
 *  ascolto sta ancora finendo di scriverle, si aspetta. Il file si
 *  PRENDE (il server lo sposta): due pagine che lo leggessero insieme
 *  scriverebbero le frasi due volte. */
export async function recuperaSospese(voce: Y.Map<unknown>, id: string) {
  for (let giro = 0; giro < 12; giro++) {
    const ultimo = giro === 11
    const r = await fetch(`${url(id)}/prendi${ultimo ? '?forza=1' : ''}`, { method: 'POST' }).catch(() => null)
    if (r?.status === 409) { await pausa(1000); continue }   // non ancora chiuso
    if (!r?.ok) return                                        // niente, o l'ha già preso qualcun altro
    const j = await r.json().catch(() => null)

    const segmenti = voce.get('segmenti') as Y.Array<Segmento>
    const presenti = new Set(segmenti.toArray().map(chiave))
    const nuovi: Segmento[] = (Array.isArray(j?.eventi) ? j.eventi : [])
      .map((e: Record<string, unknown>) => ({
        inizio: Number(e.inizio), fine: Number(e.fine), testo: String(e.testo),
        parole: (e.parole as Segmento['parole']) ?? [],
      }))
      .filter((x: Segmento) => !presenti.has(chiave(x)))
    if (nuovi.length) segmenti.push(nuovi)
    await fetch(url(id), { method: 'DELETE' }).catch(() => {})
    return
  }
}

const inChiusura = new Set<string>()

/** Registrazioni rimaste «in corso»: si chiudono con quello che
 *  contengono — a meno che non stiano registrando davvero, magari in
 *  un'altra finestra: lo sa solo il server. */
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

/** All'avvio: le registrazioni che il server ha messo da parte, anche
 *  in pagine che non sono aperte. */
export async function recuperaInterrotte() {
  const elenco = await fetch('/api/ascolto/sospese').then((r) => r.json()).catch(() => [])
  for (const { id, documentoId } of Array.isArray(elenco) ? elenco : []) {
    // la pagina non c'è più: le frasi non hanno dove andare
    if (!documentoId || !mappaDocumenti.has(documentoId)) {
      await fetch(url(id), { method: 'DELETE' }).catch(() => {})
      continue
    }
    const { doc, pronto } = apriDocumento(documentoId)
    await pronto
    const voce = mappaRegistrazioni(doc).get(id)
    if (!voce) await fetch(url(id), { method: 'DELETE' }).catch(() => {})   // registrazione eliminata
    else if (voce.get('fine') === null) await chiudiOrfane(doc)
    else await recuperaSospese(voce, id)   // già chiusa, ma le ultime frasi mancano ancora
  }
}
