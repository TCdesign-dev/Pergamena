import type { Colore } from '../stili/colori'

/** Una prova d'esame: parziale, scritto, orale… */
export type Esame = {
  id: string
  nome: string
  data: string          // AAAA-MM-GG; stringa e non timestamp, perché un
                        // esame è un giorno, non un istante: niente fusi
  nota?: string         // «aula 3», «porta la calcolatrice»
}

export type Collegamento = { id: string; titolo: string; url: string }

/** Un quaderno è una materia.
 *
 *  I campi strutturati sono pochi e solo quelli che FANNO qualcosa:
 *  le date d'esame diventano un conto alla rovescia, l'email si apre,
 *  i link si aprono. Tutto il resto — programma, libri, regole — va
 *  nella scheda, che è una pagina di testo libero. */
export type Quaderno = {
  id: string
  nome: string
  colore: Colore
  creato: number
  copertinaId?: string   // immagine nel deposito, scelta da te
  esami?: Esame[]
  docente?: string
  email?: string
  ricevimento?: string
  collegamenti?: Collegamento[]
}

/** Un documento è un canvas verticale continuo: può contenere
 *  molte lezioni e molti argomenti, non uno solo. */
export type Documento = {
  id: string
  quadernoId: string
  titolo: string
  creato: number
  modificato: number
  /** La pagina con le note sulla materia. È un documento come gli altri
   *  — stesso editor, stessa sincronia, stessa ricerca, si cancella con
   *  la materia — ma non compare fra le pagine degli appunti. */
  scheda?: boolean
}

/** Un argomento NON è un contenitore: è un'ancora dentro un documento.
 *  Verrà popolato dalla fase 4, ma il tipo sta qui perché il resto
 *  del sistema ci si appoggia fin da subito. */
export type Argomento = {
  id: string
  documentoId: string
  quadernoId: string
  titolo: string
  idBloccoInizio: string
  idBloccoFine: string | null
  vistoLaVolta: number
  toccatoLaVolta: number
}
