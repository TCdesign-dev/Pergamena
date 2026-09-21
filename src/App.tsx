import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useIndice } from './documento/useIndice'
import { eliminaDocumento, eliminaQuaderno } from './documento/archivio'
import type { Quaderno, Documento } from './documento/tipi'
import { Guscio } from './layout/Guscio'
import { BarraLaterale } from './layout/BarraLaterale'
import { BarraSuperiore } from './layout/BarraSuperiore'
import { Home } from './layout/Home'
import { Conferma } from './layout/Conferma'
import { SceltaCopertina } from './layout/SceltaCopertina'
import { Editor, type Fuoco, type RifEditore } from './editor/Editor'
import { Comandi } from './layout/Comandi'
import { esponi } from './lib/dev'
import { PannelloImmagini } from './layout/PannelloImmagini'
import { iscrivitiPannello, leggiPannello, apriPannello } from './immagini/statoPannello'
import { FinestraAccesso } from './sync/FinestraAccesso'
import { iscrivitiAccesso, leggiAccesso } from './sync/accesso'
import { accendiSincronia, spegniSincronia } from './sync/sincronia'
import { allineaTutto } from './sync/allineaTutto'
import { Striscia } from './registrazione/PulsanteRegistra'
import { Revisione } from './merge/Revisione'
import s from './App.module.css'

const ULTIMO = 'pergamena:ultimo-documento'
const leggiUltimo = () => { try { return localStorage.getItem(ULTIMO) } catch { return null } }

type DaEliminare =
  | { tipo: 'pagina'; documento: Documento }
  | { tipo: 'materia'; quaderno: Quaderno }

export function App() {
  const { quaderni, documenti } = useIndice()
  const [apertoId, setApertoId] = useState<string | null>(leggiUltimo)
  const [fuoco, setFuoco] = useState<Fuoco>('corpo')
  const [inHome, setInHome] = useState(false)
  const [latoAperto, setLatoAperto] = useState(true)
  const [comandiAperti, setComandiAperti] = useState(false)
  const [mostraAccesso, setMostraAccesso] = useState(false)
  const [daEliminare, setDaEliminare] = useState<DaEliminare | null>(null)
  const [copertinaDi, setCopertinaDi] = useState<Quaderno | null>(null)
  const rifEditore: RifEditore = useRef(null)

  const pannello = useSyncExternalStore(iscrivitiPannello, leggiPannello)
  const accesso = useSyncExternalStore(iscrivitiAccesso, leggiAccesso)

  // la sincronia segue l'accesso: entri e parte, esci e si ferma
  useEffect(() => {
    if (accesso.utente) accendiSincronia()
    else spegniSincronia()
  }, [accesso.utente])

  /*  Poco dopo l'accesso, una passata su tutti i documenti: quelli
   *  che non apri da settimane devono arrivare sul server lo stesso,
   *  altrimenti il backup copre solo ciò che hai toccato. */
  const elenco = documenti.map((d) => d.id).join(',')
  useEffect(() => {
    if (!accesso.utente || !elenco) return
    const fra = setTimeout(() => void allineaTutto(elenco.split(',')), 2500)
    return () => clearTimeout(fra)
  }, [accesso.utente, elenco])

  const apri = useCallback((id: string, dove: Fuoco = 'corpo') => {
    setApertoId(id)
    setFuoco(dove)
    setInHome(false)
  }, [])

  useEffect(() => esponi({ apri }), [apri])

  const chiudiComandi = useCallback(() => {
    setComandiAperti(false)
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

  // ⌘\ barra · ⌘K palette · ⌘/ immagini
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '\\') { e.preventDefault(); setLatoAperto((v) => !v) }
      else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setComandiAperti((v) => !v) }
      else if (e.key === '/') { e.preventDefault(); apriPannello(!leggiPannello().aperto) }
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [])

  async function eliminaDavvero() {
    const cosa = daEliminare
    setDaEliminare(null)
    if (!cosa) return
    if (cosa.tipo === 'pagina') await eliminaDocumento(cosa.documento.id)
    else await eliminaQuaderno(cosa.quaderno.id)
  }

  const aperto = documenti.find((d) => d.id === apertoId) ?? null
  const materiaAperta = aperto ? quaderni.find((q) => q.id === aperto.quadernoId) ?? null : null
  const mostraHome = inHome || !aperto

  return (
    <>
      <Guscio
        latoAperto={latoAperto}
        destra={!mostraHome && pannello.aperto ? <PannelloImmagini rifEditore={rifEditore} /> : undefined}
        lato={
          <BarraLaterale
            quaderni={quaderni}
            documenti={documenti}
            apertoId={apertoId}
            inHome={mostraHome}
            onApri={apri}
            onHome={() => setInHome(true)}
            onAccedi={() => setMostraAccesso(true)}
            onEliminaPagina={(d) => setDaEliminare({ tipo: 'pagina', documento: d })}
            onEliminaMateria={(q) => setDaEliminare({ tipo: 'materia', quaderno: q })}
          />
        }
        centro={
          mostraHome ? (
            <Home
              quaderni={quaderni}
              documenti={documenti}
              onApri={apri}
              onCopertina={setCopertinaDi}
              onElimina={(q) => setDaEliminare({ tipo: 'materia', quaderno: q })}
            />
          ) : (
            <div className={s.colonna}>
              <BarraSuperiore
                quaderno={materiaAperta}
                documento={aperto!}
                pannelloAperto={pannello.aperto}
                rifEditore={rifEditore}
                onHome={() => setInHome(true)}
                onPannello={() => apriPannello(!pannello.aperto)}
                onElimina={() => setDaEliminare({ tipo: 'pagina', documento: aperto! })}
              />
              <Editor documento={aperto!} fuoco={fuoco} rifEditore={rifEditore} />
              <Striscia documentoId={aperto!.id} />
              <Revisione key={aperto!.id} rifEditore={rifEditore} />
            </div>
          )
        }
      />

      {mostraAccesso && <FinestraAccesso onChiudi={() => setMostraAccesso(false)} />}

      {copertinaDi && (
        <SceltaCopertina quaderno={copertinaDi} onChiudi={() => setCopertinaDi(null)} />
      )}

      {daEliminare && (
        <Conferma
          titolo={
            daEliminare.tipo === 'pagina'
              ? `Eliminare «${daEliminare.documento.titolo || 'Senza titolo'}»?`
              : `Eliminare la materia «${daEliminare.quaderno.nome || 'Senza nome'}»?`
          }
          dettaglio={
            daEliminare.tipo === 'pagina'
              ? 'Spariscono il testo e le immagini della pagina, qui e sul server. Non si torna indietro.'
              : `Spariscono la materia, le sue ${
                  documenti.filter((d) => d.quadernoId === daEliminare.quaderno.id).length
                } pagine e tutte le loro immagini, qui e sul server. Non si torna indietro.`
          }
          onConferma={() => void eliminaDavvero()}
          onAnnulla={() => setDaEliminare(null)}
        />
      )}

      {comandiAperti && (
        <Comandi quaderni={quaderni} documenti={documenti} onApri={apri} onChiudi={chiudiComandi} />
      )}
    </>
  )
}
