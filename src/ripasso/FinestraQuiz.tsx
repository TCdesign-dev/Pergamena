import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { apriQuiz, iscrivitiQuiz, leggiQuiz } from './statoQuiz'
import { preparaQuiz, type Ambito, type Domanda } from './quiz'
import { segnaEsito } from './risultati'
import { vaiA } from '../layout/navigazione'
import { Barra } from '../layout/Attesa'
import { Icona } from '../lib/Icona'
import s from './Quiz.module.css'

/*  Il quiz: una domanda alla volta, e subito la risposta giusta col suo
 *  perché. Tutto da tastiera: 1-4 sceglie, Invio va avanti, Esc chiude.
 *  Le domande aperte non si correggono da sole: si pensa la risposta, la
 *  si scopre, e si dice onestamente se la si sapeva. A fine giro, per
 *  ogni errore c'è «rileggi», che porta al punto degli appunti. */

export function FinestraQuiz() {
  const ambito = useSyncExternalStore(iscrivitiQuiz, leggiQuiz)
  if (!ambito) return null
  return <Quiz ambito={ambito} />
}

type Risposta = number | boolean | null   // scelta: l'opzione; aperta: la sapevo sì o no

const LETTERE = ['A', 'B', 'C', 'D']

function Quiz({ ambito }: { ambito: Ambito }) {
  const quante = ambito.tipo === 'selezione' ? 4 : ambito.argomenti.length === 1 ? 5 : 8
  const [fase, setFase] = useState<'preparo' | 'domande' | 'fine' | 'errore'>('preparo')
  const [errore, setErrore] = useState('')
  const [domande, setDomande] = useState<Domanda[]>([])
  const [risposte, setRisposte] = useState<Risposta[]>([])
  const [i, setI] = useState(0)
  const [svelata, setSvelata] = useState(false)
  const [inizio, setInizio] = useState(() => Date.now())
  const [ora, setOra] = useState(() => Date.now())
  const giro = useRef(0)

  const chiudi = useCallback(() => apriQuiz(null), [])

  const prepara = useCallback(async () => {
    const mio = ++giro.current
    setFase('preparo')
    setInizio(Date.now())
    try {
      const nuove = await preparaQuiz(ambito, quante)
      if (mio !== giro.current) return
      setDomande(nuove)
      setRisposte(nuove.map(() => null))
      setI(0)
      setSvelata(false)
      setFase('domande')
    } catch (e) {
      if (mio !== giro.current) return
      setErrore(e instanceof Error ? e.message : 'non è andata')
      setFase('errore')
    }
  }, [ambito, quante])

  useEffect(() => {
    void prepara()
    return () => { giro.current++ }
  }, [prepara])

  // i secondi che passano mentre il modello prepara le domande
  useEffect(() => {
    if (fase !== 'preparo') return
    const t = window.setInterval(() => setOra(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [fase])

  const d = domande[i]
  const risposta = risposte[i]
  const risposto = risposta !== null && risposta !== undefined
  const eGiusta = (k: number) => {
    const q = domande[k]
    return q?.tipo === 'scelta' ? risposte[k] === q.giusta : risposte[k] === true
  }
  const giuste = domande.filter((_, k) => eGiusta(k)).length

  const rispondi = useCallback((r: Risposta) => {
    setRisposte((rs) => rs.map((x, k) => (k === i && x === null ? r : x)))
  }, [i])

  const avanti = useCallback(() => {
    if (i + 1 < domande.length) {
      setI(i + 1)
      setSvelata(false)
      return
    }
    setFase('fine')
    if (ambito.tipo === 'argomenti') {
      const bene = domande.filter((_, k) => eGiusta(k)).length
      segnaEsito(ambito.chiaveEsito, bene, domande.length)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, domande, ambito, risposte])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') { e.preventDefault(); chiudi(); return }
      if (fase === 'fine' && k === 'enter') { e.preventDefault(); chiudi(); return }
      if (fase !== 'domande' || !d) return
      if (risposto) {
        if (k === 'enter') { e.preventDefault(); avanti() }
        return
      }
      if (d.tipo === 'scelta') {
        const n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k)
        if (n >= 0 && n < d.opzioni.length) { e.preventDefault(); rispondi(n) }
      } else if (!svelata) {
        if (k === 'enter' || k === ' ') { e.preventDefault(); setSvelata(true) }
      } else if (k === 's' || k === '1') { e.preventDefault(); rispondi(true) }
      else if (k === 'n' || k === '2') { e.preventDefault(); rispondi(false) }
    }
    window.addEventListener('keydown', tasto, true)
    return () => window.removeEventListener('keydown', tasto, true)
  }, [fase, d, risposto, svelata, avanti, rispondi, chiudi])

  function rileggi(q: Domanda) {
    if (!q.fonte) return
    chiudi()
    vaiA(q.fonte.documentoId, q.fonte.idBlocco)
  }

  return (
    <div className={s.velo} onMouseDown={chiudi}>
      <div className={s.finestra} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={`Quiz: ${ambito.titolo}`}>
        <header className={s.testa}>
          <span className={s.etichetta}>Quiz</span>
          <span className={s.titolo}>{ambito.titolo}</span>
          {fase === 'domande' && domande.length > 0 && (
            <span className={s.conto}>{i + 1} di {domande.length}</span>
          )}
          <button className={s.chiudi} onClick={chiudi} title="Chiudi  esc" aria-label="Chiudi"><Icona nome="chiudi" /></button>
        </header>

        {fase === 'preparo' && (
          <div className={s.attesa}>
            <Barra />
            <p>Preparo le domande dai tuoi appunti…{ora - inizio >= 2000 && <span className={s.secondi}> {Math.floor((ora - inizio) / 1000)} s</span>}</p>
          </div>
        )}

        {fase === 'errore' && (
          <div className={s.attesa}>
            <p className={s.errore}>{errore}</p>
            <button className={s.principale} onClick={() => void prepara()}>Riprova</button>
          </div>
        )}

        {fase === 'domande' && d && (
          <div className={s.corpo} key={i}>
            <ol className={s.avanzamento} aria-label={`Domanda ${i + 1} di ${domande.length}`}>
              {domande.map((_, k) => (
                <li
                  key={k}
                  className={k === i ? s.qui : risposte[k] === null || risposte[k] === undefined ? undefined : eGiusta(k) ? s.bene : s.male}
                />
              ))}
            </ol>
            <p className={s.domanda}>{d.testo}</p>

            {d.tipo === 'scelta' ? (
              <>
                <ol className={s.opzioni}>
                  {d.opzioni.map((o, k) => {
                    const stato = !risposto ? '' : k === d.giusta ? s.giusta : k === risposta ? s.sbagliata : s.spenta
                    return (
                      <li key={k}>
                        <button className={`${s.opzione} ${stato}`} onClick={() => rispondi(k)} disabled={risposto}>
                          <span className={s.lettera}>{LETTERE[k]}</span>
                          <span>{o}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                {risposto && (
                  <p className={s.spiegazione}>
                    <strong>{risposta === d.giusta ? 'Giusto.' : `Era la ${LETTERE[d.giusta]}.`}</strong> {d.spiegazione}
                  </p>
                )}
              </>
            ) : !svelata ? (
              <button className={s.svela} onClick={() => setSvelata(true)}>
                Pensa alla risposta, poi scoprila <kbd className={s.tasto}>↵</kbd>
              </button>
            ) : (
              <>
                <p className={s.risposta}>{d.risposta}</p>
                <div className={s.valuta}>
                  <button className={`${s.opzione} ${risposta === true ? s.giusta : risposto ? s.spenta : ''}`} onClick={() => rispondi(true)} disabled={risposto}>
                    <span className={s.lettera}>S</span> La sapevo
                  </button>
                  <button className={`${s.opzione} ${risposta === false ? s.sbagliata : risposto ? s.spenta : ''}`} onClick={() => rispondi(false)} disabled={risposto}>
                    <span className={s.lettera}>N</span> Da rivedere
                  </button>
                </div>
              </>
            )}

            <footer className={s.piede}>
              <span className={s.aiuto}>
                {!risposto && (d.tipo === 'scelta'
                  ? <>premi <kbd className={s.tasto}>1</kbd>–<kbd className={s.tasto}>4</kbd>, o clicca</>
                  : svelata ? <><kbd className={s.tasto}>S</kbd> o <kbd className={s.tasto}>N</kbd></>
                  : <><kbd className={s.tasto}>↵</kbd> per scoprire la risposta</>)}
              </span>
              {risposto && (
                <span className={s.azioni}>
                  {d.fonte && (
                    <button className={s.secondario} onClick={() => rileggi(d)}>
                      <Icona nome="apri-fuori" dimensione={14} />
                      Rileggi negli appunti
                    </button>
                  )}
                  <button className={s.principale} onClick={avanti} autoFocus>
                    {i + 1 < domande.length ? 'Avanti' : 'Com’è andata'} <kbd className={s.tasto}>↵</kbd>
                  </button>
                </span>
              )}
            </footer>
          </div>
        )}

        {fase === 'fine' && (
          <div className={s.corpo}>
            <p className={s.punteggio}><strong>{giuste}</strong> su {domande.length}</p>
            <p className={s.commento}>
              {giuste / domande.length >= 0.8 ? 'Lo sai bene.'
                : giuste / domande.length >= 0.5 ? 'Quasi: rileggi i punti segnati.'
                : 'Da ripassare: parti dai punti segnati.'}
            </p>
            <ol className={s.riepilogo}>
              {domande.map((q, k) => (
                <li key={k} className={eGiusta(k) ? s.bene : s.male}>
                  <span className={s.segno}><Icona nome={eGiusta(k) ? 'accetta' : 'chiudi'} dimensione={14} /></span>
                  <span className={s.testoRiepilogo}>{q.testo}</span>
                  {!eGiusta(k) && q.fonte && (
                    <button className={s.rileggi} onClick={() => rileggi(q)}>rileggi <Icona nome="destra" dimensione={12} /></button>
                  )}
                </li>
              ))}
            </ol>
            <footer className={s.piede}>
              <span className={s.azioni}>
                <button className={s.secondario} onClick={() => void prepara()}>Altre domande</button>
                <button className={s.principale} onClick={chiudi}>Chiudi <kbd className={s.tasto}>↵</kbd></button>
              </span>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
