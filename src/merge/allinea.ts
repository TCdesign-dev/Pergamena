import type { Segmento } from '../registrazione/tipi'

/*  Quale pezzo di lezione corrisponde a quale blocco degli appunti.
 *
 *  Per ogni parola detta dal professore si guarda dove stava il
 *  cursore in quel momento — con un ritardo: chi prende appunti
 *  scrive DOPO aver sentito, di solito qualche secondo dopo. Una frase
 *  detta al secondo 100 finisce negli appunti verso il secondo 104,
 *  quindi è lì che bisogna guardare. */

const RITARDO_DI_SCRITTURA = 4   // secondi

export type Tratto = { blocco: string | null; testo: string; inizio: number; fine: number }

export function allinea(segmenti: Segmento[], ancore: { t: number; blocco: string | null }[]): Tratto[] {
  const parole = segmenti.flatMap((s) =>
    s.parole.length ? s.parole : [[s.testo, s.inizio, s.fine] as [string, number, number]],
  )
  if (!parole.length) return []

  const ordinate = [...ancore].sort((a, b) => a.t - b.t)

  const bloccoAl = (t: number): string | null => {
    if (!ordinate.length) return null
    let scelta: string | null = ordinate[0].blocco
    for (const a of ordinate) {
      if (a.t <= t) scelta = a.blocco
      else break
    }
    return scelta
  }

  const tratti: Tratto[] = []
  for (const [testo, inizio, fine] of parole) {
    const blocco = bloccoAl(inizio + RITARDO_DI_SCRITTURA)
    const ultimo = tratti[tratti.length - 1]
    if (ultimo && ultimo.blocco === blocco) {
      ultimo.testo += ' ' + testo
      ultimo.fine = fine
    } else {
      tratti.push({ blocco, testo, inizio, fine })
    }
  }
  return tratti
}
