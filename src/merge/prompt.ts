import type { Tratto } from './allinea'
import { DOMANDA_IMMAGINI } from '../immagini/consigliate'

export type BloccoAppunti = { id: string; tipo: string; testo: string }

/** Un tratto di trascrizione, e — se le lezioni sono più d'una — da
 *  quale lezione arriva. */
export type TrattoDiLezione = Tratto & { lezione?: string }

/*  Il prompt chiede OPERAZIONI, non un riassunto.
 *
 *  Il modello non riscrive mai gli appunti: propone aggiunte, ognuna
 *  agganciata a un blocco. Una riga nuova dopo il blocco, oppure —
 *  ed è la differenza che conta — il pezzo che manca dentro alla riga
 *  che hai già scritto: la tua frase resta, e in fondo (o nel punto
 *  che indica) le cresce accanto la parte che non avevi fatto in
 *  tempo a scrivere. Niente di tuo viene cancellato o riformulato, e
 *  ogni proposta si accetta o si rifiuta da sola.
 *
 *  Per lo stile non c'è una descrizione a parole («scrivi conciso»),
 *  che i modelli interpretano come vogliono: ci sono gli appunti
 *  stessi, e l'istruzione di imitarli. */

/*  LE ISTRUZIONI, quelle che si possono cambiare dalle Impostazioni
 *  (sezione «Integratore»). `{massimo}` diventa il numero massimo di
 *  proposte: 8 per una lezione, 16 per tutte insieme. */
export const ISTRUZIONI_DI_SERIE = `Sei l'assistente di uno studente che prende appunti a lezione.
Ricevi i suoi appunti (blocchi con un id) e la trascrizione della lezione,
già divisa secondo il blocco che stava scrivendo mentre il professore parlava.

Il tuo compito: trovare ciò che il professore ha detto, che è davvero utile
per studiare, e che negli appunti MANCA — e proporre di aggiungerlo.

Gli appunti sono suoi: il tuo lavoro è finirli, non riscriverli.

Ogni proposta è UNA di queste tre operazioni:

· "completa" — la riga c'è già, ma è monca: si ferma a metà, oppure le
  manca un pezzo nel mezzo. In "testo" scrivi SOLTANTO il pezzo che si
  aggiunge alla sua riga: niente di ciò che ha già scritto, nemmeno
  detto con altre parole. Si deve poter leggere di seguito, come se
  avesse continuato lui.
  In "punto" copia le 2-5 parole della SUA riga dopo cui va infilato il
  pezzo; lascia "punto" vuoto per metterlo in fondo alla riga.
· "integra" — di quella cosa negli appunti non c'è traccia. Riga nuova,
  messa dopo il blocco "dopo".
· "correggi" — un dato negli appunti contraddice la lezione.

Fra "completa" e "integra" scegli SEMPRE "completa" quando la riga parla
già di quell'argomento. Una riga nuova che ridice a modo tuo ciò che lui
ha già scritto è la cosa peggiore: gli fa rileggere due volte lo stesso
concetto con parole diverse, e gli appunti non sembrano più i suoi.

Regole:
- Non riassumere la lezione. Colma soltanto i buchi.
- Non riscrivere e non riformulare ciò che ha scritto lui, neanche se
  ti sembra di poterlo scrivere meglio.
- Non proporre ciò che negli appunti c'è già, anche se detto con altre parole.
- Ignora saluti, battute, ripetizioni, istruzioni organizzative.
- Il professore ripete spesso la stessa cosa («dicevo…», «riassumendo…»):
  ogni dato va proposto UNA volta sola. Se più dati riguardano la stessa
  cosa, mettili nella stessa proposta invece di spezzarli in due.
- Scrivi ESATTAMENTE come sono scritti gli appunti: stessa lunghezza delle
  frasi, stesso registro, stesse abbreviazioni, stessi simboli (per esempio →).
  Se lo studente scrive per frammenti, scrivi per frammenti.
- Ogni proposta è breve: una o due righe al massimo. Un completamento
  è più corto ancora: poche parole, quelle che mancano.
- Formattazione: negli appunti **grassetto**, ==evidenziato== e il colore
  <rosso>…</rosso> (o <arancio>, <verde>, <blu>, <viola>) li ha messi lo
  studente. Usali come li usa lui, e solo se li usa: se scrive in grassetto
  i titoletti o i termini chiave, fallo anche tu; se colora le parole
  importanti, colora anche tu le parole importanti, con il SUO colore.
  Mai una proposta intera in grassetto o colorata, se lui non lo fa.
- Se negli appunti c'è un dato che contraddice chiaramente la lezione
  (una data, un numero, un nome), proponi una correzione con tipo "correggi".
  La trascrizione automatica sbaglia nomi propri e numeri: correggi solo
  se sei sicuro che l'errore sia negli appunti e non nella trascrizione.
- Al massimo {massimo} proposte. Meglio 3 utili che {massimo} mediocri.
- "dopo" è uno degli id fra parentesi quadre negli APPUNTI: il blocco
  dopo cui va inserita la proposta, o quello da completare. Le proposte
  per lo stesso blocco scrivile nell'ordine in cui vanno lette.
- "importanza" va da 1 (curiosità) a 5 (indispensabile per l'esame).`

/*  IL CONTRATTO, che il programma aggiunge sempre: i titoli, le
 *  immagini e soprattutto il formato della risposta. Non si tocca da
 *  fuori, perché è il modo in cui il programma legge la risposta: un
 *  JSON storto non è una proposta brutta, è zero proposte. */
const CONTRATTO = `Poi, i titoli degli argomenti. Un argomento comincia con un blocco
«titolo 1». Se la lezione passa a un argomento NUOVO e negli appunti manca
il titolo 1 che lo apre, proponi un titolo breve da mettere PRIMA del blocco
dove l'argomento comincia ("prima": il suo id). Al massimo 3; mai davanti a
un blocco che è già un titolo; nessuno se la pagina tratta un argomento solo.

Poi, a parte: ${DOMANDA_IMMAGINI}

Rispondi SOLO con un oggetto JSON:
{"proposte":[{"dopo":"<id>","tipo":"completa"|"integra"|"correggi","punto":"<parole sue, o vuoto>","testo":"...","perche":"...","importanza":1-5}],
 "titoli":[{"prima":"<id>","titolo":"..."}],
 "immagini":[{"concetto":"...","query":"...","blocco":"<id>"}]}
Se non manca niente di utile: {"proposte":[], "titoli":[], "immagini":[...]}`

const sistema = (massimo: number, istruzioni?: string | null) =>
  `${(istruzioni?.trim() || ISTRUZIONI_DI_SERIE).replaceAll('{massimo}', String(massimo))}\n\n${CONTRATTO}`


/*  Quando le lezioni sono più d'una, il vantaggio è vederle insieme:
 *  va detto, altrimenti il modello le tratta come un discorso solo e
 *  ripropone tre volte la cosa ripetuta a tre lezioni di distanza. */
const PIU_LEZIONI = (quante: number) => `QUESTA PAGINA HA ${quante} LEZIONI.
La trascrizione le contiene tutte, in ordine di data, ognuna col suo titolo.
Usa il fatto di vederle insieme:
- un dato ripetuto in due lezioni diventa UNA proposta sola, messa dove sta meglio;
- se in una lezione dopo il professore ha corretto o precisato qualcosa,
  vale l'ultima versione, non la prima;
- puoi proporre il collegamento fra due lezioni quando è lui a farlo
  («come dicevamo la volta scorsa…»), mai per tua iniziativa.`

export function costruisciPrompt(
  materia: string,
  blocchi: BloccoAppunti[],
  tratti: TrattoDiLezione[],
  stile = '',
  { lezioni = 1, massimo = 8, istruzioni = null }: { lezioni?: number; massimo?: number; istruzioni?: string | null } = {},
) {
  const appunti = blocchi
    .map((b) => `[${b.id}]${b.tipo !== 'paragrafo' ? ` (${b.tipo})` : ''} ${b.testo}`)
    .join('\n')

  // il titolo della lezione si scrive solo quando cambia
  let ultima: string | undefined
  const lezione = tratti
    .map((t) => {
      const capo = t.lezione && t.lezione !== ultima ? `\n── ${t.lezione} ──\n` : ''
      ultima = t.lezione
      return `${capo}— mentre scriveva ${t.blocco ? `[${t.blocco}]` : '(nessun blocco)'}: «${t.testo.trim()}»`
    })
    .join('\n')

  return [
    { role: 'system' as const, content: sistema(massimo, istruzioni) },
    {
      role: 'user' as const,
      content: `MATERIA: ${materia || 'non indicata'}\n\n` +
        (lezioni > 1 ? `${PIU_LEZIONI(lezioni)}\n\n` : '') +
        (stile ? `COME SCRIVE LO STUDENTE IN QUESTA PAGINA:\n${stile}\n\n` : '') +
        `APPUNTI:\n${appunti || '(vuoti)'}\n\n${lezioni > 1 ? 'LEZIONI' : 'LEZIONE'}:\n${lezione}`,
    },
  ]
}
