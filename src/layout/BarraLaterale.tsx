import { useState } from 'react'
import { creaQuaderno, creaDocumento, soloPagine } from '../documento/archivio'
import { prossimoEsame, mancano } from '../lib/esami'
import type { Quaderno, Documento } from '../documento/tipi'
import type { Fuoco } from '../editor/Editor'
import {
  ORDINI, ETICHETTE_ORDINE, leggiOrdine, salvaOrdine, ordina, type Ordine,
} from '../documento/ordinamento'
import { StatoSincronia } from './StatoSincronia'
import { PallinoInCorso } from '../registrazione/InCorso'
import { scrittaDiComando } from '../tastiera/scorciatoie'
import { Icona } from '../lib/Icona'
import s from './BarraLaterale.module.css'
import { locale, tr } from '../lingua/lingua'
import { Tr } from '../lingua/Tr'

/*  La barra laterale aperta: 248 px da 900 px in su, e sopra il foglio
 *  quando la apri con ⌘\ da una finestra stretta. In alto il nome e il
 *  pulsante per chiuderla, la ricerca, «Le tue materie»; poi l'albero
 *  delle materie e delle pagine; in fondo l'archivio e le impostazioni. */

export function BarraLaterale({
  quaderni, documenti, paginaInVista, inHome, schedaAperta, archivioAperto,
  onApri, onScheda, onRipasso, onHome, onArchivio, onImpostazioni, onCerca, onChiudi, onAccedi, onEliminaPagina, onEliminaMateria,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  /** la pagina aperta nel foglio, se è una pagina quella che si guarda */
  paginaInVista: string | null
  inHome: boolean
  schedaAperta: string | null
  archivioAperto: boolean
  onApri: (id: string, fuoco?: Fuoco) => void
  onScheda: (quadernoId: string) => void
  onRipasso: (quadernoId: string) => void
  onHome: () => void
  onArchivio: () => void
  onImpostazioni: () => void
  onCerca: () => void
  onChiudi: () => void
  onAccedi: () => void
  onEliminaPagina: (d: Documento) => void
  onEliminaMateria: (q: Quaderno) => void
}) {
  const [ordine, setOrdine] = useState<Ordine>(leggiOrdine)
  const [chiusi, setChiusi] = useState<Set<string>>(new Set())

  function cambiaOrdine() {
    const p = ORDINI[(ORDINI.indexOf(ordine) + 1) % ORDINI.length]
    setOrdine(p)
    salvaOrdine(p)
  }

  function piega(id: string) {
    setChiusi((c) => {
      const n = new Set(c)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const inOrdine = ordina(documenti.filter(soloPagine), ordine)

  return (
    <nav className={s.barra} aria-label={tr('Materie e pagine')}>
      <div className={s.testa}>
        <span className={s.marchio}>Pergamena</span>
        <button className={s.chiudi} onClick={onChiudi} aria-label={tr('Chiudi la barra laterale ({tasti})', { tasti: scrittaDiComando('barra') })} title={tr('Chiudi  {tasti}', { tasti: scrittaDiComando('barra') })}>
          <Icona nome="barra-laterale" />
        </button>
      </div>

      <button className={s.ordine} title={tr('Cambia l’ordine delle pagine')} onClick={cambiaOrdine}>
        {ETICHETTE_ORDINE[ordine]} ⇅
      </button>

      <button className={s.cerca} onClick={onCerca}>
        <Icona nome="cerca" dimensione={14} />
        <span className={s.cercaTesto}>{tr('Cerca o dai un comando')}</span>
        <kbd className={s.tasto}>{scrittaDiComando('cerca')}</kbd>
      </button>

      <button className={`${s.voce} ${inHome ? s.corrente : ''}`} onClick={onHome}>
        <Icona nome="materie" dimensione={14} />
        Le tue materie
      </button>

      <div className={s.etichetta}>{tr('Materie')}</div>

      <div className={s.elencoMaterie}>
        {quaderni.length === 0 && (
          <p className={s.vuoto}><Tr frase="Nessuna materia.<br>Creane una dalla Home." /></p>
        )}

        {quaderni.map((q) => {
          const pagine = inOrdine.filter((d) => d.quadernoId === q.id)
          const chiuso = chiusi.has(q.id)
          const esame = prossimoEsame(q)
          const giorni = esame ? mancano(esame.data) : null
          const nome = q.nome || tr('Senza nome')

          return (
            <section key={q.id}>
              <div className={`${s.intestazione} ${schedaAperta === q.id ? s.corrente : ''}`}>
                <button
                  className={s.piega}
                  onClick={() => piega(q.id)}
                  title={chiuso ? tr('Apri') : tr('Chiudi')}
                  aria-label={chiuso ? `Apri ${nome}` : `Chiudi ${nome}`}
                  aria-expanded={!chiuso}
                >
                  <span className={`${s.freccia} ${chiuso ? s.chiusa : ''}`}><Icona nome="giu" dimensione={12} /></span>
                </button>
                <span className={s.pallino} data-colore={q.colore} />
                <button className={s.nome} onClick={() => piega(q.id)}>{nome}</button>
                {/* un esame vicino si vede anche da qui, in piccolo */}
                {giorni !== null && giorni <= 14 && (
                  <span className={s.esameVicino} title={tr('{nome}: {quando}', {
                    nome: esame!.nome || tr('Esame'),
                    quando: giorni === 0 ? tr('oggi') : giorni === 1 ? tr('domani') : tr('fra {n} giorno | fra {n} giorni', { n: giorni }),
                  })}>
                    {giorni === 0 ? tr('oggi') : tr('{n}g', { n: giorni })}
                  </span>
                )}
                <div className={s.azioni}>
                  <button title={tr('Scheda della materia: esami, docente, programma')} aria-label={tr('Scheda della materia')} onClick={() => onScheda(q.id)}><Icona nome="materia" dimensione={14} /></button>
                  <button title={tr('Ripasso: dove eravamo rimasti, argomenti, quiz')} aria-label={tr('Ripasso')} onClick={() => onRipasso(q.id)}><Icona nome="ripasso" dimensione={14} /></button>
                  <button title={tr('Nuova pagina')} aria-label={tr('Nuova pagina')} onClick={() => onApri(creaDocumento(q.id).id, 'titolo')}><Icona nome="nuovo" dimensione={14} /></button>
                  <button title={tr('Elimina la materia')} aria-label={tr('Elimina la materia')} onClick={() => onEliminaMateria(q)}><Icona nome="elimina" dimensione={14} /></button>
                </div>
              </div>

              {!chiuso && (
                <ul className={s.pagine}>
                  {pagine.length === 0 && <li className={s.nessuna}>{tr('nessuna pagina')}</li>}
                  {pagine.map((d) => (
                    <li key={d.id} className={s.riga}>
                      <button
                        className={`${s.pagina} ${d.id === paginaInVista ? s.corrente : ''}`}
                        onClick={() => onApri(d.id, 'corpo')}
                      >
                        <span className={s.titoloPagina}>{d.titolo || tr('Senza titolo')}</span>
                        <PallinoInCorso documentoId={d.id} />
                        {ordine !== 'titolo' && (
                          <span className={s.data}>
                            {quando(ordine === 'creazione' ? d.creato : d.modificato)}
                          </span>
                        )}
                      </button>
                      <button className={s.cestino} title={tr('Elimina la pagina')} aria-label={tr('Elimina la pagina')} onClick={() => onEliminaPagina(d)}>
                        <Icona nome="elimina" dimensione={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        <button
          className={`${s.voce} ${s.spento}`}
          onClick={() => { const q = creaQuaderno(''); onApri(creaDocumento(q.id).id, 'titolo') }}
        >
          <Icona nome="nuovo" dimensione={14} />
          Nuova materia
        </button>
      </div>

      <div className={s.piede}>
        <button className={`${s.voce} ${archivioAperto ? s.corrente : ''}`} onClick={onArchivio}>
          <Icona nome="archivio" dimensione={14} />
          Archivio
        </button>
        <button className={s.voce} onClick={onImpostazioni}>
          <Icona nome="impostazioni" dimensione={14} />
          Impostazioni
          <kbd className={`${s.tasto} ${s.inFondo}`}>⌘,</kbd>
        </button>
      </div>

      <StatoSincronia onAccedi={onAccedi} />
    </nav>
  )
}

function quando(t: number) {
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return 'ora'
  if (min < 60) return `${min} min`
  const ore = Math.floor(min / 60)
  if (ore < 24) return `${ore} h`
  const giorni = Math.floor(ore / 24)
  if (giorni < 7) return `${giorni} g`
  return new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}
