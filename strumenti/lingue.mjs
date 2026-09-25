/*  Rilegge il codice, raccoglie tutte le frasi che passano da `tr()` e
 *  da `<Tr>`, e sistema i file di `lingue/`: aggiunge quelle nuove
 *  vuote, toglie quelle che nel codice non ci sono più, lascia intatto
 *  tutto il resto.
 *
 *      npm run lingue              sistema i file e dice come stanno
 *      npm run lingue -- --nuova es   comincia una lingua da zero
 *      npm run lingue -- --controlla  non scrive niente, serve alla CI
 *
 *  Le frasi restano nell'ordine in cui compaiono nel codice, file per
 *  file: chi traduce le incontra più o meno nell'ordine in cui le
 *  incontra chi usa l'app. */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const RADICE = new URL('..', import.meta.url).pathname
const CODICE = join(RADICE, 'src')
const LINGUE = join(RADICE, 'lingue')

/* ── leggere il codice ─────────────────────────────────────────────── */

//  la cartella `lingua/` è il meccanismo, non l'app: le frasi che
//  contiene sono esempi dentro i commenti
const FUORI = join(CODICE, 'lingua')

function file(cartella) {
  if (cartella === FUORI) return []
  return readdirSync(cartella, { withFileTypes: true }).flatMap((v) => {
    const via = join(cartella, v.name)
    if (v.isDirectory()) return file(via)
    return /\.tsx?$/.test(v.name) ? [via] : []
  })
}

/** La stringa che comincia in `i` (apice o virgoletta), con le fughe. */
function stringa(testo, i) {
  const apice = testo[i]
  if (apice !== "'" && apice !== '"') return null
  let fuori = ''
  for (let j = i + 1; j < testo.length; j++) {
    const c = testo[j]
    if (c === '\\') { fuori += testo[j + 1] === 'n' ? '\n' : testo[j + 1]; j++; continue }
    if (c === apice) return { testo: fuori, fine: j + 1 }
    if (c === '\n') return null
    fuori += c
  }
  return null
}

const CHIAMATE = [/\btr\(/g, /\bfrase=\{?/g]

function frasiDi(sorgente) {
  const trovate = []
  const zoppe = []
  for (const forma of CHIAMATE) {
    forma.lastIndex = 0
    for (let m; (m = forma.exec(sorgente)) !== null; ) {
      const s = stringa(sorgente, m.index + m[0].length)
      if (s) trovate.push(s.testo)
      else zoppe.push(sorgente.slice(m.index, m.index + 60).split('\n')[0])
    }
  }
  return { trovate, zoppe }
}

function raccogli() {
  const frasi = []
  const viste = new Set()
  const zoppe = []
  for (const via of file(CODICE).sort()) {
    const { trovate, zoppe: z } = frasiDi(readFileSync(via, 'utf8'))
    for (const f of trovate) if (!viste.has(f)) { viste.add(f); frasi.push(f) }
    for (const x of z) zoppe.push(`${relative(RADICE, via)}: ${x}`)
  }
  return { frasi, zoppe }
}

/* ── sistemare i file ──────────────────────────────────────────────── */

const SCHEDA_NUOVA = (codice) => ({
  nome: `(come si chiama la lingua nella lingua stessa)`,
  locale: `${codice}-${codice.toUpperCase()}`,
  ascolto: `${codice}-${codice.toUpperCase()}`,
  modello: '(in che lingua deve rispondere il modello, scritto in inglese)',
  tradotta: '(il tuo nome, se ti va)',
})

function sistema(codice, frasi, { scrivi }) {
  const via = join(LINGUE, `${codice}.json`)
  let vecchio = {}
  try { vecchio = JSON.parse(readFileSync(via, 'utf8')) } catch { /* lingua nuova */ }

  const nuovo = { _: vecchio._ ?? SCHEDA_NUOVA(codice) }
  for (const f of frasi) nuovo[f] = typeof vecchio[f] === 'string' ? vecchio[f] : ''

  const sparite = Object.keys(vecchio).filter((k) => k !== '_' && !(k in nuovo) && vecchio[k])
  const fatte = frasi.filter((f) => nuovo[f]).length
  const cambiato = JSON.stringify(nuovo) !== JSON.stringify(vecchio)
  if (scrivi && cambiato) writeFileSync(via, `${JSON.stringify(nuovo, null, 2)}\n`)

  return { codice, frasi: frasi.length, fatte, sparite, cambiato }
}

/* ── ── */

const argomenti = process.argv.slice(2)
const controlla = argomenti.includes('--controlla')
const nuova = argomenti[argomenti.indexOf('--nuova') + 1]

const { frasi, zoppe } = raccogli()
const codici = readdirSync(LINGUE).filter((n) => n.endsWith('.json')).map((n) => n.replace('.json', ''))
if (nuova && argomenti.includes('--nuova') && !codici.includes(nuova)) codici.push(nuova)

console.log(`${frasi.length} frasi nel codice.`)
if (zoppe.length) {
  console.log(`\nQueste non si possono tradurre, il testo non è lì dentro:`)
  for (const z of zoppe) console.log(`  ${z}`)
}

let daRifare = false
for (const codice of codici.sort()) {
  const r = sistema(codice, frasi, { scrivi: !controlla })
  const manca = r.frasi - r.fatte
  const pezzi = [`${r.fatte}/${r.frasi} tradotte`]
  if (manca) pezzi.push(`${manca} da fare`)
  if (r.sparite.length) pezzi.push(`${r.sparite.length} non servono più`)
  console.log(`\n${codice}.json — ${pezzi.join(', ')}${r.cambiato ? controlla ? '  ← da rigenerare' : '  ← aggiornato' : ''}`)
  for (const s of r.sparite.slice(0, 10)) console.log(`  toglie: «${s}»`)
  if (r.cambiato && controlla) daRifare = true
}

if (daRifare) {
  console.log(`\nQualche file non è aggiornato: lancia «npm run lingue» e aggiungi le modifiche.`)
  process.exit(1)
}
