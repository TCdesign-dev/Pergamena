/*  Pergamena è scritta in italiano, e le frasi stanno dentro il codice
 *  come le ha scritte chi l'ha fatta. Tradurla vuol dire affiancare a
 *  ogni frase la stessa frase in un'altra lingua, dentro un file di
 *  `lingue/`: la chiave è l'italiano, il valore la traduzione.
 *
 *  Da questa scelta discendono due cose. Se una traduzione manca
 *  compare l'italiano, quindi l'app non resta mai con un buco al posto
 *  di un pulsante e una lingua si può consegnare a metà. E chi traduce
 *  lavora su frasi intere, non su sigle: non deve aprire il codice per
 *  capire cosa sta traducendo.
 *
 *  Le lingue non sono elencate da nessuna parte: si contano i file in
 *  `lingue/`. Aggiungerne una vuol dire aggiungere un file, e nient'altro. */

import { imposta, leggiImpostazioni } from '../impostazioni'

/** Il blocco `_` in testa a ogni file: quello che la lingua dice di sé. */
export type Scheda = {
  /** come si chiama questa lingua in questa lingua: «English», «Español» */
  nome: string
  /** per date, ore e numeri: «en-GB» */
  locale: string
  /** la lingua in cui ascoltare, se diversa da quella delle date: «en-US» */
  ascolto?: string
  /** la riga che dice al modello in che lingua rispondere:
   *  «Answer in English, and address the reader as "you".» */
  modello?: string
  /** chi l'ha tradotta, per i ringraziamenti */
  tradotta?: string
}

export type Lingua = Scheda & { codice: string }

const ITALIANO: Lingua = {
  codice: 'it',
  nome: 'Italiano',
  locale: 'it-IT',
  ascolto: 'it-IT',
  modello: 'Rispondi in italiano, e dai del tu.',
}

/*  Due sguardi sugli stessi file: le schede servono subito tutte
 *  insieme (il menu delle lingue), i dizionari uno solo alla volta e
 *  solo quello scelto — sono la parte pesante. */
const SCHEDE = import.meta.glob<Scheda>('/lingue/*.json', { eager: true, import: '_' })
const DIZIONARI = import.meta.glob<Record<string, string>>('/lingue/*.json', { import: 'default' })

const codiceDi = (via: string) => via.slice(via.lastIndexOf('/') + 1).replace(/\.json$/, '')

/** Le lingue installate: l'italiano, più un file per ognuna delle altre. */
export function lingue(): Lingua[] {
  const altre = Object.entries(SCHEDE)
    .filter(([, s]) => s?.nome && s?.locale)
    .map(([via, s]) => ({ ...s, codice: codiceDi(via) }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
  return [ITALIANO, ...altre]
}

let corrente: Lingua = ITALIANO
let dizionario: Record<string, string> = {}

export const linguaCorrente = () => corrente
/** Il locale da dare a `toLocaleDateString` e compagnia. */
export const locale = () => corrente.locale

/*  Quando il modello parla allo studente — le risposte alle domande, i
 *  quiz, il punto della situazione — deve parlargli nella sua lingua.
 *  Quando invece scrive dentro gli appunti, no: lì segue la lingua
 *  degli appunti, che può essere un'altra (un corso in inglese, un
 *  quaderno in italiano). Per questo la riga si aggiunge a mano dove
 *  serve, invece di finire in tutte le richieste. */
export const comeRispondere = () => corrente.modello ?? `Rispondi in ${corrente.nome}.`

/*  Quale lingua mostrare: quella scelta nelle impostazioni; se non è
 *  stata scelta, la prima delle lingue del browser che esiste anche
 *  qui; altrimenti l'italiano. */
function daMostrare(): string {
  const installate = lingue().map((l) => l.codice)
  const voluta = leggiImpostazioni().lingua
  if (voluta) return installate.includes(voluta) ? voluta : 'it'
  for (const l of navigator.languages ?? []) {
    const c = l.toLowerCase().split('-')[0]
    if (installate.includes(c)) return c
  }
  return 'it'
}

/** Carica il dizionario. Va chiamata una volta prima di disegnare. */
export async function caricaLingua(codice = daMostrare()) {
  const scelta = lingue().find((l) => l.codice === codice)
  if (!scelta) return
  const file = DIZIONARI[`/lingue/${codice}.json`]
  const voci = codice === 'it' || !file ? {} : { ...(await file()) }
  delete voci._
  dizionario = voci
  corrente = scelta
  document.documentElement.lang = codice
}

/*  Cambiare lingua ricarica la pagina. Sembra brusco, ma le frasi
 *  stanno anche in tabelle che si leggono una volta sola — i nomi dei
 *  blocchi, le scorciatoie, i temi — e ricaricare è l'unico modo per
 *  cui non ne resti mezza in italiano. Gli appunti non rischiano
 *  niente: sono già su questo computer. */
export function cambiaLingua(codice: string | null) {
  imposta('lingua', codice)
  location.reload()
}

/*  ── le frasi ──────────────────────────────────────────────────────
 *
 *  `tr('Chiudi')` è la forma normale. Dentro la frase, `{nome}` è un
 *  buco da riempire: `tr('{n} pagine', { n: 3 })`.
 *
 *  Il plurale si scrive con la barra, tutte le forme nella stessa
 *  riga: `tr('{n} pagina | {n} pagine', { n })`. L'italiano ne vuole
 *  due, l'inglese due, il polacco quattro — il numero di forme lo
 *  decide la lingua d'arrivo, e si scrivono nell'ordine in cui le
 *  elenca l'Unicode: zero, uno, due, poche, molte, altro. */

const BUCHI = /\{(\w+)\}/g
const ORDINE = ['zero', 'one', 'two', 'few', 'many', 'other']

/** La frase tradotta e con la forma giusta, ma ancora coi buchi aperti. */
export function voce(frase: string, n?: unknown): string {
  const tradotta = dizionario[frase] ?? frase
  if (!tradotta.includes('|')) return tradotta
  const forme = tradotta.split('|').map((f) => f.trim())
  if (typeof n !== 'number') return forme[forme.length - 1]
  //  se la traduzione manca, la frase è ancora italiana: vanno usate
  //  le regole dell'italiano, non quelle della lingua scelta
  const regole = new Intl.PluralRules(dizionario[frase] ? corrente.locale : 'it-IT')
  const usate = ORDINE.filter((c) => (regole.resolvedOptions().pluralCategories as string[]).includes(c))
  return forme[usate.indexOf(regole.select(n))] ?? forme[forme.length - 1]
}

export function tr(frase: string, valori?: Record<string, string | number>): string {
  const testo = voce(frase, valori?.n)
  if (!valori) return testo
  return testo.replace(BUCHI, (intero, chiave: string) => (chiave in valori ? String(valori[chiave]) : intero))
}
