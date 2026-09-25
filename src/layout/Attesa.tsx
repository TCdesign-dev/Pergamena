import s from './Attesa.module.css'
import { tr } from '../lingua/lingua'

/*  I segni dell'attesa, uguali in tutta l'app.
 *
 *  Tre soli, ognuno per un caso:
 *   · la rotellina accanto a una parola, quando si aspetta una cosa
 *     breve («Cerco…», «Salvo…»);
 *   · la barra che scorre, quando il lavoro è lungo e non si sa quanto
 *     (il merge: da 4 a 30 secondi);
 *   · le tessere che luccicano al posto di ciò che sta arrivando, così
 *     lo spazio non salta quando arriva davvero. */

export function Rotella() {
  return <span className={s.rotella} aria-hidden />
}

export function Barra() {
  return <span className={s.barra} role="progressbar" aria-label={tr('In corso')} />
}

export function Tessere({ quante, classe }: { quante: number; classe?: string }) {
  return (
    <>
      {Array.from({ length: quante }, (_, i) => (
        <span
          key={i}
          className={`${s.tessera} ${classe ?? ''}`}
          style={{ animationDelay: `${i * 70}ms` }}
          aria-hidden
        />
      ))}
    </>
  )
}
