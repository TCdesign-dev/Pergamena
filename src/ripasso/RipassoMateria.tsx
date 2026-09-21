import { useEffect, useMemo, useState } from 'react'
import type { Quaderno } from '../documento/tipi'
import { useIndice } from '../documento/useIndice'
import { argomentiDellaMateria, type Argomento } from './argomenti'
import { daRipassare, useEsiti, type Esito } from './risultati'
import { faiRiepilogo, fontiAttuali, useRiepilogo } from './riepilogo'
import { apriQuiz } from './statoQuiz'
import { vaiA } from '../layout/navigazione'
import { Barra, Rotella, Tessere } from '../layout/Attesa'
import s from './Ripasso.module.css'

/*  Il ripasso di una materia.
 *
 *  In cima «dove eravamo rimasti»: il punto sulle ultime lezioni, da
 *  leggere prima di entrare in aula. Sotto, gli argomenti — un titolo 1
 *  negli appunti è un argomento — con quelli da ripassare in evidenza:
 *  mai fatto un quiz, andato male, o più di una settimana fa. Per
 *  ognuno un quiz; in alto uno su tutta la materia, che parte da quelli
 *  da ripassare. */

function quandoFa(ms: number) {
  const giorni = Math.floor((Date.now() - ms) / 86_400_000)
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  if (giorni < 7) return `${giorni} giorni fa`
  return new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function comeEAndato(e: Esito | undefined) {
  if (!e) return 'mai fatto'
  return `${e.giuste} su ${e.totale} · ${quandoFa(e.quando)}`
}

export function RipassoMateria({ quaderno, onHome }: { quaderno: Quaderno; onHome: () => void }) {
  const { documenti } = useIndice()
  const esiti = useEsiti()
  const riepilogo = useRiepilogo(quaderno.id)
  const [argomenti, setArgomenti] = useState<Argomento[] | null>(null)
  const [fonti, setFonti] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<'fermo' | 'riassumo' | string>('fermo')

  // si rileggono quando cambia una pagina della materia
  const firma = documenti.filter((d) => d.quadernoId === quaderno.id).map((d) => `${d.id}:${d.modificato}`).join(',')
  useEffect(() => {
    let vivo = true
    void argomentiDellaMateria(quaderno.id).then((a) => { if (vivo) setArgomenti(a) })
    void fontiAttuali(quaderno.id).then((f) => { if (vivo) setFonti(f) })
    return () => { vivo = false }
  }, [quaderno.id, firma])

  const ordinati = useMemo(() => {
    if (!argomenti) return null
    // prima quelli da ripassare, poi gli altri; dentro, dai più recenti
    return [...argomenti].sort((a, b) =>
      Number(daRipassare(esiti.get(b.chiave))) - Number(daRipassare(esiti.get(a.chiave))))
  }, [argomenti, esiti])

  const quantiDaRipassare = argomenti?.filter((a) => daRipassare(esiti.get(a.chiave))).length ?? 0
  const vecchio = riepilogo && fonti !== null && riepilogo.fonti !== fonti

  async function riassumi() {
    setLavoro('riassumo')
    try {
      const r = await faiRiepilogo(quaderno.id, quaderno.nome)
      setLavoro(r ? 'fermo' : 'Ancora niente da riassumere: registra una lezione o scrivi qualche appunto.')
    } catch (e) {
      setLavoro(e instanceof Error ? e.message : 'non è andata')
    }
  }

  function quizMateria() {
    if (!ordinati?.length) return
    apriQuiz({
      tipo: 'argomenti',
      titolo: `Tutta ${quaderno.nome || 'la materia'}`,
      materia: quaderno.nome,
      argomenti: ordinati,
      chiaveEsito: `materia:${quaderno.id}`,
    })
  }

  return (
    <div className={s.vista}>
      <nav className={s.percorso}>
        <button className={s.passo} onClick={onHome}>Materie</button>
        <span className={s.sbarra}>/</span>
        <span className={s.qui}>{quaderno.nome || 'Senza nome'} · ripasso</span>
      </nav>

      <div className={s.scorre}>
        <div className={s.colonna}>
          <header className={s.testa}>
            <div>
              <h1 className={s.titolo}>Ripasso</h1>
              <p className={s.sotto}>
                {argomenti === null ? 'leggo gli appunti…'
                  : `${argomenti.length} ${argomenti.length === 1 ? 'argomento' : 'argomenti'}` +
                    (quantiDaRipassare ? ` · ${quantiDaRipassare} da ripassare` : ' · tutti ripassati di recente')}
              </p>
            </div>
            <button className={s.principale} onClick={quizMateria} disabled={!ordinati?.length}>
              Quiz su tutta la materia
            </button>
          </header>

          {/* ── dove eravamo rimasti ── */}
          <section className={s.sezione}>
            <div className={s.intestazione}>
              <h2>Dove eravamo rimasti</h2>
              {riepilogo && lavoro !== 'riassumo' && (
                <button className={s.azione} onClick={() => void riassumi()}>
                  {vecchio ? 'Ci sono lezioni nuove · aggiorna' : 'Aggiorna'}
                </button>
              )}
            </div>

            {lavoro === 'riassumo' && (
              <div className={s.attesa}><Barra /><span><Rotella /> Rileggo le ultime lezioni…</span></div>
            )}
            {lavoro !== 'fermo' && lavoro !== 'riassumo' && <p className={s.nota}>{lavoro}</p>}

            {!riepilogo && lavoro === 'fermo' && (
              <div className={s.vuoto}>
                <p>Il punto sulle ultime due lezioni, da rileggere prima di entrare in aula.</p>
                <button className={s.secondario} onClick={() => void riassumi()}>Fammi il punto</button>
              </div>
            )}

            {riepilogo && lavoro !== 'riassumo' && riepilogo.lezioni.map((l) => (
              <article key={l.chiave} className={s.lezione}>
                <h3>
                  {new Date(l.quando).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className={s.pagine}>{l.pagine.join(' · ')}</span>
                </h3>
                <ul>{l.punti.map((p, k) => <li key={k}>{p}</li>)}</ul>
              </article>
            ))}
          </section>

          {/* ── gli argomenti ── */}
          <section className={s.sezione}>
            <div className={s.intestazione}><h2>Argomenti</h2></div>

            {ordinati === null && <div className={s.righeAttesa}><Tessere quante={4} classe={s.rigaAttesa} /></div>}
            {ordinati?.length === 0 && (
              <p className={s.nota}>
                Ancora nessun argomento. Un <b>titolo 1</b> negli appunti apre un argomento; dopo una lezione integrata
                l'AI propone quelli che mancano.
              </p>
            )}

            <ol className={s.argomenti}>
              {ordinati?.map((a) => {
                const esito = esiti.get(a.chiave)
                const ripassare = daRipassare(esito)
                return (
                  <li key={a.chiave} className={s.argomento}>
                    <span className={`${s.pallino} ${ripassare ? s.daRipassare : ''}`} title={ripassare ? 'da ripassare' : 'ripassato'} />
                    <button className={s.nomeArgomento} onClick={() => vaiA(a.documentoId, a.idTitolo ?? a.blocchi[0]?.id)} title="Apri negli appunti">
                      {a.titolo}
                    </button>
                    <span className={s.dove}>{a.pagina !== a.titolo ? a.pagina : ''}</span>
                    <span className={`${s.esito} ${esito && esito.giuste / esito.totale < 0.7 ? s.maluccio : ''}`}>{comeEAndato(esito)}</span>
                    <button
                      className={s.quiz}
                      onClick={() => apriQuiz({ tipo: 'argomenti', titolo: a.titolo, materia: quaderno.nome, argomenti: [a], chiaveEsito: a.chiave })}
                    >
                      Quiz
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
