import { normalizza } from '../lib/testo'

/*  Le ripetizioni nelle proposte.
 *
 *  Il professore ripete («dicevo…», «riassumendo…») e il modello, se
 *  non lo si ferma, propone lo stesso dato due volte: una dal punto in
 *  cui è stato spiegato, una dal riassunto. Oppure ripropone ciò che
 *  negli appunti c'è già — o che c'è già come proposta, se integri
 *  di nuovo la stessa lezione.
 *
 *  Il prompt lo chiede, ma non basta chiederlo: qui si controlla.
 *  Il confronto è sulle parole che contano, ridotte alla radice, così
 *  «domande aperte» e «domanda aperta» sono la stessa cosa. I numeri
 *  restano interi: «4 domande» e «10 domande» NON sono lo stesso dato. */

const VUOTE = new Set([
  'della', 'delle', 'degli', 'dello', 'dalla', 'dalle', 'dagli', 'nella', 'nelle',
  'negli', 'sulla', 'sulle', 'sugli', 'alla', 'alle', 'agli', 'con', 'per', 'tra',
  'fra', 'che', 'non', 'una', 'uno', 'del', 'dei', 'gli', 'come', 'anche', 'sono',
  'essere', 'viene', 'vengono', 'questo', 'questa', 'questi', 'queste', 'quello',
  'quella', 'piu', 'molto', 'ogni', 'sua', 'suo', 'suoi', 'loro', 'cui', 'dove',
  'quando', 'poi', 'gia', 'hanno', 'deve', 'devono', 'puo', 'possono', 'cosa',
])

export function parole(testo: string): Set<string> {
  const insieme = new Set<string>()
  for (const p of normalizza(testo).split(/[^a-z0-9]+/)) {
    if (/^\d+$/.test(p)) insieme.add(p)
    else if (p.length > 2 && !VUOTE.has(p)) insieme.add(p.slice(0, 5))
  }
  return insieme
}

/** Quanta parte di `a` si ritrova in `b`, da 0 a 1. */
function dentro(a: Set<string>, b: Set<string>) {
  if (!a.size) return 1
  let comuni = 0
  for (const p of a) if (b.has(p)) comuni++
  return comuni / a.size
}

/**
 *  Toglie le proposte che dicono cose già scritte, o già dette da
 *  un'altra proposta. Fra due proposte con lo stesso dato resta la
 *  più completa; a parità, la prima (arrivano in ordine d'importanza).
 *  Le correzioni non si confrontano con gli appunti: per forza di cose
 *  somigliano al blocco che correggono.
 */
export function togliDoppioni<T extends { testo: string; tipo: string }>(proposte: T[], giaScritti: string[]): T[] {
  const scritti = giaScritti.map(parole).filter((s) => s.size)
  const tenute: { p: T; w: Set<string> }[] = []

  for (const p of proposte) {
    const w = parole(p.testo)
    if (!w.size) continue
    if (p.tipo !== 'correggi' && scritti.some((s) => dentro(w, s) >= 0.8)) continue

    const simile = tenute.find((t) => dentro(w, t.w) >= 0.7 || dentro(t.w, w) >= 0.9)
    if (!simile) tenute.push({ p, w })
    else if (w.size > simile.w.size && dentro(simile.w, w) >= 0.9) Object.assign(simile, { p, w })
  }
  return tenute.map((t) => t.p)
}
