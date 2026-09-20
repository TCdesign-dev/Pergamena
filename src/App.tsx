import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useIndice } from './documento/useIndice'
import { Guscio } from './layout/Guscio'
import { BarraLaterale } from './layout/BarraLaterale'
import { Editor, type Fuoco, type RifEditore } from './editor/Editor'
import { Comandi } from './layout/Comandi'
import { esponi } from './lib/dev'
import { PannelloImmagini } from './layout/PannelloImmagini'
import { iscrivitiPannello, leggiPannello, apriPannello } from './immagini/statoPannello'
import { FinestraAccesso } from './sync/FinestraAccesso'
import { iscrivitiAccesso, leggiAccesso } from './sync/accesso'
import { accendiSincronia, spegniSincronia } from './sync/sincronia'
import s from './App.module.css'

const ULTIMO = 'pergamena:ultimo-documento'

function leggiUltimo(): string | null {
  try { return localStorage.getItem(ULTIMO) } catch { return null }
}

export function App() {
  const { quaderni, documenti } = useIndice()
  const [apertoId, setApertoId] = useState<string | null>(leggiUltimo)
  const [fuoco, setFuoco] = useState<Fuoco>('corpo')
  const [latoAperto, setLatoAperto] = useState(true)
  const [comandiAperti, setComandiAperti] = useState(false)
  const rifEditore: RifEditore = useRef(null)
  const pannello = useSyncExternalStore(iscrivitiPannello, leggiPannello)
  const accesso = useSyncExternalStore(iscrivitiAccesso, leggiAccesso)
  const [mostraAccesso, setMostraAccesso] = useState(false)

  // la sincronia segue l'accesso: entri e parte, esci e si ferma
  useEffect(() => {
    if (accesso.utente) accendiSincronia()
    else spegniSincronia()
  }, [accesso.utente])

  const apri = useCallback((id: string, dove: Fuoco = 'corpo') => {
    setApertoId(id)
    setFuoco(dove)
  }, [])

  useEffect(() => esponi({ apri }), [apri])

  const chiudiComandi = useCallback(() => {
    setComandiAperti(false)
    // un frame dopo: se la palette ha aperto un altro documento,
    // qui il riferimento punta già al suo editor
    requestAnimationFrame(() => rifEditore.current?.commands.focus())
  }, [])

  // si riapre dove eri: nessuna schermata di benvenuto, mai
  useEffect(() => {
    if (apertoId && documenti.some((d) => d.id === apertoId)) return
    setApertoId(documenti[0]?.id ?? null)
  }, [documenti, apertoId])

  useEffect(() => {
    try { apertoId ? localStorage.setItem(ULTIMO, apertoId) : localStorage.removeItem(ULTIMO) }
    catch { /* finestra privata: pazienza */ }
  }, [apertoId])

  // ⌘\ nasconde la barra · ⌘K apre la palette
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '\\') {
        e.preventDefault()
        setLatoAperto((v) => !v)
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setComandiAperti((v) => !v)
      } else if (e.key === '/') {
        e.preventDefault()
        apriPannello(!leggiPannello().aperto)
      }
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [])

  const aperto = documenti.find((d) => d.id === apertoId) ?? null

  return (
    <>
    <Guscio
      latoAperto={latoAperto}
      destra={pannello.aperto ? <PannelloImmagini rifEditore={rifEditore} /> : undefined}
      lato={
        <BarraLaterale
          quaderni={quaderni}
          documenti={documenti}
          apertoId={apertoId}
          onApri={apri}
          onAccedi={() => setMostraAccesso(true)}
        />
      }
      centro={
        aperto ? (
          <Editor documento={aperto} fuoco={fuoco} rifEditore={rifEditore} />
        ) : (
          <div className={s.nulla}>
            <p>Crea una materia dalla barra a sinistra.</p>
          </div>
        )
      }
    />
    {mostraAccesso && <FinestraAccesso onChiudi={() => setMostraAccesso(false)} />}
    {comandiAperti && (
      <Comandi
        quaderni={quaderni}
        documenti={documenti}
        onApri={apri}
        onChiudi={chiudiComandi}
      />
    )}
    </>
  )
}
