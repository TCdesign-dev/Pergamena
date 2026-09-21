import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RifEditore } from '../editor/Editor'
import { iscrivitiRegistrazione, leggiRegistrazione } from './statoRegistrazione'
import { avviaRegistrazione, fermaRegistrazione } from './registrazione'
import { leggiImpostazioni } from '../impostazioni'
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

  useEffect(() => {
    if (r.avvio !== 'ascolto') return
    const t = setInterval(() => setOra(Date.now()), 500)
    return () => clearInterval(t)
  }, [r.avvio])

  // si registra in un'altra pagina: qui lo si dice, senza pulsante
  if (r.attiva && r.documentoId !== documentoId) {
    return <span className={s.altrove} title="La registrazione è in un'altra pagina">● registrazione in corso altrove</span>
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

  return (
    <button className={`${s.registra} ${s.inCorso}`} title="Ferma la registrazione" onClick={() => void fermaRegistrazione()}>
      <span className={`${s.pallino} ${s.acceso}`} />
      {r.avvio === 'parto' && 'mi preparo…'}
      {r.avvio === 'chiudo' && 'chiudo…'}
      {r.avvio === 'ascolto' && (
        <>
          <span className={s.tempo}>{durata(ora - (r.inizio ?? ora))}</span>
          <span className={s.tacche} aria-hidden>
            {[0.15, 0.45, 0.75].map((soglia) => (
              <i key={soglia} className={forza > soglia ? s.tacca : undefined} />
            ))}
          </span>
        </>
      )}
    </button>
  )
}

/** La frase che il riconoscitore sta ancora formando, in fondo alla pagina. */
export function Striscia({ documentoId }: { documentoId: string }) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  if (!r.attiva || r.documentoId !== documentoId) return null
  return (
    <div className={s.striscia} aria-live="polite">
      {r.errore ? <span className={s.errore}>{r.errore}</span>
        : r.provvisorio ? <span>{r.provvisorio}</span>
        : <span className={s.attesa}>sto ascoltando…</span>}
    </div>
  )
}
