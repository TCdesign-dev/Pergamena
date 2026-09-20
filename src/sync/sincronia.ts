import * as Y from 'yjs'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './cliente'
import { segnala } from './statoSync'

/*  Sincronizzazione di un documento Yjs attraverso Supabase.
 *
 *  Il modello remoto è un semplice registro di aggiornamenti: ogni
 *  riga è un pezzo di storia, e Yjs sa rimetterli insieme in
 *  qualunque ordine arrivino. È questo che rende la modifica offline
 *  un non-problema: al ritorno della connessione si spingono le righe
 *  mancanti e basta, senza conflitti da risolvere a mano.
 *
 *  Due accorgimenti che contano:
 *
 *  · si accumula e si unisce prima di spedire. Senza, ogni battuta
 *    diventerebbe una riga, e una lezione da un'ora ne produrrebbe
 *    decine di migliaia.
 *
 *  · si compatta quando le righe crescono troppo, ma solo dopo aver
 *    letto TUTTO: si cancella soltanto al di sotto dell'id che si è
 *    davvero visto, così una riga arrivata nel frattempo da un altro
 *    dispositivo ha un id più alto e sopravvive. */

const ATTESA_INVIO = 1500          // ms di quiete prima di spedire
const RIPROVA = 10_000             // ms fra due tentativi quando si è offline
const SOGLIA_COMPATTAZIONE = 300   // righe oltre le quali si riassume

function aBase64(u: Uint8Array) {
  let s = ''
  const passo = 0x8000
  for (let i = 0; i < u.length; i += passo) {
    s += String.fromCharCode(...u.subarray(i, i + passo))
  }
  return btoa(s)
}

function daBase64(s: string) {
  const grezzo = atob(s)
  const u = new Uint8Array(grezzo.length)
  for (let i = 0; i < grezzo.length; i++) u[i] = grezzo.charCodeAt(i)
  return u
}

export class Sincronia {
  private coda: Uint8Array[] = []
  private attesa?: number
  private battito?: number
  private canale: RealtimeChannel | null = null
  private maxId = 0
  private viva = false

  constructor(
    private readonly stanza: string,
    private readonly doc: Y.Doc,
  ) {}

  private alCambio = (aggiornamento: Uint8Array, origine: unknown) => {
    if (origine === this) return      // arriva da remoto: non rimandarlo indietro
    this.coda.push(aggiornamento)
    this.programma()
  }

  async avvia() {
    if (!supabase || this.viva) return
    this.viva = true
    segnala('collego')

    try {
      await this.allinea()
      this.doc.on('update', this.alCambio)
      this.ascolta()
      this.battito = window.setInterval(() => void this.spedisci(), RIPROVA)
      segnala('allineato')
    } catch (e) {
      this.viva = false
      segnala('offline', e instanceof Error ? e.message : 'connessione fallita')
    }
  }

  ferma() {
    if (!this.viva) return
    this.viva = false
    this.doc.off('update', this.alCambio)
    window.clearTimeout(this.attesa)
    window.clearInterval(this.battito)
    void this.canale?.unsubscribe()
    this.canale = null
  }

  /** Scarica quello che manca, poi spedisce quello che il server non ha. */
  private async allinea() {
    const righe = await this.leggiDa(0)

    // si ricostruisce lo stato REMOTO a parte: serve a sapere con
    // esattezza cosa il server non ha ancora, invece di rispedire tutto
    const remoto = new Y.Doc()
    for (const r of righe) {
      Y.applyUpdate(remoto, daBase64(r.dati))
      this.maxId = Math.max(this.maxId, r.id)
    }

    if (righe.length) Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(remoto), this)

    const soloLocale = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(remoto))
    remoto.destroy()

    if (soloLocale.length > 2) {
      this.coda.push(soloLocale)
      await this.spedisci()
    }

    if (righe.length > SOGLIA_COMPATTAZIONE) await this.compatta()
  }

  private async leggiDa(id: number) {
    const { data, error } = await supabase!
      .from('aggiornamenti')
      .select('id, dati')
      .eq('stanza', this.stanza)
      .gt('id', id)
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []) as Array<{ id: number; dati: string }>
  }

  private ascolta() {
    this.canale = supabase!
      .channel(`stanza:${this.stanza}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'aggiornamenti', filter: `stanza=eq.${this.stanza}` },
        (evento) => {
          const riga = evento.new as { id: number; dati: string }
          if (riga.id <= this.maxId) return
          this.maxId = riga.id
          Y.applyUpdate(this.doc, daBase64(riga.dati), this)
        },
      )
      .subscribe()
  }

  private programma() {
    window.clearTimeout(this.attesa)
    this.attesa = window.setTimeout(() => void this.spedisci(), ATTESA_INVIO)
  }

  private async spedisci() {
    if (!supabase || !this.coda.length) return
    const unito = Y.mergeUpdates(this.coda)
    this.coda = []
    segnala('invio')

    const { error } = await supabase.from('aggiornamenti').insert({
      stanza: this.stanza,
      dati: aBase64(unito),
    })

    if (error) {
      // non si perde niente: torna in coda e il battito riproverà
      this.coda.unshift(unito)
      segnala('offline', error.message)
      return
    }
    segnala('allineato')
  }

  /** Riassume la storia in una riga sola e butta le precedenti. */
  private async compatta() {
    const righe = await this.leggiDa(0)
    if (righe.length <= SOGLIA_COMPATTAZIONE) return

    const fino = Math.max(...righe.map((r) => r.id))
    const riassunto = Y.encodeStateAsUpdate(this.doc)

    const { error } = await supabase!
      .from('aggiornamenti')
      .insert({ stanza: this.stanza, dati: aBase64(riassunto) })
    if (error) return

    // solo al di sotto di `fino`: ciò che è arrivato nel frattempo
    // ha un id più alto e resta dov'è
    await supabase!.from('aggiornamenti').delete().eq('stanza', this.stanza).lte('id', fino)
  }
}

/* ── registro delle stanze ──────────────────────────────────────────
 *  L'archivio annuncia qui ogni documento che apre. La sincronia si
 *  accende quando entri e si spegne quando esci, senza che l'archivio
 *  debba sapere niente di Supabase. */

const stanze = new Map<string, { doc: Y.Doc; sinc?: Sincronia }>()
let accesa = false

export const stanzaRegistrata = (stanza: string) => stanze.has(stanza)

export function registraStanza(stanza: string, doc: Y.Doc) {
  if (stanze.has(stanza)) return
  stanze.set(stanza, { doc })
  if (accesa) avviaStanza(stanza)
}

export function dimenticaStanza(stanza: string) {
  stanze.get(stanza)?.sinc?.ferma()
  stanze.delete(stanza)
}

function avviaStanza(stanza: string) {
  const voce = stanze.get(stanza)
  if (!voce || voce.sinc) return
  voce.sinc = new Sincronia(stanza, voce.doc)
  void voce.sinc.avvia()
}

export function accendiSincronia() {
  accesa = true
  stanze.forEach((_v, stanza) => avviaStanza(stanza))
}

export function spegniSincronia() {
  accesa = false
  stanze.forEach((v) => {
    v.sinc?.ferma()
    v.sinc = undefined
  })
  segnala('spento')
}
