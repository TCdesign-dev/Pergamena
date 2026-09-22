import type { EditorView } from '@tiptap/pm/view'
import type { Node as NodoPM, ResolvedPos } from '@tiptap/pm/model'
import type * as Y from 'yjs'
import { iscrivitiRegistrazione, leggiRegistrazione } from '../registrazione/statoRegistrazione'
import { mappaRegistrazioni } from '../registrazione/voci'
import { mappaDocumenti, mappaQuaderni } from '../documento/archivio'
import { leggiImpostazioni } from '../impostazioni'
import { CreditoFinito, eCreditoFinito } from '../lib/decisioni'
import { finestraDi } from './finestra'
import { meritaControllo } from './confronto'
import { sospette } from './triage'
import { proponi } from './proponi'
import { aggiungiCorrezione } from './deposito'
import { annota, contaControllo, leggiStatoCorrezioni, segnaIntoppo } from './statoCorrezioni'

/*  Il sorvegliante: uno per ogni pagina aperta, lavora solo in quella
 *  che si sta registrando, e solo se le correzioni sono accese.
 *
 *  Si annota le righe che scrivi. Una riga si controlla quando è FINITA:
 *  quando il cursore è passato a un'altra, o dopo 4 secondi senza
 *  battere un tasto — controllarla a metà frase vorrebbe dire segnalare
 *  come «mancante» quello che stai ancora scrivendo. Poi, insieme, fino
 *  a sei righe finite contro gli ultimi 90 secondi di lezione:
 *
 *    Jev (sospetta?) → DeepSeek, solo sulle sospette → regole → margine
 *
 *  Al massimo un controllo ogni 10 secondi, e ogni versione di una riga
 *  si controlla una volta sola. Quando la registrazione si ferma, un
 *  ultimo giro per le righe che aspettavano ancora. */

const PASSO = 1_500          // ms fra un'occhiata e l'altra
const FERMA = 4_000          // ms senza tasti: la riga sotto al cursore è finita
const INTERVALLO = 10_000    // ms minimi fra due controlli
const PAZIENZA_MAX = 120_000 // ms: dopo un intoppo si aspetta sempre di più, fino a qui
const RECENTE = 120_000      // ms: una riga scritta prima non si controlla più
const PER_VOLTA = 6          // righe per controllo
const MIN_PAROLE = 8         // sotto, il professore non ha ancora detto abbastanza

/** Il blocco più interno con un id: il paragrafo, anche dentro a un elenco. */
export function bloccoDi($pos: ResolvedPos): string | null {
  for (let d = $pos.depth; d > 0; d--) {
    const id = $pos.node(d).attrs?.idBlocco as string | undefined
    if (id) return id
  }
  return null
}

function testiDi(doc: NodoPM, ids: Set<string>) {
  const testi = new Map<string, string>()
  doc.descendants((nodo) => {
    if (testi.size === ids.size) return false
    if (!nodo.isTextblock) return true
    const id = nodo.attrs.idBlocco as string | null
    if (id && ids.has(id)) testi.set(id, nodo.textContent.trim())
    return false
  })
  return testi
}

function materiaDi(documentoId: string) {
  const q = mappaDocumenti.get(documentoId)?.quadernoId
  return (q && mappaQuaderni.get(q)?.nome) || ''
}

export class Sorveglianza {
  private toccate = new Map<string, number>()      // blocco → ultimo tasto (ms)
  private controllate = new Map<string, string>()  // blocco → testo all'ultimo controllo
  private ultimo = 0
  private attesa = INTERVALLO
  private inCorso = false
  private registrazione: string | null = null      // quella che si sta seguendo
  private giroInSospeso: string | null = null      // l'ultimo giro, se è finita durante un controllo
  private timer: number
  private stacca: () => void

  constructor(private view: EditorView, private doc: Y.Doc, private documentoId: string) {
    this.timer = window.setInterval(() => void this.passo(), PASSO)
    this.stacca = iscrivitiRegistrazione(() => this.seguiRegistrazione())
  }

  /** A ogni modifica fatta da chi scrive, non da chi sincronizza. */
  toccata() {
    if (!this.attiva()) return
    const id = bloccoDi(this.view.state.selection.$head)
    if (id) this.toccate.set(id, Date.now())
  }

  chiudi() {
    window.clearInterval(this.timer)
    this.stacca()
  }

  private attiva() {
    const r = leggiRegistrazione()
    return r.attiva && r.avvio === 'ascolto' && !r.pausa && r.documentoId === this.documentoId
      && leggiImpostazioni().correzioniInDiretta && !leggiStatoCorrezioni().fermo
  }

  /** Quando la registrazione di questa pagina finisce, l'ultimo giro. */
  private seguiRegistrazione() {
    const r = leggiRegistrazione()
    if (r.attiva && r.id && r.documentoId === this.documentoId) this.registrazione = r.id
    else if (!r.attiva && this.registrazione) {
      const id = this.registrazione
      this.registrazione = null
      void this.ultimoGiro(id)
    }
  }

  /** Le righe da controllare, scritte da poco e cambiate dall'ultimo
   *  controllo. Durante la lezione solo quelle finite; a lezione finita
   *  tutte, perché non c'è più niente da aspettare. */
  private daControllare(tutte: boolean) {
    const adesso = Date.now()
    const cursore = bloccoDi(this.view.state.selection.$head)
    for (const [id, quando] of this.toccate) if (adesso - quando > RECENTE) this.toccate.delete(id)
    const pronte = [...this.toccate]
      .filter(([id, quando]) => tutte || id !== cursore || adesso - quando >= FERMA)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    if (!pronte.length) return []

    const testi = testiDi(this.view.state.doc, new Set(pronte))
    const righe: Array<{ id: string; testo: string }> = []
    for (const id of pronte) {
      const testo = testi.get(id)
      if (testo === undefined) { this.toccate.delete(id); continue }   // la riga non c'è più
      if (this.controllate.get(id) === testo) continue
      if (!meritaControllo(testo)) { this.controllate.set(id, testo); continue }
      righe.push({ id, testo })
      if (righe.length === PER_VOLTA) break
    }
    return righe
  }

  /** Il giro durante la lezione. `subito` salta l'attesa fra un
   *  controllo e l'altro (per i collaudi), non le altre regole. */
  async passo(subito = false) {
    if (this.inCorso || !this.attiva()) return
    if (!subito && Date.now() - this.ultimo < this.attesa) return
    const r = leggiRegistrazione()
    const voce = r.id ? mappaRegistrazioni(this.doc).get(r.id) : undefined
    if (!r.id || !voce) return
    await this.controlla(this.daControllare(false), voce, r.id, r.provvisorio, false)
  }

  /*  Fermata la registrazione, le ultime righe — scritte mentre il
   *  professore chiudeva, o subito dopo — non aspettano più il cursore:
   *  si controllano adesso, contro la fine della lezione. Senza, l'errore
   *  nell'ultima riga prima di «Ferma» non si vedrebbe mai. */
  private async ultimoGiro(id: string) {
    if (this.inCorso) { this.giroInSospeso = id; return }
    const voce = mappaRegistrazioni(this.doc).get(id)
    if (voce && leggiImpostazioni().correzioniInDiretta && !leggiStatoCorrezioni().fermo) {
      await this.controlla(this.daControllare(true), voce, id, '', true)
    }
    this.toccate.clear()
    this.controllate.clear()
  }

  private async controlla(
    righe: Array<{ id: string; testo: string }>, voce: Y.Map<unknown>, registrazione: string, provvisorio: string, ultimoGiro: boolean,
  ) {
    if (!righe.length) return
    const finestra = finestraDi(voce, provvisorio)
    if (finestra.parole < MIN_PAROLE) return

    this.inCorso = true
    this.ultimo = Date.now()
    righe.forEach((x) => this.controllate.set(x.id, x.testo))
    const etichettate = righe.map((x, i) => ({ ...x, etichetta: `B${i + 1}` }))
    try {
      const materia = materiaDi(this.documentoId)
      const esame = await sospette(finestra.testo, etichettate, materia)
      let costo = esame.costo
      let comparse = 0
      let proposte: Awaited<ReturnType<typeof proponi>>['proposte'] = []
      if (esame.sospette.length) {
        const risposta = await proponi(finestra.testo, esame.sospette, materia)
        proposte = risposta.proposte
        costo += risposta.costo
        for (const p of proposte) {
          const riga = etichettate.find((x) => x.etichetta === p.etichetta)
          if (!riga) continue
          const nuova = aggiungiCorrezione(this.doc, {
            blocco: riga.id, prima: p.prima, dopo: p.dopo, detto: p.detto, tipo: p.tipo,
            registrazione, t: Math.round(finestra.t),
          })
          if (nuova) comparse++
        }
      }
      this.attesa = INTERVALLO
      contaControllo(registrazione, { sospette: esame.sospette.length, proposte: comparse, costo })
      annota({
        quando: Date.now(),
        ultimoGiro,
        righe: etichettate.map((x) => `${x.etichetta}: ${x.testo}`),
        probabilita: esame.probabilita,
        proposte: proposte.map((p) => `${p.etichetta}: ${p.prima} → ${p.dopo} «${p.detto}»`),
        ms: Date.now() - this.ultimo,
      })
    } catch (e) {
      // non controllate davvero: si riprova più avanti
      righe.forEach((x) => this.controllate.delete(x.id))
      const messaggio = e instanceof Error ? e.message : String(e)
      if (e instanceof CreditoFinito || eCreditoFinito(0, messaggio)) {
        segnaIntoppo(registrazione, 'il credito di OpenRouter è finito', 'credito')
      } else {
        this.attesa = Math.min(this.attesa * 2, PAZIENZA_MAX)
        segnaIntoppo(registrazione, messaggio)
      }
    } finally {
      this.inCorso = false
      const sospeso = this.giroInSospeso
      this.giroInSospeso = null
      if (sospeso) void this.ultimoGiro(sospeso)
    }
  }
}
