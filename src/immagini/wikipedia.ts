import { schedeDiFile, type Trovata } from './commons'
import { tr } from '../lingua/lingua'

/*  Wikipedia come ponte fra la tua lingua e le immagini.
 *
 *  Commons e Openverse sono indicizzati quasi solo in inglese: «cane»
 *  su Openverse dà canne da zucchero e bastoni da passeggio, «dog» dà
 *  cani. Wikipedia italiana invece sa che «cane» è Canis lupus
 *  familiaris, e sa come si chiama in inglese: da lì esce il termine
 *  giusto da cercare altrove.
 *
 *  E, gratis, esce anche l'immagine principale dell'articolo — che
 *  per un concetto di studio è quasi sempre quella che cercavi,
 *  scelta da chi l'articolo l'ha scritto. La ricerca a parole di
 *  Commons, che guarda i nomi dei file, non ci arriva: «cane» le fa
 *  tirare fuori «Cane cutters in Jamaica».
 *
 *  Nessuna chiave: le API di Wikipedia sono aperte e mandano CORS. */

const API = 'https://it.wikipedia.org/w/api.php'

type Pagina = {
  pageid: number
  title: string
  index?: number
  thumbnail?: { source: string }
  original?: { source: string }
  langlinks?: { lang: string; '*': string }[]
}

/** I termini già risolti: cercare due volte lo stesso è sprecato. */
const tradotti = new Map<string, string | null>()

const chiave = (q: string) => q.trim().toLowerCase()

async function cercaArticoli(query: string, quanti: number): Promise<Pagina[]> {
  const p = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query.trim(),
    gsrnamespace: '0',
    gsrlimit: String(quanti),
    prop: 'pageimages|langlinks',
    piprop: 'thumbnail|original',
    pithumbsize: '400',
    lllang: 'en',
    format: 'json',
    origin: '*',
  })
  const r = await fetch(`${API}?${p}`)
  if (!r.ok) throw new Error(tr('Wikipedia ha risposto {stato}', { stato: r.status }))
  const j = await r.json()
  const pagine = Object.values(j.query?.pages ?? {}) as Pagina[]
  // le pagine tornano sparpagliate: «index» è l'ordine della ricerca
  return pagine.sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
}

/*  «Dog (disambiguation)», «Cane (film)»: la parentesi serve a
 *  Wikipedia per distinguere due articoli, a una ricerca di immagini
 *  no. */
function titoloInglese(pagina: Pagina | undefined): string | null {
  const en = pagina?.langlinks?.find((l) => l.lang === 'en')?.['*']
  return en ? en.replace(/\s*\([^)]*\)\s*$/, '').trim() || null : null
}

/*  Dal link della miniatura al nome del file su Commons:
 *    …/wikipedia/commons/thumb/d/d9/Nome.jpg/400px-Nome.jpg
 *    …/wikipedia/commons/d/d9/Nome.jpg
 *  I file caricati sulla sola Wikipedia italiana (…/wikipedia/it/…)
 *  sono copertine e loghi tenuti per citazione: non si toccano. */
function fileDaUrl(url: string): string | null {
  const m = /\/wikipedia\/commons\/(?:thumb\/)?\w\/\w{2}\/([^/?]+)/.exec(url)
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null
}

/** Le immagini principali dei primi articoli, con la scheda vera che
 *  Commons tiene per ognuna (autore e licenza compresi). */
async function immaginiDi(pagine: Pagina[], quante: number): Promise<Trovata[]> {
  const scelte: { nome: string; articolo: string }[] = []
  for (const p of pagine) {
    const nome = fileDaUrl(p.original?.source ?? p.thumbnail?.source ?? '')
    if (nome && !scelte.some((s) => s.nome === nome)) scelte.push({ nome, articolo: p.title })
    if (scelte.length >= quante) break
  }
  if (!scelte.length) return []

  const schede = await schedeDiFile(scelte.map((s) => s.nome))
  return scelte
    // il titolo dell'articolo dice cosa si vede meglio del nome del file
    .map((s) => { const t = schede.get(s.nome); return t ? { ...t, titolo: s.articolo } : null })
    .filter((t): t is Trovata => t !== null)
}

/** Il termine inglese per cercare altrove, se Wikipedia lo conosce. */
export async function termineInglese(query: string): Promise<string | null> {
  const q = chiave(query)
  if (!q) return null
  if (tradotti.has(q)) return tradotti.get(q) ?? null
  try {
    const en = titoloInglese((await cercaArticoli(q, 1))[0])
    tradotti.set(q, en)
    return en
  } catch {
    return null
  }
}

/** Le immagini degli articoli che parlano di questo, e il termine
 *  inglese: una chiamata sola, perché servono sempre insieme. */
export async function daWikipedia(query: string, quante = 3): Promise<{ inglese: string | null; immagini: Trovata[] }> {
  const pagine = await cercaArticoli(query, Math.max(quante + 3, 6))
  const inglese = titoloInglese(pagine[0])
  tradotti.set(chiave(query), inglese)
  return { inglese, immagini: await immaginiDi(pagine, quante).catch(() => []) }
}
