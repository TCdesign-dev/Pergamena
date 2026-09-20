import { useState, useSyncExternalStore } from 'react'
import {
  iscrivitiPannello, leggiPannello, avviaRicerca, apriPannello, scartaRicerca,
} from '../immagini/statoPannello'
import { inserisciDaCommons } from '../immagini/inserisci'
import { TIPO_TRASCINAMENTO } from '../editor/estensioni/immagine'
import type { Trovata } from '../immagini/commons'
import type { RifEditore } from '../editor/Editor'
import { leggiImpostazioni, iscrivitiImpostazioni, imposta } from '../impostazioni'
import s from './PannelloImmagini.module.css'

/*  Le immagini non entrano MAI da sole nel testo: arrivano qui, e sei
 *  tu a trascinarle dove servono. Durante una lezione un'immagine che
 *  si infila da sola in mezzo a un paragrafo è un disastro. */

export function PannelloImmagini({ rifEditore }: { rifEditore: RifEditore }) {
  const { ricerche } = useSyncExternalStore(iscrivitiPannello, leggiPannello)
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [query, setQuery] = useState('')

  function inserisci(t: Trovata) {
    const editor = rifEditore.current
    if (editor) void inserisciDaCommons(editor, t)
  }

  return (
    <div className={s.pannello}>
      <header className={s.testa}>
        <span className={s.titolo}>Immagini</span>
        <button className={s.chiudi} title="Chiudi  ⌘/" onClick={() => apriPannello(false)}>×</button>
      </header>

      <form
        className={s.cerca}
        onSubmit={(e) => {
          e.preventDefault()
          void avviaRicerca(query)
          setQuery('')
        }}
      >
        <input
          className={s.campo}
          value={query}
          placeholder="Cerca su Wikimedia Commons…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <label className={s.interruttore}>
        <input
          type="checkbox"
          checked={impostazioni.sintassiImmagini}
          onChange={(e) => imposta('sintassiImmagini', e.target.checked)}
        />
        <span>
          <code>!parola!</code> cerca mentre scrivi
        </span>
      </label>

      <div className={s.scorrevole}>
        {ricerche.length === 0 && (
          <p className={s.vuoto}>
            Cerca qui sopra, oppure scrivi <code>!Basilica di Superga!</code> negli
            appunti.<br />Poi trascina l'immagine dove ti serve.
          </p>
        )}

        {ricerche.map((r) => (
          <section key={r.id} className={s.gruppo}>
            <div className={s.intestazione}>
              <span className={s.query}>{r.query}</span>
              {r.origine === 'sintassi' && <span className={s.marchio}>dagli appunti</span>}
              <button className={s.scarta} title="Togli" onClick={() => scartaRicerca(r.id)}>×</button>
            </div>

            {r.stato === 'in-corso' && <p className={s.stato}>cerco…</p>}
            {r.stato === 'errore' && <p className={s.stato}>{r.errore}</p>}
            {r.stato === 'pronta' && r.risultati.length === 0 && (
              <p className={s.stato}>niente su Commons</p>
            )}

            <div className={s.griglia}>
              {r.risultati.map((t) => (
                <button
                  key={t.chiave}
                  className={s.scheda}
                  title={`${t.titolo}\n${t.autore} · ${t.licenza}\n\nTrascina negli appunti, o clicca per inserirla al cursore`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_TRASCINAMENTO, JSON.stringify(t))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => inserisci(t)}
                >
                  <img src={t.miniatura} alt={t.titolo} loading="lazy" draggable={false} />
                  <span className={s.credito}>{t.licenza}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
