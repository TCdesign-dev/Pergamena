/*  Una correzione in diretta: un pezzo degli appunti che non torna con
 *  quello che il professore ha appena detto.
 *
 *  Vive nel documento Yjs della pagina, in una mappa sua accanto al
 *  testo (`doc.getMap('correzioni')`), come le registrazioni: si
 *  sincronizza e si cancella con la pagina, e quelle a cui non hai
 *  risposto in classe le ritrovi quando riapri gli appunti.
 *
 *  Non tocca mai il testo da sola. Si aggancia al blocco (`blocco`) e
 *  al pezzo esatto da cambiare (`prima`): se nel frattempo riscrivi
 *  quel pezzo, la correzione smette semplicemente di vedersi. */

export type TipoCorrezione = 'data' | 'numero' | 'nome' | 'mancante'
export type StatoCorrezione = 'proposta' | 'accettata' | 'ignorata'

export type Correzione = {
  id: string
  blocco: string               // idBlocco della riga degli appunti
  prima: string                // il pezzo degli appunti, carattere per carattere
  dopo: string                 // come dovrebbe diventare
  detto: string                // le parole del professore che lo dicono
  tipo: TipoCorrezione
  registrazione: string | null // la lezione in cui l'ha detto
  t: number | null             // secondi dall'inizio della registrazione
  quando: number               // ms, quando è stata trovata
  stato: StatoCorrezione
}
