import { useEffect, useRef, useState } from 'react'
import { cercaSuCommons, scarica, type Trovata } from '../immagini/commons'
import { impostaCopertina, togliCopertina } from '../documento/archivio'
import type { Quaderno } from '../documento/tipi'
import { Miniatura } from './Miniatura'
import { Rotella, Tessere } from './Attesa'
import { Icona } from '../lib/Icona'
import s from './SceltaCopertina.module.css'
import { tr } from '../lingua/lingua'

export function SceltaCopertina({ quaderno, onChiudi }: { quaderno: Quaderno; onChiudi: () => void }) {
  const [query, setQuery] = useState(quaderno.nome)
  const [risultati, setRisultati] = useState<Trovata[]>([])
  const [stato, setStato] = useState<'ferma' | 'cerco' | 'salvo'>('ferma')
  const rifFile = useRef<HTMLInputElement>(null)

  async function cerca(q: string) {
    if (q.trim().length < 2) return
    setStato('cerco')
    try { setRisultati(await cercaSuCommons(q, 12)) } catch { setRisultati([]) }
    setStato('ferma')
  }

  // si parte già cercando il nome della materia: nove volte su dieci
  // la copertina giusta è lì
  useEffect(() => { void cerca(quaderno.nome) }, [quaderno.nome])

  async function scegli(t: Trovata) {
    setStato('salvo')
    try {
      await impostaCopertina(quaderno.id, await scarica(t), {
        attribuzione: t.autore, licenza: t.licenza, origine: t.pagina,
      })
      onChiudi()
    } finally { setStato('ferma') }
  }

  async function daFile(file: File | undefined) {
    if (!file?.type.startsWith('image/')) return
    setStato('salvo')
    try { await impostaCopertina(quaderno.id, file); onChiudi() } finally { setStato('ferma') }
  }

  return (
    <div className={s.velo} onMouseDown={onChiudi}>
      <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
        <header className={s.testa}>
          <h2 className={s.titolo}>Copertina di {quaderno.nome || tr('questa materia')}</h2>
          <button className={s.chiudi} title={tr('Chiudi')} aria-label={tr('Chiudi')} onClick={onChiudi}><Icona nome="chiudi" /></button>
        </header>

        <form className={s.cerca} onSubmit={(e) => { e.preventDefault(); void cerca(query) }}>
          <input
            className={s.campo}
            value={query}
            placeholder={tr('Cerca su Wikimedia Commons…')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className={s.secondario} onClick={() => rifFile.current?.click()}>
            {tr('dal computer')}
          </button>
          <input
            ref={rifFile}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void daFile(e.target.files?.[0])}
          />
        </form>

        <div className={s.griglia}>
          {stato === 'cerco' && <Tessere quante={8} classe={s.tesseraAttesa} />}
          {stato === 'salvo' && <p className={s.stato}><Rotella /> {tr('Salvo la copertina…')}</p>}
          {stato === 'ferma' && risultati.length === 0 && (
            <p className={s.stato}>{tr('Niente su Commons. Prova un altro termine, o carica un’immagine tua.')}</p>
          )}
          {risultati.map((t) => (
            <button key={t.chiave} className={s.scheda} title={`${t.autore} · ${t.licenza}`} onClick={() => void scegli(t)}>
              <Miniatura src={t.miniatura} alt={t.titolo} loading="lazy" />
            </button>
          ))}
        </div>

        {quaderno.copertinaId && (
          <button className={s.togli} onClick={() => { void togliCopertina(quaderno.id); onChiudi() }}>
            {tr('togli la copertina')}
          </button>
        )}
      </div>
    </div>
  )
}
