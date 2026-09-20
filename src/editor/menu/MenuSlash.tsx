import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { iscrivitiSlash, leggiSlash, scegliSlash } from './statoSlash'
import s from './MenuSlash.module.css'

const LARGHEZZA = 244
const MARGINE = 8

export function MenuSlash() {
  const stato = useSyncExternalStore(iscrivitiSlash, leggiSlash)
  const rifLista = useRef<HTMLDivElement>(null)
  const [posizione, setPosizione] = useState<{ left: number; top: number } | null>(null)

  const { aperto, voci, indice, rect } = stato

  // si posiziona sotto al cursore, e sopra se sotto non ci sta
  useLayoutEffect(() => {
    if (!aperto || !rect) { setPosizione(null); return }
    const alto = Math.min(voci.length, 7) * 30 + 10
    const sotto = rect.bottom + MARGINE
    const staSotto = sotto + alto < window.innerHeight - MARGINE
    setPosizione({
      left: Math.min(rect.left, window.innerWidth - LARGHEZZA - MARGINE),
      top: staSotto ? sotto : Math.max(MARGINE, rect.top - alto - MARGINE),
    })
  }, [aperto, rect, voci.length])

  // la voce scelta resta sempre visibile mentre scorri con le frecce
  useEffect(() => {
    rifLista.current?.querySelector('[data-scelta]')?.scrollIntoView({ block: 'nearest' })
  }, [indice, aperto])

  if (!aperto || voci.length === 0 || !posizione) return null

  return (
    <div
      ref={rifLista}
      className={s.pannello}
      style={{ left: posizione.left, top: posizione.top, width: LARGHEZZA }}
      // il fuoco non deve mai lasciare l'editor
      onMouseDown={(e) => e.preventDefault()}
    >
      {voci.map((v, i) => (
        <button
          key={v.chiave}
          className={`${s.voce} ${i === indice ? s.scelta : ''}`}
          data-scelta={i === indice ? '' : undefined}
          onClick={() => scegliSlash(i)}
        >
          <span className={s.icona}>{v.icona}</span>
          <span className={s.nome}>{v.nome}</span>
          {v.suggerimento && <span className={s.suggerimento}>{v.suggerimento}</span>}
        </button>
      ))}
    </div>
  )
}
