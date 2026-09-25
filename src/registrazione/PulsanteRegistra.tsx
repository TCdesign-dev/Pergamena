import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RifEditore } from '../editor/Editor'
import { iscrivitiRegistrazione, leggiRegistrazione, type StatoRegistrazione } from './statoRegistrazione'
import {
  avviaRegistrazione, collegaEditore, fermaRegistrazione, pausaRegistrazione, riprendiRegistrazione,
} from './registrazione'
import { leggiImpostazioni } from '../impostazioni'
import { corrisponde, scrittaDiComando } from '../tastiera/scorciatoie'
import { Icona } from '../lib/Icona'
import s from './PulsanteRegistra.module.css'
import { tr } from '../lingua/lingua'

/*  Il controllo della registrazione, nella barra in alto: sempre nello
 *  stesso posto, cambia forma con lo stato.
 *
 *   · pronta: «Registra ⌘R»;
 *   · mentre parte o chiude: una rotellina e due parole;
 *   · in registrazione: una pillola rossa col cronometro, il livello,
 *     pausa e termina. Termina è un pulsante a sé: un clic distratto
 *     sulla pillola non chiude la lezione;
 *   · in pausa: grigia, il cronometro fermo, «Riprendi»;
 *   · collegamento perso o microfono muto: arancio, e registra ancora;
 *   · in un'altra finestra o in un'altra pagina: grigia, qui non si registra;
 *   · interrotta: rossa, finché non si riprende o si chiude l'avviso.
 *
 *  Cosa c'è da sapere, e da fare, lo dice l'avviso sotto la barra. */

export function durata(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export type Forma =
  | 'pronta' | 'parto' | 'chiudo'
  | 'registra' | 'pausa' | 'perso' | 'muto'
  | 'finestra' | 'pagina' | 'interrotta'

/** La forma del controllo nella pagina `documentoId`. */
export function formaDi(r: StatoRegistrazione, documentoId: string): Forma {
  if (r.attiva && r.documentoId !== documentoId) return 'pagina'
  if (r.attiva) {
    if (r.avvio === 'parto') return 'parto'
    if (r.avvio === 'chiudo') return 'chiudo'
    if (r.scollegato) return 'perso'
    if (r.pausa) return 'pausa'
    if (r.silenzio) return 'muto'
    return 'registra'
  }
  if (r.altrove) return 'finestra'
  if (r.errore && r.documentoId === documentoId) return 'interrotta'
  return 'pronta'
}

// finché la prima partenza non ha risposto, una seconda (doppio clic,
// ⌘R tenuto giù) aprirebbe due registrazioni
let partendo = false

/** Registra la pagina: dal pulsante, da ⌘R, da «Riprendi» dopo un errore. */
export async function registra(documentoId: string, materia: string, rifEditore: RifEditore) {
  if (partendo) return
  partendo = true
  try {
    await avviaRegistrazione({
      documentoId,
      materia,
      editor: () => rifEditore.current,
      salvaAudio: leggiImpostazioni().salvaAudio,
    })
  } finally {
    partendo = false
  }
}

// il livello diventa quattro tacche: -60 dB silenzio, -20 dB voce piena
const SOGLIE = [0.1, 0.35, 0.6, 0.85]

export function PulsanteRegistra({ documentoId, materia, rifEditore }: {
  documentoId: string
  materia: string
  rifEditore: RifEditore
}) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  const forma = formaDi(r, documentoId)
  const [ora, setOra] = useState(Date.now())

  // chi riprende una registrazione dopo un ricaricamento deve trovare l'editor
  useEffect(() => collegaEditore(documentoId, () => rifEditore.current), [documentoId, rifEditore])

  useEffect(() => {
    if (r.avvio !== 'ascolto' || r.pausa) return
    const t = setInterval(() => setOra(Date.now()), 500)
    return () => clearInterval(t)
  }, [r.avvio, r.pausa])

  // ⌘R registra la pagina aperta. Mentre una lezione è in corso non fa
  // niente: nemmeno ricaricare la pagina, che è quello che farebbe di suo
  const rifForma = useRef(forma)
  rifForma.current = forma
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (!corrisponde('registra', e)) return
      e.preventDefault()
      if (e.repeat) return
      if (rifForma.current === 'pronta' || rifForma.current === 'interrotta') void registra(documentoId, materia, rifEditore)
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [documentoId, materia, rifEditore])

  switch (forma) {
    case 'pronta':
      return (
        <button
          className={s.registra}
          title={tr('Registra la lezione e trascrivila sul Mac  {tasti}', { tasti: scrittaDiComando('registra') })}
          onClick={() => void registra(documentoId, materia, rifEditore)}
        >
          <span className={s.pallino} />
          Registra
          <kbd className={s.tasto}>{scrittaDiComando('registra')}</kbd>
        </button>
      )
    case 'parto':
    case 'chiudo':
      return (
        <span className={s.stato}>
          <Icona nome="attesa" dimensione={14} className={s.gira} />
          {forma === 'parto' ? tr('Preparo il microfono…') : tr('Chiudo la lezione…')}
        </span>
      )
    case 'finestra':
      return (
        <span className={`${s.stato} ${s.grigio}`}>
          <Icona nome="altra-finestra" dimensione={14} />
          In un’altra finestra
        </span>
      )
    case 'pagina':
      return (
        <span className={`${s.stato} ${s.grigio}`} title={tr('La lezione si sta registrando in un’altra pagina')}>
          <span className={`${s.pallino} ${s.acceso}`} />
          In un’altra pagina
        </span>
      )
    case 'interrotta':
      return (
        <span className={`${s.stato} ${s.rosso}`}>
          <Icona nome="errore" dimensione={14} />
          Interrotta
        </span>
      )
  }

  const forza = Math.min(1, Math.max(0, (r.livello + 60) / 40))
  // il cronometro conta la lezione registrata, non le pause
  const adesso = r.pausa && r.pausaDa ? r.pausaDa : ora
  const trascorso = adesso - (r.inizio ?? adesso) - r.pausaTotale
  const tono = forma === 'registra' ? s.rossa : forma === 'pausa' ? s.grigia : s.arancio

  return (
    <div className={`${s.pillola} ${tono}`} role="group" aria-label={tr('Lezione in registrazione')}>
      {forma === 'registra' && <span className={`${s.pallino} ${s.acceso}`} />}
      {forma === 'pausa' && <Icona nome="pausa" dimensione={14} />}
      {forma === 'perso' && <Icona nome="scollegato" dimensione={14} />}
      {forma === 'muto' && <Icona nome="microfono-muto" dimensione={14} />}
      <span className={s.tempo}>{durata(trascorso)}</span>
      {forma === 'registra' && (
        <span className={s.tacche} aria-hidden>
          {SOGLIE.map((soglia) => <i key={soglia} className={forza > soglia ? s.accesa : undefined} />)}
        </span>
      )}
      {r.pausa ? (
        <button className={s.riprendi} title={tr('Riprendi a registrare')} onClick={() => void riprendiRegistrazione()}>
          <Icona nome="registra" dimensione={12} />
          Riprendi
        </button>
      ) : (
        <button
          className={s.icona}
          title={tr('Pausa: il microfono non registra finché non riprendi')}
          aria-label={tr('Pausa')}
          onClick={() => void pausaRegistrazione()}
        >
          <Icona nome="pausa" dimensione={14} />
        </button>
      )}
      <button className={s.icona} title={tr('Termina la lezione')} aria-label={tr('Termina la lezione')} onClick={() => void fermaRegistrazione()}>
        <Icona nome="termina" dimensione={14} />
      </button>
    </div>
  )
}
