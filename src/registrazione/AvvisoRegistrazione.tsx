import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { iscrivitiRegistrazione, leggiRegistrazione, azzera, type StatoRegistrazione } from './statoRegistrazione'
import { prendiQui } from './registrazione'
import { Icona, type NomeIcona } from '../lib/Icona'
import s from './AvvisoRegistrazione.module.css'

/*  L'avviso della registrazione: una fascia subito sotto la barra in
 *  alto, SOPRA il margine del foglio. Non spinge niente: il testo resta
 *  dov'è mentre scrivi. Uno per volta, il più grave: interrotta >
 *  microfono muto > collegamento perso > in un'altra finestra >
 *  ricollegato, che se ne va da solo dopo 3 secondi. */

type Avviso = {
  tono: 'rosso' | 'arancio' | 'grigio' | 'verde'
  icona: NomeIcona
  testo: string
  /** al passaggio del mouse */
  spiega?: string
  azione?: { etichetta: string; fai: () => void }
  chiudi?: () => void
}

const RIPRESO = 3000

export function AvvisoRegistrazione({ documentoId, onRiprendi, onCambiaMicrofono }: {
  documentoId: string
  /** dopo un'interruzione: registra di nuovo, in questa pagina */
  onRiprendi: () => void
  /** il microfono non sente: apre la scelta del microfono */
  onCambiaMicrofono: () => void
}) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  const ripreso = useRipreso(r.attiva, r.scollegato)
  const a = quale(r, documentoId, ripreso, onRiprendi, onCambiaMicrofono)

  return (
    <div className={s.posto} role="status">
      {a && (
        <div className={`${s.avviso} ${s[a.tono]}`}>
          <Icona nome={a.icona} dimensione={14} />
          <span className={s.testo} title={a.spiega}>{a.testo}</span>
          {a.azione && <button className={s.azione} onClick={a.azione.fai}>{a.azione.etichetta}</button>}
          {a.chiudi && (
            <button className={s.chiudi} title="Chiudi" aria-label="Chiudi l’avviso" onClick={a.chiudi}>
              <Icona nome="chiudi" dimensione={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function quale(
  r: StatoRegistrazione,
  documentoId: string,
  ripreso: boolean,
  onRiprendi: () => void,
  onCambiaMicrofono: () => void,
): Avviso | null {
  const qui = r.documentoId === documentoId

  // finita male: resta nella pagina dov'è successo finché non riprendi o chiudi
  if (!r.attiva && r.errore && qui) {
    return {
      tono: 'rosso',
      icona: 'errore',
      testo: `Registrazione interrotta. ${frase(r.errore)}`,
      azione: { etichetta: 'Riprendi', fai: onRiprendi },
      chiudi: () => azzera(),
    }
  }
  // un errore mentre registra ancora: di solito la fine arriva subito dopo
  if (r.attiva && r.errore && qui) return { tono: 'rosso', icona: 'errore', testo: frase(r.errore) }

  if (r.attiva && r.silenzio && !r.pausa) {
    return {
      tono: 'arancio',
      icona: 'microfono-muto',
      // in una riga anche a 716: il nome del microfono sta nel suggerimento
      testo: r.virtuale ? 'L’ingresso scelto è virtuale e non sente niente.' : 'Il microfono non sente niente da qualche secondo.',
      spiega: r.dispositivo ? `Sto ascoltando da «${r.dispositivo}»` : undefined,
      azione: { etichetta: 'Cambia microfono', fai: onCambiaMicrofono },
    }
  }
  if (r.attiva && r.scollegato) {
    return {
      tono: 'arancio',
      icona: 'scollegato',
      testo: 'Collegamento perso: continuo a registrare sul Mac, le frasi arrivano appena torna il collegamento.',
    }
  }
  if (!r.attiva && r.altrove) {
    return {
      tono: 'grigio',
      icona: 'altra-finestra',
      testo: 'La lezione si sta registrando in un’altra finestra.',
      azione: { etichetta: 'Portala qui', fai: () => void prendiQui() },
    }
  }
  if (ripreso) return { tono: 'verde', icona: 'accetta', testo: 'Ricollegato. Nessuna frase persa.' }
  return null
}

/** Vero per 3 secondi dopo che un collegamento perso è tornato. */
function useRipreso(attiva: boolean, scollegato: boolean) {
  const [ripreso, setRipreso] = useState(false)
  const prima = useRef(scollegato)
  useEffect(() => {
    const era = prima.current
    prima.current = scollegato
    if (!(era && !scollegato && attiva)) { setRipreso(false); return }
    setRipreso(true)
    const t = window.setTimeout(() => setRipreso(false), RIPRESO)
    return () => window.clearTimeout(t)
  }, [attiva, scollegato])
  return ripreso && attiva
}

// «il server si è riavviato» → «Il server si è riavviato.»
function frase(t: string) {
  const f = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?…]$/.test(f) ? f : `${f}.`
}
