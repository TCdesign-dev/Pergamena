/*  Un commento è una nota tua su un pezzo di testo tuo.
 *
 *  Vive nel documento Yjs della pagina, come le lezioni e le immagini
 *  consigliate: si sincronizza da solo, si legge anche sul telefono e
 *  sparisce insieme alla pagina. Nel testo resta un segno con il suo
 *  id; qui c'è tutto il resto.
 *
 *  `citazione` è il pezzo di testo com'era quando l'hai commentato:
 *  serve al pannello (per capire di cosa si parla senza andare a
 *  cercare) e serve se quel pezzo lo riscrivi. */

export type Commento = {
  id: string
  testo: string
  /** il pezzo commentato, come si leggeva allora */
  citazione: string
  /** l'id del blocco che lo contiene, per ritrovarlo */
  blocco: string | null
  quando: number
  /** l'ultima volta che l'hai riscritto */
  modificato?: number
}
