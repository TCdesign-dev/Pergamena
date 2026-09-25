import { useState } from 'react'
import { creaQuaderno, creaDocumento, rinominaQuaderno, soloPagine } from '../documento/archivio'
import { prossimoEsame, comeDetto, mancano } from '../lib/esami'
import type { Quaderno, Documento } from '../documento/tipi'
import { useImmagine } from '../immagini/useImmagine'
import { useLargo } from './larghezza'
import { MenuPagina } from './MenuPagina'
import { AvvisoInCorso, PallinoInCorso, usePaginaRegistrata } from '../registrazione/InCorso'
import { Miniatura } from './Miniatura'
import { Icona } from '../lib/Icona'
import s from './Home.module.css'
import { locale, tr } from '../lingua/lingua'

/*  La prima cosa che vedi quando non stai scrivendo: le materie, con
 *  la loro copertina. Non è una dashboard — non ci sono numeri da
 *  guardare — è uno scaffale. Due colonne, quattro da 1200 px in su,
 *  e lì sotto anche le ultime pagine aperte. */

/** «oggi, 09:05», «ven 19 set». */
function quando(t: number) {
  const d = new Date(t)
  if (d.toDateString() === new Date().toDateString()) {
    return tr('oggi, {ora}', { ora: d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })
  }
  return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

export function Home({
  quaderni, documenti, onApri, onScheda, onRipasso, onCopertina, onElimina,
}: {
  quaderni: Quaderno[]
  documenti: Documento[]
  onApri: (idDocumento: string) => void
  onScheda: (quadernoId: string) => void
  onRipasso: (quadernoId: string) => void
  onCopertina: (quaderno: Quaderno) => void
  onElimina: (quaderno: Quaderno) => void
}) {
  const [inRinomina, setInRinomina] = useState<string | null>(null)
  const largo = useLargo()
  const pagine = documenti.filter(soloPagine)
  const ultime = [...pagine].sort((a, b) => b.modificato - a.modificato).slice(0, 6)
  const materie = new Map(quaderni.map((q) => [q.id, q]))
  // la pagina che sta registrando: da qui non si vedrebbe altrimenti
  const registrata = usePaginaRegistrata()
  const inRegistrazione = pagine.find((d) => d.id === registrata) ?? null

  function nuovaMateria() {
    const q = creaQuaderno('')
    setInRinomina(q.id)
    creaDocumento(q.id)
  }

  return (
    <div className={s.pagina}>
      <div className={s.contenuto} data-largo={largo || undefined}>
        <h1 className={s.titolo}>{tr('Le tue materie')}</h1>
        <div className={s.riga}>
          <span className={s.conto}>
            {quaderni.length === 0
              ? tr('Non ce n’è ancora nessuna.')
              : `${quaderni.length} ${quaderni.length === 1 ? 'materia' : 'materie'} · ${pagine.length} ${pagine.length === 1 ? 'pagina' : 'pagine'}`}
          </span>
          {inRegistrazione && (
            <AvvisoInCorso titolo={inRegistrazione.titolo} onVai={() => onApri(inRegistrazione.id)} />
          )}
          <button className={s.nuova} onClick={nuovaMateria}>
            <Icona nome="nuovo" dimensione={14} />
            Nuova materia
          </button>
        </div>

        <div className={s.griglia}>
          {quaderni.map((q) => (
            <Scheda
              key={q.id}
              quaderno={q}
              pagine={pagine.filter((d) => d.quadernoId === q.id)}
              inRinomina={inRinomina === q.id}
              onScheda={() => onScheda(q.id)}
              onRipasso={() => onRipasso(q.id)}
              onRinomina={() => setInRinomina(q.id)}
              onFineRinomina={() => setInRinomina(null)}
              onApri={onApri}
              onCopertina={() => onCopertina(q)}
              onElimina={() => onElimina(q)}
            />
          ))}
        </div>

        {largo && ultime.length > 0 && (
          <>
            <h2 className={s.etichetta}>{tr('Ultime pagine')}</h2>
            <div className={s.ultime}>
              {ultime.map((d) => (
                <button key={d.id} className={s.ultima} onClick={() => onApri(d.id)}>
                  <span className={s.pallino} data-colore={materie.get(d.quadernoId)?.colore} />
                  <span className={s.titoloPagina}>{d.titolo || tr('Senza titolo')}</span>
                  <PallinoInCorso documentoId={d.id} />
                  <span className={s.materia}>{materie.get(d.quadernoId)?.nome}</span>
                  <span className={s.spazio} />
                  <span className={s.quando}>{quando(d.modificato)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Scheda({
  quaderno, pagine, inRinomina, onScheda, onRipasso, onRinomina, onFineRinomina, onApri, onCopertina, onElimina,
}: {
  quaderno: Quaderno
  pagine: Documento[]
  inRinomina: boolean
  onScheda: () => void
  onRipasso: () => void
  onRinomina: () => void
  onFineRinomina: () => void
  onApri: (id: string) => void
  onCopertina: () => void
  onElimina: () => void
}) {
  const copertina = useImmagine(quaderno.copertinaId)
  const recente = [...pagine].sort((a, b) => b.modificato - a.modificato)[0]
  // una pagina di questa materia sta registrando: lo dice la scheda
  const registrata = usePaginaRegistrata()
  const quiSiRegistra = !!registrata && pagine.some((d) => d.id === registrata)
  const esame = prossimoEsame(quaderno)
  const vicino = esame ? mancano(esame.data) <= 14 : false
  const nome = quaderno.nome || tr('Senza nome')
  const apri = () => onApri(recente ? recente.id : creaDocumento(quaderno.id, '').id)

  return (
    <article className={s.scheda}>
      <div className={s.copertina} data-colore={quaderno.colore}>
        <button className={s.apri} aria-label={`Apri ${nome}`} onClick={apri}>
          {copertina
            ? <Miniatura src={copertina} alt="" draggable={false} />
            : <span className={s.iniziale}>{nome.trim().charAt(0).toUpperCase()}</span>}
        </button>
        {/*  Sempre visibili, non solo al passaggio del mouse: su un
         *  portatile senza mouse le azioni nascoste non esistono. */}
        <div className={s.comandi}>
          <button className={s.comando} title={tr('Ripasso e quiz')} aria-label={tr('Ripasso di {nome}', { nome })} onClick={onRipasso}>
            <Icona nome="ripasso" />
          </button>
          <MenuPagina
            etichetta={tr('Altre azioni su {nome}', { nome })}
            voci={[
              { etichetta: tr('Scheda della materia'), icona: 'materia', azione: onScheda },
              { etichetta: tr('Cambia copertina'), icona: 'immagini', azione: onCopertina },
              { etichetta: tr('Cambia nome'), icona: 'testo', azione: onRinomina },
              { etichetta: tr('Elimina la materia…'), icona: 'elimina', pericolo: true, staccata: true, azione: onElimina },
            ]}
          />
        </div>
      </div>

      <div className={s.didascalia}>
        {inRinomina ? (
          <input
            className={s.campoNome}
            autoFocus
            defaultValue={quaderno.nome}
            placeholder={tr('Nome materia')}
            onChange={(e) => rinominaQuaderno(quaderno.id, e.target.value)}
            onBlur={onFineRinomina}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          />
        ) : (
          <button className={s.nome} onDoubleClick={onRinomina} onClick={apri}>
            <span className={s.pallino} data-colore={quaderno.colore} />
            <span className={s.nomeTesto}>{nome}</span>
          </button>
        )}
        <div className={s.conteggio}>
          {quiSiRegistra
            ? <span className={s.registra}><span className={s.pallinoRosso} />{tr('si sta registrando')}</span>
            : pagine.length === 0 ? tr('vuota') : tr('{n} pagina | {n} pagine', { n: pagine.length })}
        </div>
        {/* il prossimo esame: è il motivo per cui la data è un campo e non testo */}
        {esame && (
          <button className={`${s.esame} ${vicino ? s.vicino : ''}`} onClick={onScheda} title={tr('Apri la scheda della materia')}>
            <Icona nome="esame" dimensione={12} />
            {esame.nome || tr('Esame')} {comeDetto(esame.data)}
          </button>
        )}
      </div>
    </article>
  )
}
