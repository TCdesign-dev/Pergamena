import { Fragment, createElement, useSyncExternalStore, type ReactNode } from 'react'
import { iscrivitiLingua, linguaCorrente, voce } from './lingua'

/*  Certe frasi hanno dentro una parola in grassetto, un tasto, un
 *  pezzo di codice. Spezzarle in tre `tr()` le renderebbe intraducibili:
 *  in un'altra lingua le parole vanno in un altro ordine. Restano
 *  quindi una frase sola, con la marcatura dentro, e chi traduce la
 *  sposta dove serve:
 *
 *    <Tr frase="Si prende su <code>openrouter.ai/keys</code>." />
 *
 *  Valgono <b>, <i>, <code>, <kbd> e <br>, senza annidarli. Per
 *  infilare qualcosa che non è testo — un'icona, un pulsante — si
 *  lascia un buco e lo si riempie:
 *
 *    <Tr frase="Premi {tasto} per tornare." valori={{ tasto: <kbd>esc</kbd> }} /> */

const PEZZI = /<(b|i|code|kbd)>([\s\S]*?)<\/\1>|<br\s*\/?>|\{(\w+)\}/g

export function Tr({ frase, valori, n }: {
  frase: string
  valori?: Record<string, ReactNode>
  /** il numero che decide singolare o plurale, se la frase ne ha due */
  n?: number
}) {
  const testo = voce(frase, n ?? (typeof valori?.n === 'number' ? valori.n : undefined))
  const fuori: ReactNode[] = []
  let ultimo = 0
  for (let p; (p = PEZZI.exec(testo)) !== null; ) {
    if (p.index > ultimo) fuori.push(testo.slice(ultimo, p.index))
    if (p[1]) fuori.push(createElement(p[1], { key: fuori.length }, p[2]))
    else if (p[3]) fuori.push(<Fragment key={fuori.length}>{valori?.[p[3]] ?? p[0]}</Fragment>)
    else fuori.push(<br key={fuori.length} />)
    ultimo = p.index + p[0].length
  }
  if (ultimo < testo.length) fuori.push(testo.slice(ultimo))
  return <>{fuori}</>
}

/** Il codice della lingua in corso: cambia quando si cambia lingua. */
export function useLingua() {
  return useSyncExternalStore(iscrivitiLingua, () => linguaCorrente().codice)
}
