import { useEffect, useState, type PointerEvent as PointerReact } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { urlDi } from '../../immagini/deposito'
import s from './NodoImmagine.module.css'

const ALLINEAMENTI = [
  { chiave: 'piena', segno: '▭', titolo: 'Larghezza piena' },
  { chiave: 'sinistra', segno: '◧', titolo: 'A sinistra, il testo le scorre accanto' },
  { chiave: 'destra', segno: '◨', titolo: 'A destra, il testo le scorre accanto' },
] as const

export function NodoImmagine({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { idLocale, url, didascalia, attribuzione, larghezza, allineamento } = node.attrs as {
    idLocale: string | null
    url: string | null
    didascalia: string
    attribuzione: string
    larghezza: number
    allineamento: 'piena' | 'sinistra' | 'destra'
  }

  const [src, setSrc] = useState<string | null>(url)

  useEffect(() => {
    if (!idLocale) return
    let vivo = true
    urlDi(idLocale).then((u) => { if (vivo && u) setSrc(u) })
    return () => { vivo = false }
  }, [idLocale])

  /*  La larghezza è una PERCENTUALE della colonna, non un numero di
   *  pixel: così l'immagine resta proporzionata se un giorno cambi la
   *  larghezza della colonna di scrittura o esporti in PDF. */
  function ridimensiona(e: PointerReact<HTMLSpanElement>) {
    e.preventDefault()
    e.stopPropagation()
    const colonna = editor.view.dom.clientWidth
    if (!colonna) return

    const partenza = e.clientX
    const inizio = larghezza
    const verso = allineamento === 'destra' ? -1 : 1

    const muovi = (ev: PointerEvent) => {
      const delta = (((ev.clientX - partenza) * verso) / colonna) * 100
      updateAttributes({ larghezza: Math.round(Math.min(100, Math.max(20, inizio + delta))) })
    }
    const finisci = () => {
      window.removeEventListener('pointermove', muovi)
      window.removeEventListener('pointerup', finisci)
    }
    window.addEventListener('pointermove', muovi)
    window.addEventListener('pointerup', finisci)
  }

  return (
    <NodeViewWrapper
      as="figure"
      className={`${s.figura} ${s[allineamento]} ${selected ? s.scelta : ''}`}
      style={{ width: `${larghezza}%` }}
      data-allineamento={allineamento}
    >
      <div className={s.cornice}>
        {src ? (
          <img className={s.immagine} src={src} alt={didascalia} draggable={false} />
        ) : (
          <div className={s.assente}>immagine non trovata nel deposito</div>
        )}

        {editor.isEditable && (
          <>
            <span className={s.maniglia} onPointerDown={ridimensiona} title="Trascina per ridimensionare" />
            <div className={s.comandi} contentEditable={false}>
              {ALLINEAMENTI.map((a) => (
                <button
                  key={a.chiave}
                  title={a.titolo}
                  className={allineamento === a.chiave ? s.attivo : undefined}
                  onClick={() => updateAttributes({ allineamento: a.chiave })}
                >
                  {a.segno}
                </button>
              ))}
              <button title="Larghezza originale" onClick={() => updateAttributes({ larghezza: 100 })}>
                ⤢
              </button>
            </div>
          </>
        )}
      </div>

      {(didascalia || attribuzione) && (
        <figcaption className={s.didascalia}>
          {didascalia}
          {attribuzione && <span className={s.credito}>{attribuzione}</span>}
        </figcaption>
      )}
    </NodeViewWrapper>
  )
}
