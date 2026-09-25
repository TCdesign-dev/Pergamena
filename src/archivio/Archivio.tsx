import { useCallback, useEffect, useState } from 'react'
import { misuraTutto, peso, quanto, type Misure, type MisuraPagina } from './misure'
import { togliAudio, togliTrascrizione } from './azioni'
import { Conferma } from '../layout/Conferma'
import { Tessere } from '../layout/Attesa'
import { mappaDocumenti } from '../documento/archivio'
import type { Documento } from '../documento/tipi'
import { Icona } from '../lib/Icona'
import s from './Archivio.module.css'
import { locale, tr } from '../lingua/lingua'

/*  Il gestore dell'archivio: quanto occupa ogni materia, ogni pagina,
 *  ogni lezione — e togliere quello che non serve più, una cosa alla
 *  volta. L'audio si toglie lasciando la trascrizione; la trascrizione
 *  lasciando gli appunti; la pagina, se proprio. Le materie più pesanti
 *  in cima: di solito lo spazio sta tutto in due o tre posti. */

type DaConfermare = { titolo: string; dettaglio: string; azione: string; esegui: () => Promise<void> }

function quando(t: number) {
  return new Date(t).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function Archivio({ onHome, onApri, onEliminaPagina }: {
  onHome: () => void
  onApri: (id: string) => void
  onEliminaPagina: (d: Documento) => void
}) {
  const [misure, setMisure] = useState<Misure | null>(null)
  const [aperte, setAperte] = useState<Set<string>>(new Set())
  const [conferma, setConferma] = useState<DaConfermare | null>(null)

  const ricarica = useCallback(() => { void misuraTutto().then(setMisure) }, [])
  useEffect(ricarica, [ricarica])

  // anche l'eliminazione di una pagina (confermata altrove) cambia i conti
  useEffect(() => {
    const cambiato = () => ricarica()
    mappaDocumenti.observe(cambiato)
    return () => mappaDocumenti.unobserve(cambiato)
  }, [ricarica])

  const apriChiudi = (id: string) =>
    setAperte((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const totale = misure ? Object.values(misure.totali).reduce((a, b) => a + b, 0) : 0

  return (
    <div className={s.vista}>
      <nav className={s.percorso}>
        <button className={s.passo} onClick={onHome}>{tr('Materie')}</button>
        <span className={s.sbarra}>/</span>
        <span className={s.qui}>{tr('Archivio')}</span>
      </nav>

      <div className={s.scorre}>
        <div className={s.colonna}>
          <h1 className={s.titolo}>{tr('Archivio')}</h1>
          <p className={s.sotto}>
            {tr('Quanto occupa cosa, e cosa togliere. L\'audio si toglie lasciando la trascrizione; la trascrizione lasciando gli appunti.')}
          </p>

          {!misure && <div className={s.attesa}><Tessere quante={4} classe={s.rigaAttesa} /></div>}

          {misure && (
            <>
              <dl className={s.totali}>
                <div><dt>{tr('Appunti')}</dt><dd>{quanto(misure.totali.appunti)}</dd></div>
                <div><dt>{tr('Trascrizioni')}</dt><dd>{quanto(misure.totali.trascrizioni)}</dd></div>
                <div><dt>{tr('Audio')}</dt><dd>{quanto(misure.totali.audio)}</dd></div>
                <div><dt>{tr('Immagini')}</dt><dd>{quanto(misure.totali.immagini)}</dd></div>
                <div className={s.tutto}><dt>{tr('In tutto')}</dt><dd>{quanto(totale)}</dd></div>
              </dl>
              {misure.browser !== null && (
                <p className={s.nota}>Il browser, per Pergamena, usa in tutto {quanto(misure.browser)} (con le copie di lavoro e le cache).</p>
              )}

              <ol className={s.materie}>
                {misure.materie.map((m) => {
                  const pesoMateria = m.pagine.reduce((t, p) => t + peso(p), 0)
                  const lezioni = m.pagine.reduce((t, p) => t + p.lezioni.length, 0)
                  const aperta = aperte.has(m.id)
                  return (
                    <li key={m.id} className={s.materia}>
                      <button className={s.rigaMateria} onClick={() => apriChiudi(m.id)} aria-expanded={aperta}>
                        <span className={s.freccia}><Icona nome={aperta ? 'giu' : 'destra'} dimensione={12} /></span>
                        <span className={s.pallino} data-colore={m.colore} />
                        <span className={s.nome}>{m.nome}</span>
                        <span className={s.dettagli}>
                          {m.pagine.length} {m.pagine.length === 1 ? 'pagina' : 'pagine'} · {lezioni} {lezioni === 1 ? 'lezione' : 'lezioni'}
                        </span>
                        <span className={s.peso}>{quanto(pesoMateria)}</span>
                      </button>
                      {aperta && (
                        <ol className={s.pagine}>
                          {m.pagine.map((p) => (
                            <Pagina
                              key={p.id}
                              p={p}
                              onApri={() => onApri(p.id)}
                              onElimina={() => { const d = mappaDocumenti.get(p.id); if (d) onEliminaPagina(d) }}
                              chiedi={setConferma}
                              dopo={ricarica}
                            />
                          ))}
                        </ol>
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </div>

      {conferma && (
        <Conferma
          titolo={conferma.titolo}
          dettaglio={conferma.dettaglio}
          azione={conferma.azione}
          onAnnulla={() => setConferma(null)}
          onConferma={() => { const c = conferma; setConferma(null); void c.esegui().then(ricarica) }}
        />
      )}
    </div>
  )
}

function Pagina({ p, onApri, onElimina, chiedi, dopo }: {
  p: MisuraPagina
  onApri: () => void
  onElimina: () => void
  chiedi: (c: DaConfermare) => void
  dopo: () => void
}) {
  return (
    <li className={s.pagina}>
      <div className={s.rigaPagina}>
        <button className={s.titoloPagina} onClick={onApri} title={tr('Apri la pagina')}>{p.titolo}</button>
        <span className={s.peso}>{quanto(peso(p))}</span>
      </div>
      <p className={s.voci}>
        appunti {quanto(p.byteAppunti)}
        {p.immagini > 0 && ` · ${p.immagini} ${p.immagini === 1 ? 'immagine' : 'immagini'} ${quanto(p.byteImmagini)}`}
      </p>
      {p.lezioni.map((l) => (
        <div key={l.id} className={s.lezione}>
          <span className={s.quando}>{quando(l.inizio)}</span>
          <span className={s.voci}>
            {l.frasi} {l.frasi === 1 ? 'frase' : 'frasi'} · trascrizione {quanto(l.byteTrascrizione)}
            {l.byteAudio > 0 && ` · audio ${quanto(l.byteAudio)}`}
          </span>
          <span className={s.azioni}>
            {l.byteAudio > 0 && (
              <button onClick={() => chiedi({
                titolo: tr('Togliere l’audio di questa lezione?'),
                dettaglio: tr('Si libera {spazio}. La trascrizione resta, e il merge funziona lo stesso: non potrai più riascoltare il professore.', { spazio: quanto(l.byteAudio) }),
                azione: tr('Togli l’audio'),
                esegui: () => togliAudio(p.id, l.id),
              })}>{tr('Togli l’audio')}</button>
            )}
            <button onClick={() => chiedi({
              titolo: tr('Togliere la trascrizione di questa lezione?'),
              dettaglio: l.byteAudio > 0
                ? tr('Gli appunti restano come sono, proposte accettate comprese. Sparisce il testo della lezione e il suo audio. Non si torna indietro.')
                : tr('Gli appunti restano come sono, proposte accettate comprese. Sparisce il testo della lezione. Non si torna indietro.'),
              azione: tr('Togli la trascrizione'),
              esegui: () => togliTrascrizione(p.id, l.id).then(dopo),
            })}>{tr('Togli la trascrizione')}</button>
          </span>
        </div>
      ))}
      <div className={s.fondo}>
        <button className={s.pericolo} onClick={onElimina}>{tr('Elimina la pagina')}</button>
      </div>
    </li>
  )
}
