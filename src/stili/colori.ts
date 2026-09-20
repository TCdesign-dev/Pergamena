/*  La tavolozza, in un posto solo.
 *
 *  La usano sia il colore del testo sia il pallino delle materie.
 *  Si salva sempre il NOME (`rosso`), mai il codice esadecimale: un
 *  `#c02626` salvato oggi sarebbe illeggibile in tema scuro, e
 *  resterebbe sbagliato per sempre dentro gli appunti. Il colore
 *  vero lo decide il tema, in `token.css`. */

export const COLORI = ['rosso', 'arancio', 'verde', 'blu', 'viola'] as const
export type Colore = (typeof COLORI)[number]

export const ETICHETTE: Record<Colore, string> = {
  rosso: 'Rosso',
  arancio: 'Arancio',
  verde: 'Verde',
  blu: 'Blu',
  viola: 'Viola',
}
