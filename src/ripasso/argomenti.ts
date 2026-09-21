import * as Y from 'yjs'
import { mappaDocumenti } from '../documento/archivio'
import { leggiDocumento } from '../documento/leggi'
import type { Documento } from '../documento/tipi'

/*  Gli argomenti.
 *
 *  Un argomento non è un contenitore, è un'ancora: un TITOLO 1 e tutto
 *  quello che segue, fino al titolo 1 successivo. Una pagina tiene
 *  tante lezioni e tanti argomenti, e non si è costretti ad aprirne una
 *  nuova a ogni cambio di tema. Il testo prima del primo titolo — o una
 *  pagina senza titoli — è un argomento che porta il nome della pagina.
 *
 *  Si leggono dal documento ogni volta, niente elenco da tenere
 *  allineato: se rinomini un titolo, l'argomento si chiama così. */

export type BloccoTesto = { id: string | null; tipo: string; testo: string }

export type Argomento = {
  /** documentoId#idTitolo, oppure documentoId#pagina */
  chiave: string
  documentoId: string
  quadernoId: string
  idTitolo: string | null
  titolo: string
  pagina: string
  ordine: number
  modificato: number
  blocchi: BloccoTesto[]
}

const TIPI: Record<string, string> = {
  paragraph: 'paragrafo', heading: 'titolo', bulletList: 'elenco', orderedList: 'elenco numerato',
  blockquote: 'citazione', codeBlock: 'codice', immagine: 'immagine',
}

/** Il testo di un nodo, senza le proposte dell'AI non ancora accettate:
 *  non sono appunti tuoi finché non le accetti. */
function testo(nodo: Y.XmlElement | Y.XmlFragment, dentroElenco = false): string {
  const parti: string[] = []
  for (const figlio of nodo.toArray()) {
    if (figlio instanceof Y.XmlText) {
      for (const d of figlio.toDelta() as { insert: unknown; attributes?: Record<string, { stato?: string }> }[]) {
        if (typeof d.insert !== 'string') continue
        if (d.attributes?.segnoAi?.stato === 'proposto') continue
        parti.push(d.insert)
      }
    } else if (figlio instanceof Y.XmlElement) {
      if (figlio.nodeName === 'hardBreak') { parti.push('\n'); continue }
      if (figlio.nodeName === 'inlineMath') { parti.push(`$${String(figlio.getAttribute('latex') ?? '')}$`); continue }
      const dentro = testo(figlio, dentroElenco || figlio.nodeName === 'bulletList' || figlio.nodeName === 'orderedList')
      if (!dentro.trim()) continue
      parti.push(figlio.nodeName === 'listItem' ? `\n- ${dentro.trim()}` : dentroElenco ? ` ${dentro}` : `${dentro}\n`)
    }
  }
  return parti.join('').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
}

/** I blocchi di primo livello, col loro testo. */
export function blocchiDelDocumento(doc: Y.Doc): (BloccoTesto & { livello: number })[] {
  const blocchi: (BloccoTesto & { livello: number })[] = []
  for (const nodo of doc.getXmlFragment('contenuto').toArray()) {
    if (!(nodo instanceof Y.XmlElement)) continue
    const tipo = TIPI[nodo.nodeName] ?? 'paragrafo'
    const livello = nodo.nodeName === 'heading' ? Number(nodo.getAttribute('level')) || 1 : 0
    const id = (nodo.getAttribute('idBlocco') as string | undefined) ?? null
    const t = nodo.nodeName === 'immagine'
      ? `[immagine: ${String(nodo.getAttribute('didascalia') || 'senza didascalia')}]`
      : nodo.nodeName === 'blockMath'
        ? `$$${String(nodo.getAttribute('latex') ?? '')}$$`
        : testo(nodo)
    blocchi.push({ id, tipo: livello ? `titolo ${livello}` : tipo, testo: t, livello })
  }
  return blocchi
}

/** Gli argomenti di una pagina, nell'ordine in cui stanno. */
export function argomentiDellaPagina(doc: Y.Doc, documento: Documento): Argomento[] {
  const pagina = documento.titolo || 'Senza titolo'
  const argomenti: Argomento[] = []
  let corrente: Argomento | null = null

  const nuovo = (idTitolo: string | null, titolo: string): Argomento => ({
    chiave: `${documento.id}#${idTitolo ?? 'pagina'}`,
    documentoId: documento.id,
    quadernoId: documento.quadernoId,
    idTitolo,
    titolo,
    pagina,
    ordine: argomenti.length,
    modificato: documento.modificato,
    blocchi: [],
  })

  for (const b of blocchiDelDocumento(doc)) {
    if (b.livello === 1 && b.testo.trim()) {
      corrente = nuovo(b.id, b.testo.trim())
      argomenti.push(corrente)
      continue
    }
    if (!b.testo.trim()) continue
    if (!corrente) {
      corrente = nuovo(null, pagina)
      argomenti.push(corrente)
    }
    corrente.blocchi.push({ id: b.id, tipo: b.tipo, testo: b.testo })
  }
  // un titolo senza niente sotto non è ancora un argomento da ripassare
  return argomenti.filter((a) => a.blocchi.length > 0)
}

/** Tutti gli argomenti di una materia: prima le pagine toccate di
 *  recente, e dentro una pagina dall'ultimo argomento (di solito è
 *  l'ultima lezione) al primo. */
export async function argomentiDellaMateria(quadernoId: string): Promise<Argomento[]> {
  const pagine = [...mappaDocumenti.values()]
    .filter((d) => d.quadernoId === quadernoId && !d.scheda)
    .sort((a, b) => b.modificato - a.modificato)
  const tutti: Argomento[] = []
  for (const d of pagine) {
    const argomenti = await leggiDocumento(d.id, (doc) => argomentiDellaPagina(doc, d))
    tutti.push(...argomenti.reverse())
  }
  return tutti
}
