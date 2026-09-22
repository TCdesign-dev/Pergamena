import type { Node as NodoPM } from '@tiptap/pm/model'
import { nucleo, pezzi } from './confronto'
import type { Correzione } from './tipi'

/*  Dove sta una correzione negli appunti, adesso. Il testo intanto può
 *  essere cambiato: la si ritrova dal blocco e dal pezzo esatto, e se
 *  il pezzo non c'è più (l'hai riscritto, o corretto da te) non si
 *  vede più. Nessuna posizione salvata, quindi niente da tenere
 *  allineato mentre scrivi. */

export type Posto = {
  from: number               // il pezzo da sostituire
  to: number
  sostituto: string
  sottolinea: [number, number] // cosa sottolineare: il pezzo, o la parola prima se è un'aggiunta
}

/** Il testo di un blocco e, per ogni carattere, la sua posizione nel documento. */
function testoConPosizioni(nodo: NodoPM, pos: number) {
  let testo = ''
  const posizioni: number[] = []
  nodo.forEach((figlio, scarto) => {
    if (!figlio.isText || !figlio.text) return
    for (let i = 0; i < figlio.text.length; i++) posizioni.push(pos + 1 + scarto + i)
    testo += figlio.text
  })
  return { testo, posizioni }
}

export function postoNelBlocco(nodo: NodoPM, pos: number, c: Correzione): Posto | null {
  const { testo, posizioni } = testoConPosizioni(nodo, pos)
  // l'hai già scritto giusto da te
  if (!c.prima.includes(c.dopo) && testo.includes(c.dopo)) return null
  const i = testo.indexOf(c.prima)
  if (i < 0) return null

  const { da, a, sostituto } = nucleo(c.prima, c.dopo)
  const inizio = i + da
  const fine = i + a
  const from = inizio < testo.length ? posizioni[inizio] : posizioni[testo.length - 1] + 1
  const to = fine > inizio ? posizioni[fine - 1] + 1 : from
  // il pezzo attraversa una formula o un'immagine: meglio non toccarlo
  if (to - from !== fine - inizio) return null

  // un'aggiunta pura («nel» → «nel 1760») non ha niente da sottolineare:
  // si sottolinea la parola prima, o quella dopo se è in testa
  let s = inizio
  let e = fine
  if (fine === inizio) {
    const avanti = pezzi(c.prima.slice(0, da))
    const spazi = avanti.length && !avanti[avanti.length - 1].trim() ? avanti.pop()!.length : 0
    const parola = avanti.pop()
    if (parola) { e = inizio - spazi; s = e - parola.length }
    else e = inizio + (pezzi(c.prima.slice(a)).find((p) => p.trim())?.length ?? 1)
  }
  e = Math.min(Math.max(e, s + 1), testo.length)
  if (s >= e) return null
  return { from, to, sostituto, sottolinea: [posizioni[s], posizioni[e - 1] + 1] }
}

/** Lo stesso, cercando il blocco in tutto il documento. */
export function trovaCorrezione(doc: NodoPM, c: Correzione): Posto | null {
  let trovato: Posto | null = null
  doc.descendants((nodo, pos) => {
    if (trovato) return false
    if (!nodo.isTextblock) return true
    if (nodo.attrs.idBlocco === c.blocco) trovato = postoNelBlocco(nodo, pos, c)
    return false
  })
  return trovato
}
