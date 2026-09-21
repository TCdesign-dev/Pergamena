/*  Una registrazione vive DENTRO al documento Yjs della pagina, in
 *  una mappa separata dal testo. Così si sincronizza da sola con il
 *  resto, si cancella insieme alla pagina, e l'editor non la vede.
 *
 *    doc.getMap('registrazioni')
 *      <id> → Y.Map {
 *        inizio, fine, audio
 *        avviato  : quando il microfono è partito davvero (ms)
 *        interrotta: true se si è fermata da sola (server riavviato)
 *        segmenti : Y.Array<Segmento>   ciò che ha detto il professore
 *        ancore   : Y.Array<Ancora>     dove eri negli appunti, e quando
 *        integrata: numero di proposte fatte dal merge, se fatto
 *      }
 */

/** [parola, inizio, fine] in secondi dall'inizio della registrazione. */
export type Parola = [string, number, number]

export type Segmento = {
  inizio: number
  fine: number
  testo: string
  parole: Parola[]
}

/*  L'àncora è il trucco che rende possibile il merge: ogni volta che
 *  il cursore passa a un altro blocco si annota «al secondo t stavo
 *  scrivendo qui». Così si sa quale pezzo di lezione corrisponde a
 *  quale pezzo di appunti, invece di doverlo indovinare. */
export type Ancora = { t: number; blocco: string }

export type Registrazione = {
  id: string
  inizio: number
  fine: number | null
  audio: boolean
  segmenti: Segmento[]
  ancore: Ancora[]
  integrata: number | null
  interrotta: boolean
}
