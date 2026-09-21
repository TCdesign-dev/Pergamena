import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import type { RifEditore } from '../editor/Editor'
import type { Registrazione } from './tipi'
import { useRegistrazioni } from './useRegistrazioni'
import { eliminaRegistrazione } from './registrazione'
import { integraLezione } from '../merge/merge'
import { avviaRevisione } from '../merge/statoRevisione'
import { iscrivitiImpostazioni, leggiImpostazioni, imposta } from '../impostazioni'
import s from './PannelloLezioni.module.css'

/*  Le lezioni registrate in questa pagina: da qui parte il merge, si
 *  legge la trascrizione, si riascolta il professore, si cancella.
 *  È anche il gestore delle trascrizioni: niente resta sul disco o
 *  sul server senza che tu possa toglierlo. */

function quando(t: number) {
  return new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function minuti(r: Registrazione) {
  const fine = r.segmenti.length ? r.segmenti[r.segmenti.length - 1].fine : 0
  return Math.max(1, Math.round(fine / 60))
}

export function PannelloLezioni({ doc, materia, rifEditore, onChiudi }: {
  doc: Y.Doc
  materia: string
  rifEditore: RifEditore
  onChiudi: () => void
}) {
  const lezioni = useRegistrazioni(doc)
  const impostazioni = useSyncExternalStore(iscrivitiImpostazioni, leggiImpostazioni)
  const [aperta, setAperta] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<{ id: string; messaggio: string } | null>(null)
  const lettore = useRef<HTMLAudioElement>(null)
  const [microfoni, setMicrofoni] = useState<{ uid: string; nome: string; virtuale: boolean; sistema: boolean }[]>([])

  useEffect(() => {
    fetch('/api/ascolto/dispositivi')
      .then((r) => r.json())
      .then((j) => setMicrofoni(Array.isArray(j.elenco) ? j.elenco : []))
      .catch(() => setMicrofoni([]))
  }, [])

  const diSistema = microfoni.find((m) => m.sistema)

  async function integra(r: Registrazione) {
    const editor = rifEditore.current
    if (!editor) return
    setLavoro({ id: r.id, messaggio: 'confronto la lezione con i tuoi appunti…' })
    try {
      const esito = await integraLezione(editor, doc, r.id, materia)
      setLavoro({
        id: r.id,
        messaggio: esito.proposte
          ? `${esito.proposte} ${esito.proposte === 1 ? 'proposta' : 'proposte'} negli appunti`
          : 'Non manca niente di importante.',
      })
      if (esito.proposte) { onChiudi(); avviaRevisione() }
    } catch (e) {
      setLavoro({ id: r.id, messaggio: e instanceof Error ? e.message : 'merge fallito' })
    }
  }

  function riascolta(r: Registrazione, secondo: number) {
    const a = lettore.current
    if (!a) return
    if (!a.src.includes(r.id)) a.src = `/api/audio/${encodeURIComponent(r.id)}`
    a.currentTime = Math.max(0, secondo - 1)
    void a.play()
  }

  return (
    <div className={s.pannello} onMouseDown={(e) => e.stopPropagation()}>
      <header className={s.testa}>
        <span className={s.titolo}>Lezioni di questa pagina</span>
        <button className={s.chiudi} onClick={onChiudi}>×</button>
      </header>

      {lezioni.length === 0 && (
        <p className={s.vuoto}>Nessuna lezione registrata qui. Premi <b>Registra</b> quando comincia.</p>
      )}

      <ul className={s.elenco}>
        {[...lezioni].reverse().map((r) => (
          <li key={r.id} className={s.lezione}>
            <div className={s.riga}>
              <span className={s.data}>{quando(r.inizio)}</span>
              <span className={s.misure}>
                {r.fine === null ? 'in corso' : `${minuti(r)} min · ${r.segmenti.length} frasi`}
                {r.audio && ' · audio'}
              </span>
            </div>

            {r.integrata !== null && (
              <p className={s.stato}>integrata · {r.integrata} {r.integrata === 1 ? 'proposta' : 'proposte'}</p>
            )}
            {lavoro?.id === r.id && <p className={s.stato}>{lavoro.messaggio}</p>}

            <div className={s.azioni}>
              {r.fine !== null && r.segmenti.length > 0 && (
                <button className={s.principale} onClick={() => void integra(r)} disabled={lavoro?.id === r.id && lavoro.messaggio.endsWith('…')}>
                  {r.integrata === null ? 'Integra negli appunti' : 'Integra di nuovo'}
                </button>
              )}
              <button onClick={() => setAperta(aperta === r.id ? null : r.id)}>
                {aperta === r.id ? 'Nascondi' : 'Trascrizione'}
              </button>
              <button className={s.pericolo} onClick={() => void eliminaRegistrazione(doc, r.id)}>Elimina</button>
            </div>

            {aperta === r.id && (
              <div className={s.trascrizione}>
                {r.segmenti.map((seg, i) => (
                  <p key={i}>
                    <button
                      className={s.minuto}
                      disabled={!r.audio}
                      title={r.audio ? 'Riascolta da qui' : 'Audio non salvato'}
                      onClick={() => riascolta(r, seg.inizio)}
                    >
                      {Math.floor(seg.inizio / 60)}:{String(Math.floor(seg.inizio % 60)).padStart(2, '0')}
                    </button>
                    {seg.testo}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {microfoni.length > 0 && (
        <label className={s.microfono}>
          <span>Microfono</span>
          <select
            value={impostazioni.microfono ?? ''}
            onChange={(e) => imposta('microfono', e.target.value || null)}
          >
            <option value="">Come il sistema{diSistema ? ` · ${diSistema.nome}` : ''}</option>
            {/* i virtuali in fondo: servono solo per l'audio di altre app */}
            {[...microfoni].sort((a, b) => Number(a.virtuale) - Number(b.virtuale)).map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.nome}{m.virtuale ? ' — virtuale' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={s.opzione}>
        <input
          type="checkbox"
          checked={impostazioni.salvaAudio}
          onChange={(e) => imposta('salvaAudio', e.target.checked)}
        />
        <span>Tieni anche l’audio delle prossime lezioni <em>(circa 17 MB l’ora)</em></span>
      </label>

      <audio ref={lettore} className={s.lettore} controls preload="none" />
    </div>
  )
}
