import { useState, type ImgHTMLAttributes } from 'react'
import s from './Attesa.module.css'

/*  Un'immagine che arriva dalla rete: finché non c'è, al suo posto
 *  passa un riflesso; quando c'è, compare in dissolvenza invece di
 *  spuntare a scatti riga per riga. Il riflesso si ferma appena
 *  l'immagine è arrivata: dodici tessere che luccicano per sempre
 *  dietro alle foto costerebbero batteria per niente. */
export function Miniatura({ className, onLoad, onError, ...resto }: ImgHTMLAttributes<HTMLImageElement>) {
  const [pronta, setPronta] = useState(false)
  return (
    <img
      {...resto}
      className={`${className ?? ''} ${pronta ? s.arrivata : s.inArrivo}`}
      onLoad={(e) => { setPronta(true); onLoad?.(e) }}
      onError={(e) => { setPronta(true); onError?.(e) }}
    />
  )
}
