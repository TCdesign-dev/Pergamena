import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RifEditore } from '../editor/Editor'
import { iscrivitiRegistrazione, leggiRegistrazione, azzera } from './statoRegistrazione'
import {
  avviaRegistrazione, collegaEditore, fermaRegistrazione, pausaRegistrazione, prendiQui, riprendiRegistrazione,
} from './registrazione'
import { leggiImpostazioni } from '../impostazioni'
import { Rotella } from '../layout/Attesa'
import { Icona } from '../lib/Icona'
import s from './Registrazione.module.css'

function durata(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function PulsanteRegistra({ documentoId, materia, rifEditore }: {
  documentoId: string
  materia: string
  rifEditore: RifEditore
}) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  const [ora, setOra] = useState(Date.now())

  // chi riprende una registrazione dopo un ricaricamento deve trovare l'editor
  useEffect(() => collegaEditore(documentoId, () => rifEditore.current), [documentoId, rifEditore])

  useEffect(() => {
    if (r.avvio !== 'ascolto' || r.pausa) return
    const t = setInterval(() => setOra(Date.now()), 500)
    return () => clearInterval(t)
  }, [r.avvio, r.pausa])

  // si registra in un'altra pagina: qui lo si dice, senza pulsante
  if (r.attiva && r.documentoId !== documentoId) {
    return <span className={s.altrove} title="La registrazione è in un'altra pagina"><span className={`${s.pallino} ${s.acceso}`} /> registrazione in corso altrove</span>
  }

  // il microfono è acceso ma scrive un'altra finestra
  if (!r.attiva && r.altrove) {
    return (
      <button
        className={`${s.registra} ${s.inCorso}`}
        title="Una registrazione è in corso in un'altra finestra: continuala qui"
        onClick={() => void prendiQui()}
      >
        <span className={`${s.pallino} ${s.acceso}`} /> in corso altrove · <u>continua qui</u>
      </button>
    )
  }

  if (!r.attiva) {
    return (
      <button
        className={s.registra}
        title="Registra la lezione e trascrivila sul Mac"
        onClick={() => void avviaRegistrazione({
          documentoId,
          materia,
          editor: () => rifEditore.current,
          salvaAudio: leggiImpostazioni().salvaAudio,
        })}
      >
        <span className={s.pallino} /> Registra
      </button>
    )
  }

  // il livello diventa tre tacche: -60 dB silenzio, -20 dB voce piena
  const forza = Math.min(1, Math.max(0, (r.livello + 60) / 40))
  // il cronometro conta la lezione registrata, non le pause
  const adesso = r.pausa && r.pausaDa ? r.pausaDa : ora
  const trascorso = adesso - (r.inizio ?? adesso) - r.pausaTotale

  return (
    <span className={s.gruppo}>
      <button
        className={`${s.registra} ${r.pausa ? s.inPausa : s.inCorso}`}
        title="Ferma la registrazione"
        onClick={() => void fermaRegistrazione()}
      >
        <span className={`${s.pallino} ${r.pausa ? '' : s.acceso}`} />
        {r.avvio === 'parto' && <span className={s.preparo}><Rotella /> mi preparo…</span>}
        {r.avvio === 'chiudo' && <span className={s.preparo}><Rotella /> chiudo…</span>}
        {r.avvio === 'ascolto' && (
          <>
            <span className={s.tempo}>{durata(trascorso)}</span>
            {r.pausa ? <span>in pausa</span> : (
              <span className={`${s.tacche} ${r.silenzio ? s.muto : ''}`} aria-hidden title={r.silenzio ? 'nessun suono' : undefined}>
                {[0.15, 0.45, 0.75].map((soglia) => (
                  <i key={soglia} className={forza > soglia ? s.tacca : undefined} />
                ))}
              </span>
            )}
          </>
        )}
      </button>
      {r.avvio === 'ascolto' && (
        <button
          className={s.pausa}
          title={r.pausa ? 'Riprendi a registrare' : 'Metti in pausa: il microfono non registra finché non riprendi'}
          aria-label={r.pausa ? 'Riprendi' : 'Pausa'}
          onClick={() => void (r.pausa ? riprendiRegistrazione() : pausaRegistrazione())}
        >
          <span className={r.pausa ? s.iconaRiprendi : s.iconaPausa} />
        </button>
      )}
    </span>
  )
}

/** La frase che il riconoscitore sta ancora formando, in fondo alla pagina. */
export function Striscia({ documentoId }: { documentoId: string }) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)

  // registrazione finita male: l'errore resta finché non lo chiudi
  if (!r.attiva && r.errore && r.documentoId === documentoId) {
    return (
      <div className={`${s.striscia} ${s.avviso} ${s.guasto}`} role="alert">
        <span>La registrazione si è fermata: {r.errore}</span>
        <button className={s.chiudiAvviso} onClick={() => azzera()} title="Chiudi" aria-label="Chiudi"><Icona nome="chiudi" dimensione={14} /></button>
      </div>
    )
  }

  // questa lezione la sta scrivendo un'altra finestra
  if (!r.attiva && r.altrove?.documentoId === documentoId) {
    return (
      <div className={`${s.striscia} ${s.riga}`} aria-live="polite">
        <span>Questa lezione si sta registrando in un’altra finestra.</span>
        <button className={s.azioneStriscia} onClick={() => void prendiQui()}>Continua qui</button>
      </div>
    )
  }

  if (!r.attiva || r.documentoId !== documentoId) return null
  if (r.pausa) {
    return (
      <div className={`${s.striscia} ${s.riga}`} aria-live="polite">
        <span>In pausa: il microfono non registra.</span>
        <button className={s.azioneStriscia} onClick={() => void riprendiRegistrazione()}>Riprendi</button>
      </div>
    )
  }
  if (r.scollegato) {
    return (
      <div className={`${s.striscia} ${s.avviso}`} aria-live="assertive">
        <span className={s.attesa}>Collegamento con il server perso: riprovo…</span>
      </div>
    )
  }
  if (r.silenzio) {
    return (
      <div className={`${s.striscia} ${s.avviso}`} aria-live="assertive">
        <span>
          Non sento niente da «{r.dispositivo}».
          {r.virtuale
            ? ' È un ingresso virtuale: scegli il microfono vero da Lezioni.'
            : ' Controlla che il microfono non sia spento o coperto.'}
        </span>
      </div>
    )
  }

  return (
    <div className={s.striscia} aria-live="polite">
      {r.errore ? <span className={s.errore}>{r.errore}</span>
        : r.provvisorio ? <span>{r.provvisorio}</span>
        : <span className={s.attesa}>ascolto da {r.dispositivo ?? 'microfono'}…</span>}
    </div>
  )
}
