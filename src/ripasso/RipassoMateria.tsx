import { useEffect, useMemo, useState } from 'react'
import type { Quaderno } from '../documento/tipi'
import { useIndice } from '../documento/useIndice'
import { argomentiDellaMateria, type Argomento } from './argomenti'
import { daRipassare, useEsiti, type Esito } from './risultati'
import { faiRiepilogo, fontiAttuali, useRiepilogo } from './riepilogo'
import { apriQuiz } from './statoQuiz'
import { vaiA } from '../layout/navigazione'
import { useLargo } from '../layout/larghezza'
import { prossimoEsame, comeDetto } from '../lib/esami'
import { Barra, Rotella, Tessere } from '../layout/Attesa'
import { Icona } from '../lib/Icona'
import s from './Ripasso.module.css'
import { locale, tr } from '../lingua/lingua'
import { Tr } from '../lingua/Tr'

/*  Il ripasso di una materia.
 *
 *  In cima «dove eravamo rimasti»: il punto sulle ultime lezioni, da
 *  leggere prima di entrare in aula. Sotto, gli argomenti — un titolo 1
 *  negli appunti è un argomento — con quelli da ripassare in evidenza:
 *  mai fatto un quiz, andato male, o più di una settimana fa. Per
 *  ognuno un quiz; in cima alla colonna degli argomenti uno su tutta la
 *  materia, che parte da quelli da ripassare.
 *
 *  Da 1200 px in su sono due colonne: il punto a sinistra, gli
 *  argomenti a destra. Sotto, gli argomenti vanno in cima. */

function quandoFa(ms: number) {
  const giorni = Math.floor((Date.now() - ms) / 86_400_000)
  if (giorni <= 0) return tr('oggi')
  if (giorni === 1) return tr('ieri')
  if (giorni < 7) return tr('{n} giorno fa | {n} giorni fa', { n: giorni })
  return new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function comeEAndato(e: Esito | undefined) {
  if (!e) return tr('mai fatto')
  return `${e.giuste} su ${e.totale} · ${quandoFa(e.quando)}`
}

export function RipassoMateria({ quaderno, onHome }: { quaderno: Quaderno; onHome: () => void }) {
  const largo = useLargo()
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
      setLavoro(r ? 'fermo' : tr('Ancora niente da riassumere: registra una lezione o scrivi qualche appunto.'))
    } catch (e) {
      setLavoro(e instanceof Error ? e.message : tr('non è andata'))
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

  const esame = prossimoEsame(quaderno)

  return (
    <div className={s.vista}>
      <nav className={s.percorso} aria-label={tr('Percorso')}>
        <button className={s.passo} onClick={onHome}>{tr('Materie')}</button>
        <span className={s.sbarra}>/</span>
        <span className={s.qui}>{quaderno.nome || tr('Senza nome')} · ripasso</span>
      </nav>

      <div className={s.scorre}>
        <div className={s.impianto} data-largo={largo || undefined}>
          <div className={s.principale}>
            <h1 className={s.titolo}>{tr('Ripasso')}</h1>
            <p className={s.sotto}>
              {quaderno.nome || tr('Senza nome')}
              {esame && <> · {esame.nome || tr('Esame')} {comeDetto(esame.data)}</>}
            </p>

            {/* ── dove eravamo rimasti ── */}
            <section className={s.sezione}>
              <div className={s.intestazione}>
                <h2 className={s.etichetta}>{tr('Dove eravamo rimasti')}</h2>
                {riepilogo && lavoro !== 'riassumo' && (
                  <button className={s.azione} onClick={() => void riassumi()}>
                    {vecchio ? tr('Ci sono lezioni nuove · aggiorna') : tr('Aggiorna')}
                  </button>
                )}
              </div>

              {lavoro === 'riassumo' && (
                <div className={s.attesa}><Barra /><span><Rotella /> {tr('Rileggo le ultime lezioni…')}</span></div>
              )}
              {lavoro !== 'fermo' && lavoro !== 'riassumo' && <p className={s.nota}>{lavoro}</p>}

              {!riepilogo && lavoro === 'fermo' && (
                <div className={s.vuoto}>
                  <p>{tr('Il punto sulle ultime due lezioni, da rileggere prima di entrare in aula.')}</p>
                  <button className={s.secondario} onClick={() => void riassumi()}>{tr('Fammi il punto')}</button>
                </div>
              )}

              {riepilogo && lavoro !== 'riassumo' && riepilogo.lezioni.map((l) => (
                <article key={l.chiave} className={s.lezione}>
                  <h3>
                    {new Date(l.quando).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
                    <span className={s.pagine}>{l.pagine.join(' · ')}</span>
                  </h3>
                  <ul>{l.punti.map((p, k) => <li key={k}>{p}</li>)}</ul>
                </article>
              ))}
            </section>
          </div>

          {/* ── la colonna dei quiz ── */}
          <aside className={s.lato} aria-label={tr('Argomenti e quiz')}>
            <button className={s.quizMateria} onClick={quizMateria} disabled={!ordinati?.length}>
              <Icona nome="ripasso" dimensione={14} />
              {tr('Quiz su tutta la materia')}
            </button>

            <div className={s.intestazione}>
              <h2 className={s.etichetta}>{tr('Argomenti')}</h2>
              <span className={s.quanti}>
                {argomenti === null ? tr('leggo gli appunti…')
                  : quantiDaRipassare ? tr('{n} da ripassare', { n: quantiDaRipassare })
                  : argomenti.length ? tr('tutti ripassati') : ''}
              </span>
            </div>

            {ordinati === null && <div className={s.righeAttesa}><Tessere quante={4} classe={s.rigaAttesa} /></div>}
            {ordinati?.length === 0 && (
              <p className={s.nota}>
                <Tr frase="Ancora nessun argomento. Un <b>titolo 1</b> negli appunti apre un argomento; dopo una lezione integrata l'AI propone quelli che mancano." />
              </p>
            )}

            <ol className={s.argomenti}>
              {ordinati?.map((a) => {
                const esito = esiti.get(a.chiave)
                const ripassare = daRipassare(esito)
                return (
                  <li key={a.chiave} className={s.argomento}>
                    <span className={`${s.pallino} ${ripassare ? s.daRipassare : ''}`} title={ripassare ? tr('da ripassare') : 'ripassato'} />
                    <button className={s.nomeArgomento} onClick={() => vaiA(a.documentoId, a.idTitolo ?? a.blocchi[0]?.id)} title={tr('Apri negli appunti')}>
                      {a.titolo}
                    </button>
                    <button
                      className={s.quiz}
                      onClick={() => apriQuiz({ tipo: 'argomenti', titolo: a.titolo, materia: quaderno.nome, argomenti: [a], chiaveEsito: a.chiave })}
                    >
                      {tr('Quiz')}
                    </button>
                    <span className={`${s.esito} ${esito && esito.giuste / esito.totale < 0.7 ? s.maluccio : ''}`}>{comeEAndato(esito)}</span>
                  </li>
                )
              })}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  )
}
