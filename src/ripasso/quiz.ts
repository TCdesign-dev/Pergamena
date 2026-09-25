import { chiediJson } from '../lib/modello'
import { leggiDocumento } from '../documento/leggi'
import { leggiRegistrazioni } from '../registrazione/voci'
import { allinea } from '../merge/allinea'
import { blocchiDelDocumento, type Argomento, type BloccoTesto } from './argomenti'
import { esponi } from '../lib/dev'
import { comeRispondere, tr } from '../lingua/lingua'

/*  I quiz di ripasso.
 *
 *  Le domande nascono dagli appunti — e, per un argomento solo, anche
 *  dai passi della lezione registrata che gli corrispondono (le àncore
 *  dicono quale pezzo di lezione sta sotto quale blocco). Ogni domanda
 *  dice da quale blocco viene: a fine quiz, per ogni errore, si salta
 *  al punto degli appunti da rileggere.
 *
 *  Al modello i blocchi arrivano con un nome corto (B1, B2…) invece
 *  degli id veri: fra pagine diverse gli id si confondono, e i nomi
 *  corti costano meno. */

export type Fonte = { documentoId: string; idBlocco: string }

export type Domanda =
  | { tipo: 'scelta'; testo: string; opzioni: string[]; giusta: number; spiegazione: string; fonte: Fonte | null }
  | { tipo: 'aperta'; testo: string; risposta: string; fonte: Fonte | null }

export type Ambito =
  | { tipo: 'argomenti'; titolo: string; materia: string; argomenti: Argomento[]; chiaveEsito: string }
  | { tipo: 'selezione'; titolo: string; materia: string; documentoId: string; blocchi: BloccoTesto[] }

const TETTO_APPUNTI = 30_000   // caratteri
const TETTO_LEZIONE = 6_000

const SISTEMA = `Sei un tutor che prepara un quiz di ripasso per uno studente universitario.
Usi SOLO il materiale che ricevi: i suoi appunti e, se ci sono, passi della lezione.

Regole:
- Chiedi ciò che serve all'esame: definizioni, cause ed effetti, differenze,
  numeri, date e nomi che contano. Niente domande banali o sulla forma del testo.
- Circa due terzi a scelta multipla: 4 opzioni, una sola giusta, distrattori
  plausibili e della stessa lunghezza della risposta giusta.
- Le altre aperte: la risposta attesa in una o due frasi.
- Ogni domanda indica in "fonte" il blocco degli appunti su cui si basa (B1, B2…).
  I nomi dei blocchi servono SOLO lì: mai scriverli nelle domande, nelle
  risposte o nelle spiegazioni.
- "spiegazione": una frase che dice perché la risposta giusta è giusta.
- Se il materiale basta per meno domande di quelle chieste, fanne meno.
  Mai inventare fatti che nel materiale non ci sono.
- Scrivi in modo semplice.

Rispondi SOLO con un oggetto JSON:
{"domande":[
 {"tipo":"scelta","testo":"...","opzioni":["...","...","...","..."],"giusta":0,"spiegazione":"...","fonte":"B3"},
 {"tipo":"aperta","testo":"...","risposta":"...","fonte":"B7"}
]}`

type Riferimenti = Map<string, Fonte>

/** Gli appunti come li legge il modello, con i nomi corti dei blocchi. */
function appunti(gruppi: { titolo: string; pagina?: string; documentoId: string; blocchi: BloccoTesto[] }[], rif: Riferimenti) {
  const righe: string[] = []
  let lunghezza = 0
  let n = 0
  for (const g of gruppi) {
    if (lunghezza > TETTO_APPUNTI) break
    const testa = `## ${g.titolo}${g.pagina && g.pagina !== g.titolo ? ` (pagina «${g.pagina}»)` : ''}`
    righe.push(testa)
    for (const b of g.blocchi) {
      if (lunghezza > TETTO_APPUNTI) break
      const nome = `B${++n}`
      if (b.id) rif.set(nome, { documentoId: g.documentoId, idBlocco: b.id })
      const riga = `[${nome}] ${b.testo}`
      righe.push(riga)
      lunghezza += riga.length
    }
  }
  return righe.join('\n')
}

/** I passi delle lezioni registrate che stanno sotto i blocchi di un
 *  argomento. Le righe vuote valgono per la riga piena di sopra, come
 *  nel merge. */
async function passiDellaLezione(a: Argomento): Promise<string> {
  const dentro = new Set([a.idTitolo, ...a.blocchi.map((b) => b.id)].filter(Boolean))
  return leggiDocumento(a.documentoId, (doc) => {
    const verso = new Map<string, string | null>()
    let ultimoPieno: string | null = null
    for (const b of blocchiDelDocumento(doc)) {
      if (!b.id) continue
      if (b.testo.trim()) ultimoPieno = b.id
      verso.set(b.id, b.testo.trim() ? b.id : ultimoPieno)
    }
    const passi: string[] = []
    for (const r of leggiRegistrazioni(doc)) {
      const tratti = allinea(r.segmenti, r.ancore.map((x) => ({ t: x.t, blocco: verso.get(x.blocco) ?? null })))
      for (const t of tratti) if (t.blocco && dentro.has(t.blocco)) passi.push(t.testo.trim())
    }
    return passi.join('\n').slice(0, TETTO_LEZIONE)
  })
}

/** I nomi dei blocchi che il modello lascia scappare nel testo
 *  («come indicato in B2», «(B1)») diventano «negli appunti». */
function senzaNomiDeiBlocchi(t: string) {
  return t
    .replace(/\s*\(\s*B\d+(?:\s*(?:,|e)\s*B\d+)*\s*\)/g, '')
    .replace(/\b(?:in|nel|nei|dal|dai|nel blocco|nei blocchi)\s+B\d+(?:\s*(?:,|e)\s*B\d+)*/g, 'negli appunti')
    .replace(/\bB\d+\b/g, 'gli appunti')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Le opzioni si rimescolano qui: i modelli tendono a mettere la
 *  risposta giusta sempre al primo posto. */
function mescola(d: Extract<Domanda, { tipo: 'scelta' }>): Domanda {
  const ordine = d.opzioni.map((_, i) => i)
  for (let i = ordine.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ordine[i], ordine[j]] = [ordine[j], ordine[i]]
  }
  return { ...d, opzioni: ordine.map((i) => d.opzioni[i]), giusta: ordine.indexOf(d.giusta) }
}

export async function preparaQuiz(ambito: Ambito, quante: number): Promise<Domanda[]> {
  const rif: Riferimenti = new Map()
  let materiale: string
  if (ambito.tipo === 'argomenti') {
    materiale = appunti(ambito.argomenti.map((a) => ({ ...a })), rif)
    // per un argomento solo c'è spazio anche per la lezione
    if (ambito.argomenti.length === 1) {
      const passi = await passiDellaLezione(ambito.argomenti[0]).catch(() => '')
      if (passi) materiale += `\n\nDALLA LEZIONE (trascrizione automatica, può storpiare nomi e numeri):\n${passi}`
    }
  } else {
    materiale = appunti([{ titolo: ambito.titolo, documentoId: ambito.documentoId, blocchi: ambito.blocchi }], rif)
  }
  if (!rif.size) throw new Error(tr('negli appunti non c’è ancora abbastanza testo per un quiz'))

  const { json } = await chiediJson('quiz', [
    { role: 'system', content: `${SISTEMA}\n\n${comeRispondere()}` },
    { role: 'user', content: `MATERIA: ${ambito.materia || 'non indicata'}\nDOMANDE: ${quante}\n\nAPPUNTI:\n${materiale}` },
  ], { maxToken: 5000 })

  const grezze = Array.isArray(json.domande) ? json.domande as Record<string, unknown>[] : []
  const domande: Domanda[] = []
  for (const g of grezze) {
    const testo = senzaNomiDeiBlocchi(String(g.testo ?? ''))
    const fonte = rif.get(String(g.fonte ?? '')) ?? null
    if (!testo) continue
    if (g.tipo === 'scelta' && Array.isArray(g.opzioni) && g.opzioni.length >= 2) {
      const opzioni = g.opzioni.map((o) => senzaNomiDeiBlocchi(String(o))).slice(0, 4)
      const giusta = Number(g.giusta)
      if (!Number.isInteger(giusta) || giusta < 0 || giusta >= opzioni.length) continue
      domande.push(mescola({ tipo: 'scelta', testo, opzioni, giusta, spiegazione: senzaNomiDeiBlocchi(String(g.spiegazione ?? '')), fonte }))
    } else if (g.tipo === 'aperta' && String(g.risposta ?? '').trim()) {
      domande.push({ tipo: 'aperta', testo, risposta: senzaNomiDeiBlocchi(String(g.risposta)), fonte })
    }
  }
  if (!domande.length) throw new Error(tr('il modello non ha preparato domande utilizzabili: riprova'))
  return domande.slice(0, quante)
}

esponi({ quiz: { preparaQuiz } })
