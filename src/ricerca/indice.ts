import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { giaAperto } from '../documento/archivio'
import type { Documento, Quaderno } from '../documento/tipi'
import { normalizza } from '../lib/testo'
import { esponi } from '../lib/dev'
import { tr } from '../lingua/lingua'

/*  La ricerca legge il testo direttamente dai documenti Yjs salvati
 *  in IndexedDB, senza un indice separato da tenere allineato.
 *
 *  La cache è chiusa a chiave sul timestamp di modifica: se il
 *  documento cambia, la voce non combacia più e viene riletta. Niente
 *  invalidazione manuale, niente indice che si disallinea in silenzio. */

const CAMPO = 'contenuto'

type Voce = { testo: string; modificato: number }
const cache = new Map<string, Voce>()

function raccogli(nodo: Y.XmlFragment | Y.XmlElement, out: string[]) {
  for (const figlio of nodo.toArray()) {
    if (figlio instanceof Y.XmlText) {
      for (const d of figlio.toDelta()) {
        if (typeof d.insert === 'string') out.push(d.insert)
      }
    } else if (figlio instanceof Y.XmlElement) {
      raccogli(figlio, out)
      out.push('\n')
    }
  }
}

function estrai(doc: Y.Doc) {
  const out: string[] = []
  raccogli(doc.getXmlFragment(CAMPO), out)
  return out.join('').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
}

async function testoDi(id: string, modificato: number): Promise<string> {
  const salvata = cache.get(id)
  if (salvata && salvata.modificato === modificato) return salvata.testo

  // se il documento è già aperto nell'editor si legge quello,
  // altrimenti si apre una copia usa e getta e si richiude
  const aperto = giaAperto(id)
  let testo: string

  if (aperto) {
    await aperto.pronto
    testo = estrai(aperto.doc)
  } else {
    const doc = new Y.Doc()
    const p = new IndexeddbPersistence(`pergamena:doc:${id}`, doc)
    await p.whenSynced
    testo = estrai(doc)
    await p.destroy()
    doc.destroy()
  }

  cache.set(id, { testo, modificato })
  return testo
}

export type Risultato = {
  documentoId: string
  titolo: string
  materia: string
  frammento: string
}

function ritaglia(testo: string, pos: number, lung: number) {
  const inizio = Math.max(0, pos - 36)
  const fine = Math.min(testo.length, pos + lung + 44)
  return (
    (inizio > 0 ? '…' : '') +
    testo.slice(inizio, fine).replace(/\n/g, ' · ') +
    (fine < testo.length ? '…' : '')
  )
}

export async function cercaNelContenuto(
  query: string,
  documenti: Documento[],
  quaderni: Quaderno[],
  limite = 8,
): Promise<Risultato[]> {
  const q = normalizza(query.trim())
  if (q.length < 2) return []

  const nomeMateria = (id: string) => quaderni.find((k) => k.id === id)?.nome || tr('Senza nome')
  const esiti: Risultato[] = []

  for (const d of documenti) {
    if (esiti.length >= limite) break
    const testo = await testoDi(d.id, d.modificato)
    const pos = normalizza(testo).indexOf(q)
    if (pos < 0) continue
    esiti.push({
      documentoId: d.id,
      titolo: d.titolo || tr('Senza titolo'),
      materia: nomeMateria(d.quadernoId),
      frammento: ritaglia(testo, pos, q.length),
    })
  }

  return esiti
}

esponi({ ricerca: { cercaNelContenuto, cache } })
