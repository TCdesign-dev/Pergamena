import { useEffect, useRef } from 'react'
import type * as Y from 'yjs'
import { segnaFatto, togliCompito, useCompiti, type Compito } from './deposito'
import { leggiRegistrazioni } from '../registrazione/registrazione'
import { comeDetto, dataBreve, mancano } from '../lib/esami'
import { Icona } from '../lib/Icona'
import { tr } from '../lingua/lingua'
import s from './PannelloCompiti.module.css'

/*  I compiti assegnati a voce durante la lezione.
 *
 *  Li tira fuori l'integratore dalla trascrizione: «le tavole me le
 *  portate giovedì» diventa una riga con la sua data. Sono la cosa che
 *  negli appunti non finisce mai — mentre lo dice stai scrivendo altro
 *  — e che poi manca proprio quando serve.
 *
 *  Il minuto accanto alla citazione riapre l'audio da lì: se il
 *  compito è ambiguo, la voce del professore lo scioglie. */

const tempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function PannelloCompiti({ doc, modo, onChiudi }: {
  doc: Y.Doc
  modo: 'tendina' | 'lato'
  onChiudi: () => void
}) {
  const compiti = useCompiti(doc)
  const lezioni = leggiRegistrazioni(doc)
  const lettore = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const giu = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onChiudi() }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [onChiudi])

  function riascolta(c: Compito) {
    const a = lettore.current
    if (!a || !c.lezione || c.minuto === undefined) return
    if (!a.src.includes(c.lezione)) a.src = `/api/audio/${encodeURIComponent(c.lezione)}`
    a.currentTime = Math.max(0, c.minuto - 1)
    void a.play()
  }

  const conAudio = (c: Compito) =>
    c.minuto !== undefined && lezioni.some((r) => r.id === c.lezione && r.audio)

  return (
    <div className={s.pannello} data-modo={modo}>
      <header className={s.testa}>
        <span className={s.titolo}>{tr('Compiti')}</span>
        <button className={s.chiudi} title={tr('Chiudi  esc')} aria-label={tr('Chiudi il pannello dei compiti')} onClick={onChiudi}>
          <Icona nome="chiudi" />
        </button>
      </header>

      <div className={s.corpo}>
        {compiti.length === 0 && (
          <p className={s.vuoto}>
            {tr('Qui arrivano le cose da fare che il professore assegna a voce. Escono insieme alle proposte, quando integri la lezione.')}
          </p>
        )}

        {compiti.map((c) => {
          const giorni = c.data ? mancano(c.data) : null
          return (
            <article key={c.id} className={`${s.compito} ${c.fatto ? s.fatto : ''}`}>
              <input
                type="checkbox"
                className={s.spunta}
                checked={!!c.fatto}
                aria-label={tr('Fatto')}
                onChange={(e) => segnaFatto(doc, c.id, e.target.checked)}
              />
              <div className={s.corpoCompito}>
                <p className={s.testo}>{c.testo}</p>
                <p className={`${s.quando} ${!c.fatto && giorni !== null && giorni < 0 ? s.scaduto : ''}`}>
                  {c.data
                    ? <span>{dataBreve(c.data)} · {comeDetto(c.data)}</span>
                    : <span>{tr('senza scadenza')}</span>}
                  {conAudio(c) && (
                    <button className={s.minuto} title={tr('Riascolta da qui')} onClick={() => riascolta(c)}>
                      {tempo(c.minuto!)}
                    </button>
                  )}
                </p>
                {c.citazione && <p className={s.citazione}>«{c.citazione}»</p>}
              </div>
              <button className={s.togli} title={tr('Togli questo compito')} aria-label={tr('Togli questo compito')} onClick={() => togliCompito(doc, c.id)}>
                <Icona nome="chiudi" dimensione={12} />
              </button>
            </article>
          )
        })}
        <audio ref={lettore} preload="none" />
      </div>
    </div>
  )
}
