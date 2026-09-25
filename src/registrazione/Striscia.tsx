import { useMemo, useSyncExternalStore } from 'react'
import { apriDocumento } from '../documento/archivio'
import { useRegistrazioni } from './useRegistrazioni'
import { iscrivitiRegistrazione, leggiRegistrazione } from './statoRegistrazione'
import s from './Striscia.module.css'
import { tr } from '../lingua/lingua'

/*  La fascia «Ora»: quello che il professore sta dicendo, mentre lo
 *  dice. Galleggia sopra il foglio, in fondo, con una sfumatura che la
 *  attacca alla pagina: il testo ci passa sotto senza stacco, e la
 *  colonna di scrittura non si sposta di un pixel.
 *
 *  Due righe al massimo. Quando la frase cresce si tagliano le parole
 *  più vecchie, a sinistra: la parte nuova è quella che interessa. */

// quanto testo si tiene: due righe piene, più un margine
const LETTERE = 190

/** Le ultime parole, tagliate all'inizio su uno spazio. */
function coda(testo: string, quante: number) {
  if (testo.length <= quante) return testo
  const tagliato = testo.slice(testo.length - quante)
  const spazio = tagliato.indexOf(' ')
  return spazio > 0 ? tagliato.slice(spazio + 1) : tagliato
}

export function Striscia({ documentoId }: { documentoId: string }) {
  const r = useSyncExternalStore(iscrivitiRegistrazione, leggiRegistrazione)
  const suo = r.attiva && r.documentoId === documentoId
  const doc = useMemo(() => (suo ? apriDocumento(documentoId).doc : null), [suo, documentoId])
  const lezioni = useRegistrazioni(doc)

  if (!suo) return null

  // la parte già sicura: le ultime frasi finite della lezione in corso
  const lezione = lezioni.find((l) => l.id === r.id)
  const finite = (lezione?.segmenti ?? []).slice(-3).map((x) => x.testo).join(' ')
  const sicuro = coda(finite, LETTERE)
  const provvisorio = coda(r.provvisorio, LETTERE)
  const spazio = Math.max(0, LETTERE - provvisorio.length)

  return (
    <>
      <div className={s.sfumatura} aria-hidden />
      <div className={s.fascia} role="status" aria-live="polite">
        <span className={s.ora}>
          <span className={s.pallino} aria-hidden />
          {tr('Ora')}
        </span>
        <p className={s.testo}>
          {r.pausa ? (
            <span className={s.attesa}>{tr('In pausa: il microfono non registra.')}</span>
          ) : sicuro || provvisorio ? (
            <>
              {spazio > 0 && <span className={s.sicuro}>{coda(sicuro, spazio)} </span>}
              <span className={s.provvisorio}>{provvisorio}</span>
            </>
          ) : (
            <span className={s.attesa}>ascolto da {r.dispositivo ?? 'microfono'}…</span>
          )}
        </p>
      </div>
    </>
  )
}
