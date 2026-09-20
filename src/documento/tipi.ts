import type { Colore } from '../stili/colori'

/** Un quaderno è una materia. */
export type Quaderno = {
  id: string
  nome: string
  colore: Colore
  creato: number
}

/** Un documento è un canvas verticale continuo: può contenere
 *  molte lezioni e molti argomenti, non uno solo. */
export type Documento = {
  id: string
  quadernoId: string
  titolo: string
  creato: number
  modificato: number
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
