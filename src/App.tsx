import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useIndice } from './documento/useIndice'
import { apriDocumento, eliminaDocumento, eliminaQuaderno, mappaDocumenti, soloPagine } from './documento/archivio'
import type { Quaderno, Documento } from './documento/tipi'
import { Guscio } from './layout/Guscio'
import { BarraLaterale } from './layout/BarraLaterale'
import { Rotaia } from './layout/Rotaia'
import { useLargo, useStretto } from './layout/larghezza'
import { BarraSuperiore } from './layout/BarraSuperiore'
import { Home } from './layout/Home'
import { Conferma } from './layout/Conferma'
import { SceltaCopertina } from './layout/SceltaCopertina'
import { Editor, type Fuoco, type RifEditore } from './editor/Editor'
import { Comandi } from './layout/Comandi'
import { esponi } from './lib/dev'
import { PannelloImmagini } from './layout/PannelloImmagini'
import { Impostazioni } from './layout/Impostazioni'
import { apriImpostazioni } from './layout/statoImpostazioni'
import { corrisponde } from './tastiera/scorciatoie'
import { PannelloLezioni } from './registrazione/PannelloLezioni'
import { apriLezioni, iscrivitiLezioni, leggiLezioni } from './registrazione/statoLezioni'
import { apriCommenti, iscrivitiCommenti, leggiCommenti } from './commenti/statoPannello'
import { PannelloCommenti } from './commenti/PannelloCommenti'
import { apriDomande, iscrivitiDomande, leggiDomande } from './domande/statoPannello'
import { PannelloDomande } from './domande/PannelloDomande'
import { iscrivitiPannello, leggiPannello, apriPannello } from './immagini/statoPannello'
import { FinestraAccesso } from './sync/FinestraAccesso'
import { iscrivitiAccesso, leggiAccesso } from './sync/accesso'
import { accendiSincronia, spegniSincronia } from './sync/sincronia'
import { allineaTutto } from './sync/allineaTutto'
import { Striscia } from './registrazione/Striscia'
import { chiudiOrfane, recuperaInterrotte, riprendiSeInCorso } from './registrazione/registrazione'
import { Revisione } from './merge/Revisione'
import { SchedaMateria } from './materia/SchedaMateria'
import { RipassoMateria } from './ripasso/RipassoMateria'
import { FinestraQuiz } from './ripasso/FinestraQuiz'
import { registraApertura } from './layout/navigazione'
import { Archivio } from './archivio/Archivio'
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
  const [schedaAperta, setSchedaAperta] = useState<string | null>(null)   // id della materia
  const [ripassoAperto, setRipassoAperto] = useState<string | null>(null) // id della materia
  const [archivioAperto, setArchivioAperto] = useState(false)
  /*  La barra laterale: da larghi è aperta o chiusa (rotaia) come
   *  scegli tu con ⌘\, e la scelta resta; da stretti c'è sempre la
   *  rotaia, e ⌘\ apre la barra intera sopra il foglio. */
  const [latoAperto, setLatoAperto] = useState(true)
  const [sopraAperto, setSopraAperto] = useState(false)
  const stretto = useStretto()
  const largo = useLargo()
  const lezioniAperte = useSyncExternalStore(iscrivitiLezioni, leggiLezioni)
  const commentiAperti = useSyncExternalStore(iscrivitiCommenti, leggiCommenti)
  const domandeAperte = useSyncExternalStore(iscrivitiDomande, leggiDomande)
  const strettoRif = useRef(stretto)
  strettoRif.current = stretto
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
    // la scheda di una materia si apre nella sua vista, non come pagina
    const d = mappaDocumenti.get(id)
    setSopraAperto(false)
    if (d?.scheda) {
      setSchedaAperta(d.quadernoId)
      setInHome(false)
      return
    }
    setApertoId(id)
    setFuoco(dove)
    setInHome(false)
    setSchedaAperta(null)
    setRipassoAperto(null)
    setArchivioAperto(false)
  }, [])

  const apriScheda = useCallback((quadernoId: string) => {
    setSopraAperto(false)
    setSchedaAperta(quadernoId)
    setRipassoAperto(null)
    setArchivioAperto(false)
    setInHome(false)
  }, [])

  const apriRipasso = useCallback((quadernoId: string) => {
    setSopraAperto(false)
    setRipassoAperto(quadernoId)
    setSchedaAperta(null)
    setArchivioAperto(false)
    setInHome(false)
  }, [])

  const apriArchivio = useCallback(() => {
    setSopraAperto(false)
    setArchivioAperto(true)
    setRipassoAperto(null)
    setSchedaAperta(null)
    setInHome(false)
  }, [])

  const vaiHome = useCallback(() => {
    setSopraAperto(false)
    setInHome(true)
    setSchedaAperta(null)
    setRipassoAperto(null)
    setArchivioAperto(false)
  }, [])

  useEffect(() => esponi({ apri }), [apri])
  // il quiz e il ripasso portano a un punto degli appunti
  useEffect(() => registraApertura((id) => apri(id)), [apri])

  /*  Una registrazione rimasta a metà. Se la pagina è stata ricaricata
   *  mentre registravi, il microfono è ancora acceso: ci si ricollega.
   *  Se invece era ripartito il server, la registrazione è rimasta «in
   *  corso» per sempre: si chiude con le frasi che contiene. */
  useEffect(() => { void riprendiSeInCorso().then(recuperaInterrotte) }, [])

  const chiudiComandi = useCallback(() => {
    setComandiAperti(false)
    requestAnimationFrame(() => rifEditore.current?.commands.focus())
  }, [])

  // si riapre dove eri: nessuna schermata di benvenuto, mai
  useEffect(() => {
    const pagine = documenti.filter(soloPagine)
    if (apertoId && pagine.some((d) => d.id === apertoId)) return
    setApertoId(pagine[0]?.id ?? null)
  }, [documenti, apertoId])

  useEffect(() => {
    try { apertoId ? localStorage.setItem(ULTIMO, apertoId) : localStorage.removeItem(ULTIMO) }
    catch { /* finestra privata: pazienza */ }
  }, [apertoId])

  /*  Barra, palette, immagini, impostazioni: le combinazioni le decide
   *  il registro delle scorciatoie (si cambiano dalle Impostazioni).
   *  ⌘R sta nel pulsante della registrazione. */
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (corrisponde('barra', e)) {
        e.preventDefault()
        if (strettoRif.current) setSopraAperto((v) => !v)
        else setLatoAperto((v) => !v)
      }
      else if (corrisponde('cerca', e)) { e.preventDefault(); setComandiAperti((v) => !v) }
      else if (corrisponde('immagini', e)) { e.preventDefault(); apriPannello(!leggiPannello().aperto) }
      else if (corrisponde('impostazioni', e)) { e.preventDefault(); apriImpostazioni() }
      else if (corrisponde('chiedi', e)) { e.preventDefault(); apriDomande(!leggiDomande()) }
    }
    window.addEventListener('keydown', giu)
    return () => window.removeEventListener('keydown', giu)
  }, [])

  // allargando la finestra la barra torna al suo posto: niente resta sopra
  useEffect(() => { if (!stretto) setSopraAperto(false) }, [stretto])

  const apriBarra = () => (stretto ? setSopraAperto(true) : setLatoAperto(true))
  const chiudiBarra = () => (stretto ? setSopraAperto(false) : setLatoAperto(false))
  const chiudiSopra = useCallback(() => setSopraAperto(false), [])
  const cerca = () => { setSopraAperto(false); setComandiAperti(true) }

  async function eliminaDavvero() {
    const cosa = daEliminare
    setDaEliminare(null)
    if (!cosa) return
    if (cosa.tipo === 'pagina') await eliminaDocumento(cosa.documento.id)
    else await eliminaQuaderno(cosa.quaderno.id)
  }

  const aperto = documenti.find((d) => d.id === apertoId && !d.scheda) ?? null
  const materiaAperta = aperto ? quaderni.find((q) => q.id === aperto.quadernoId) ?? null : null
  const materiaScheda = schedaAperta ? quaderni.find((q) => q.id === schedaAperta) ?? null : null
  const materiaRipasso = ripassoAperto ? quaderni.find((q) => q.id === ripassoAperto) ?? null : null
  const mostraHome = !archivioAperto && !materiaScheda && !materiaRipasso && (inHome || !aperto)
  // quello che si sta guardando, per segnarlo nella barra e nella rotaia
  const paginaInVista = !mostraHome && !archivioAperto && !materiaScheda && !materiaRipasso && aperto ? aperto.id : null
  const materiaInVista = materiaRipasso?.id ?? materiaScheda?.id ?? (paginaInVista ? aperto!.quadernoId : null)
  const docAperto = useMemo(() => (aperto ? apriDocumento(aperto.id).doc : null), [aperto?.id])

  useEffect(() => {
    if (!aperto) return
    const { doc, pronto } = apriDocumento(aperto.id)
    void pronto.then(() => chiudiOrfane(doc))
  }, [aperto?.id])

  return (
    <>
      <Guscio
        modo={stretto || !latoAperto ? 'rotaia' : 'lato'}
        sopra={sopraAperto}
        onChiudiSopra={chiudiSopra}
        /*  Da 1200 px la colonna di destra: Lezioni, Commenti o
         *  Immagini, uno per volta. Sotto, sono tendine della barra. */
        destra={largo && !mostraHome && !archivioAperto && !materiaScheda && !materiaRipasso && docAperto && (lezioniAperte || commentiAperti || domandeAperte || pannello.aperto)
          ? lezioniAperte
            ? <PannelloLezioni key={aperto!.id} doc={docAperto} materia={materiaAperta?.nome ?? ''} rifEditore={rifEditore} modo="lato" onChiudi={() => apriLezioni(false)} />
            : domandeAperte
              ? <PannelloDomande key={aperto!.id} doc={docAperto} rifEditore={rifEditore} materia={materiaAperta?.nome ?? ''} modo="lato" onChiudi={() => apriDomande(false)} />
              : commentiAperti
                ? <PannelloCommenti key={aperto!.id} doc={docAperto} rifEditore={rifEditore} modo="lato" onChiudi={() => apriCommenti(false)} />
                : <PannelloImmagini key={aperto!.id} rifEditore={rifEditore} doc={docAperto} materia={materiaAperta?.nome ?? ''} />
          : undefined}
        rotaia={
          <Rotaia
            quaderni={quaderni}
            documenti={documenti}
            materiaInVista={materiaInVista}
            inHome={mostraHome}
            archivioAperto={archivioAperto}
            onBarra={apriBarra}
            onCerca={cerca}
            onHome={vaiHome}
            onApri={apri}
            onArchivio={apriArchivio}
            onImpostazioni={() => apriImpostazioni()}
          />
        }
        lato={
          <BarraLaterale
            quaderni={quaderni}
            documenti={documenti}
            paginaInVista={paginaInVista}
            inHome={mostraHome}
            schedaAperta={materiaScheda?.id ?? null}
            archivioAperto={archivioAperto}
            onApri={apri}
            onScheda={apriScheda}
            onRipasso={apriRipasso}
            onHome={vaiHome}
            onArchivio={apriArchivio}
            onImpostazioni={() => apriImpostazioni()}
            onCerca={cerca}
            onChiudi={chiudiBarra}
            onAccedi={() => setMostraAccesso(true)}
            onEliminaPagina={(d) => setDaEliminare({ tipo: 'pagina', documento: d })}
            onEliminaMateria={(q) => setDaEliminare({ tipo: 'materia', quaderno: q })}
          />
        }
        centro={
          archivioAperto ? (
            <Archivio onHome={vaiHome} onApri={apri} onEliminaPagina={(d) => setDaEliminare({ tipo: 'pagina', documento: d })} />
          ) : materiaRipasso ? (
            <RipassoMateria key={materiaRipasso.id} quaderno={materiaRipasso} onHome={vaiHome} />
          ) : materiaScheda ? (
            <SchedaMateria
              key={materiaScheda.id}
              quaderno={materiaScheda}
              rifEditore={rifEditore}
              onHome={vaiHome}
              onCopertina={setCopertinaDi}
            />
          ) : mostraHome ? (
            <Home
              quaderni={quaderni}
              documenti={documenti}
              onApri={apri}
              onScheda={apriScheda}
              onRipasso={apriRipasso}
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
                onHome={vaiHome}
                onScheda={apriScheda}
                onPannello={() => apriPannello(!pannello.aperto)}
                onElimina={() => setDaEliminare({ tipo: 'pagina', documento: aperto! })}
              />
              <Editor documento={aperto!} quaderno={materiaAperta} fuoco={fuoco} rifEditore={rifEditore} />
              <Striscia documentoId={aperto!.id} />
              <Revisione key={aperto!.id} rifEditore={rifEditore} />
            </div>
          )
        }
      />

      {mostraAccesso && <FinestraAccesso onChiudi={() => setMostraAccesso(false)} />}

      <Impostazioni onArchivio={apriArchivio} />

      <FinestraQuiz />

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
        <Comandi quaderni={quaderni} documenti={documenti} onApri={apri} onRipasso={apriRipasso} onArchivio={apriArchivio} onChiudi={chiudiComandi} />
      )}
    </>
  )
}
