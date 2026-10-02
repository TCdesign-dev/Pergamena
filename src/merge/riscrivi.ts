import type { Editor } from '@tiptap/core'
import type * as Y from 'yjs'
import { blocchiDi } from './applica'
import { daMarcatura, istruzioniDiStile, stileDellaPagina } from './marcatura'
import { trovaBuchi } from './buchi'
import { trattiDi } from './merge'
import { leggiRegistrazioni } from '../registrazione/registrazione'
import { chiediJson } from '../lib/modello'
import { esponi } from '../lib/dev'
import { tr } from '../lingua/lingua'

/*  Rifare la pagina.
 *
 *  L'integratore e il riempitore lavorano per punti: una riga qui, un
 *  paragrafo là. Su una lezione in cui sei rimasto indietro più volte
 *  restano comunque appunti a pezzi, con i titoli dove capita. Questo
 *  invece rifà la pagina intera: i titoli dove vanno, le tue righe
 *  nell'ordine giusto, e scritto ciò che mancava.
 *
 *  ── Le tue parole non passano dal modello ───────────────────────
 *
 *  È la regola su cui è costruito tutto il resto. Il modello non
 *  riscrive le tue righe: le CHIAMA per id. «Metti qui la B12» — e la
 *  B12 viene copiata dal documento com'era, con il suo grassetto, i
 *  suoi colori, le sue formule. Non può cambiarle perché non le
 *  riscrive: le sposta e basta.
 *
 *  Quello che aggiunge lui porta il segno dell'AI, come ogni proposta,
 *  e si rivede riga per riga prima di restare.
 *
 *  ── Niente si perde ─────────────────────────────────────────────
 *
 *  Se una tua riga non compare nella scaletta che torna — il modello
 *  l'ha dimenticata — non sparisce: finisce in fondo, nell'ordine in
 *  cui stava. Meglio una pagina con una coda strana che una riga di
 *  appunti persa. */

export type EsitoRiscrittura = {
  /** righe tue ricollocate */
  tue: number
  /** righe scritte dall'AI, da rivedere */
  nuove: number
  /** righe tue che il modello non ha ricollocato, rimesse in fondo */
  inCoda: number
  costo: number
}

const SEGNO_AI = [{ type: 'segnoAi', attrs: { fonte: 'audio', stato: 'proposto' } }]

type Voce =
  | { id: string }
  | { tipo: 'titolo' | 'sottotitolo' | 'riga' | 'voce'; testo: string }

const SISTEMA = `Rimetti in ordine gli appunti di uno studente, usando la trascrizione
della lezione a cui si riferiscono.

Ti do gli APPUNTI, riga per riga, ognuna con un id fra parentesi quadre, e
la LEZIONE. Devi restituire la pagina intera, nell'ordine in cui va letta.

LE SUE RIGHE NON SI RISCRIVONO. Per rimettere una sua riga nella pagina la
chiami per id: {"id":"B12"}. Viene copiata com'è, con la sua formattazione.
Non riscriverne il testo, non correggerla, non accorciarla: solo spostarla.

Quello che aggiungi tu è di tre tipi:
- {"tipo":"titolo","testo":"..."} — apre un argomento (un «titolo 1»).
- {"tipo":"riga","testo":"..."} — un paragrafo.
- {"tipo":"voce","testo":"..."} — una voce d'elenco puntato. Voci
  consecutive diventano un elenco solo.

Come si fa:
- TUTTE le sue righe devono comparire, una volta sola. Nessuna si butta,
  nemmeno quelle monche o fuori posto: si spostano dove hanno senso.
- Metti un titolo dove comincia un argomento, se non ce l'ha già.
- Scrivi ciò che il professore ha detto e negli appunti manca, nel punto
  in cui va letto. È il motivo per cui stai rifacendo la pagina.
- Non ripetere ciò che una sua riga dice già, neanche con altre parole.
- Ignora saluti, battute, organizzazione del corso.
- La trascrizione è automatica: nomi propri e numeri a volte sono
  storpiati. Non inventare per coprire un buco di trascrizione.
- Formule in LaTeX fra dollari; anche i soli pedici e apici sono formule:
  $\\sigma_{0,2}$, mai <sub> o <sup>.

Rispondi SOLO con un oggetto JSON:
{"pagina":[{"id":"..."},{"tipo":"titolo","testo":"..."},{"tipo":"riga","testo":"..."}]}`

const ELENCO = (nome: string) => nome === 'bulletList' || nome === 'orderedList'

/*  Ogni riga della pagina com'è adesso, per id: si ricopia, non si
 *  riscrive. Le stesse righe che il prompt elenca, una per una —
 *  altrimenti il modello chiama un id che qui non c'è, e quella riga
 *  andrebbe persa.
 *
 *  Una voce con un sottoelenco dentro si prende senza il sottoelenco, e
 *  le sue voci si contano a parte: così nessuna compare due volte.
 *  L'annidamento si perde, ma una pagina da rimettere in ordine la si
 *  rimette in ordine. */
function nodiPerId(editor: Editor) {
  const nodi = new Map<string, Record<string, unknown>>()

  const scorri = (padre: ReturnType<Editor['state']['doc']['child']> | Editor['state']['doc']) => {
    padre.forEach((n) => {
      if (ELENCO(n.type.name)) { scorri(n); return }
      const id = n.attrs.idBlocco as string | undefined
      if (n.type.name === 'listItem') {
        if (id && !nodi.has(id)) {
          const json = n.toJSON() as { content?: { type: string }[] }
          nodi.set(id, {
            ...json,
            content: (json.content ?? []).filter((c) => !ELENCO(c.type)),
          } as Record<string, unknown>)
        }
        n.forEach((figlio) => { if (ELENCO(figlio.type.name)) scorri(figlio) })
        return
      }
      //  le righe vuote non si ricollocano e non vanno in coda: sono
      //  il posto dove stavi per scrivere, non appunti
      const vuoto = n.textContent.trim() === '' && n.type.name !== 'immagine' && n.type.name !== 'blockMath'
      if (id && !vuoto && !nodi.has(id)) nodi.set(id, n.toJSON() as Record<string, unknown>)
    })
  }
  scorri(editor.state.doc)
  return nodi
}

type Tipo = 'titolo' | 'sottotitolo' | 'riga' | 'voce'

const nuovo = (tipo: Tipo, testo: string) => {
  const contenuto = daMarcatura(testo, SEGNO_AI)
  if (tipo === 'titolo') return { type: 'heading', attrs: { level: 1 }, content: contenuto }
  if (tipo === 'sottotitolo') return { type: 'heading', attrs: { level: 2 }, content: contenuto }
  if (tipo === 'voce') return { type: 'listItem', content: [{ type: 'paragraph', content: contenuto }] }
  return { type: 'paragraph', content: contenuto }
}

export async function riscriviPagina(
  editor: Editor,
  doc: Y.Doc,
  materia: string,
  avanza: (fase: 'chiedo' | 'rifaccio') => void = () => {},
): Promise<EsitoRiscrittura> {
  const lezioni = leggiRegistrazioni(doc).filter((r) => r.fine !== null && r.segmenti.length)
  if (!lezioni.length) throw new Error(tr('questa pagina non ha lezioni finite'))

  const blocchi = blocchiDi(editor)
  if (!blocchi.length) throw new Error(tr('questa pagina è vuota'))

  const tratti = lezioni.flatMap((r) => trattiDi(editor, r))
  const stile = istruzioniDiStile(stileDellaPagina(editor.state.doc))

  const appunti = blocchi
    .map((b) => `[${b.id}]${b.tipo !== 'paragrafo' ? ` (${b.tipo})` : ''} ${b.testo}`)
    .join('\n')
  const lezione = tratti.map((t) => `— ${t.testo.trim()}`).join('\n')

  /*  I tratti in cui il professore parlava e tu non stavi dietro: non
   *  si riempiono più uno per uno, ma dire alla riscrittura dove sono
   *  costa due righe e le dice dove gli appunti hanno più bisogno. */
  const buchi = lezioni.flatMap((r) => { try { return trovaBuchi(editor, r) } catch { return [] } })
  const indietro = buchi.length
    ? `QUI NON STAVA SCRIVENDO, e gli appunti hanno più bisogno:\n` +
      buchi.map((b) => `— «${b.testo.trim().slice(0, 90)}…»`).join('\n')
    : ''

  avanza('chiedo')
  const { json, costo } = await chiediJson('merge', [
    { role: 'system', content: SISTEMA },
    {
      role: 'user',
      content: `MATERIA: ${materia || 'non indicata'}\n\n` +
        (stile ? `COME SCRIVE LUI:\n${stile}\n\n` : '') +
        (indietro ? `${indietro}\n\n` : '') +
        `APPUNTI:\n${appunti}\n\nLEZIONE:\n${lezione}`,
    },
  ], { maxToken: 12000 })

  const pagina = (Array.isArray(json.pagina) ? json.pagina : []) as Voce[]
  if (!pagina.length) throw new Error(tr('il modello non ha restituito una pagina'))

  avanza('rifaccio')
  const nodi = nodiPerId(editor)
  const usati = new Set<string>()
  const fuori: Record<string, unknown>[] = []
  let elenco: Record<string, unknown>[] = []

  const chiudiElenco = () => {
    if (!elenco.length) return
    fuori.push({ type: 'bulletList', content: elenco })
    elenco = []
  }

  let tue = 0
  let nuove = 0

  for (const v of pagina) {
    const id = (v as { id?: unknown }).id
    if (typeof id === 'string') {
      const nodo = nodi.get(id)
      if (!nodo || usati.has(id)) continue
      usati.add(id)
      tue++
      if ((nodo as { type?: string }).type === 'listItem') elenco.push(nodo)
      else { chiudiElenco(); fuori.push(nodo) }
      continue
    }
    const { tipo, testo } = v as { tipo?: string; testo?: unknown }
    if (typeof testo !== 'string' || !testo.trim()) continue
    if (tipo !== 'titolo' && tipo !== 'sottotitolo' && tipo !== 'riga' && tipo !== 'voce') continue
    nuove++
    const blocco = nuovo(tipo, testo.trim())
    if (tipo === 'voce') elenco.push(blocco as Record<string, unknown>)
    else { chiudiElenco(); fuori.push(blocco as Record<string, unknown>) }
  }
  chiudiElenco()

  /*  Le righe che il modello si è dimenticato: in fondo, nell'ordine in
   *  cui stavano. Una pagina con una coda strana si sistema; una riga di
   *  appunti persa no. */
  const dimenticate = [...nodi.keys()].filter((id) => !usati.has(id))
  if (dimenticate.length) {
    let coda: Record<string, unknown>[] = []
    for (const id of dimenticate) {
      const nodo = nodi.get(id)!
      if ((nodo as { type?: string }).type === 'listItem') coda.push(nodo)
      else {
        if (coda.length) { fuori.push({ type: 'bulletList', content: coda }); coda = [] }
        fuori.push(nodo)
      }
    }
    if (coda.length) fuori.push({ type: 'bulletList', content: coda })
  }

  /*  In una transazione sola: ⌘Z riporta indietro la pagina intera, non
   *  una riga per volta. */
  editor.chain().setContent({ type: 'doc', content: fuori }).run()

  return { tue, nuove, inCoda: dimenticate.length, costo }
}

esponi({ riscrivi: { riscriviPagina } })
