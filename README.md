# Pergamena

Quaderno intelligente per appunti scolastici. Non è un clone di Notion:
è ottimizzato per **scrivere veloce a lezione** e per **completare gli
appunti dopo**, confrontandoli con quello che ha davvero detto il
professore.

---

## Avvio

```bash
nvm use            # Node 24: Vite 8 non gira sul 20 di sistema
npm install
npm run dev        # http://localhost:5180
```

`npm run check` per il controllo dei tipi.

---

## Chiavi API

Stanno **tutte** in [`.env.example`](.env.example), divise per fase, con
scritto dove prendere ognuna. Si copia in `.env.local` e si riempie solo
quello che serve alla fase corrente.

**La fase 0 non richiede nessuna chiave.** L'unica veramente
indispensabile, più avanti, è `OPENROUTER_API_KEY`: da sola copre merge,
triage e quiz.

I modelli si cambiano dal `.env`, mai dal codice.

---

## Struttura

Un file, una responsabilità. Niente file da mille righe.

```
src/
├── stili/
│   ├── token.css        tutto il progetto grafico: colori, tipografia, ritmo
│   ├── colori.ts        la tavolozza: la usano il testo E il pallino materia
│   ├── base.css         azzeramenti
│   └── editor.css       stile del CONTENUTO (selettori veri, non utility)
│
├── documento/
│   ├── tipi.ts          Quaderno · Documento · Argomento
│   ├── archivio.ts      Yjs + IndexedDB: apre, crea, rinomina, elimina
│   ├── ordinamento.ts   i tre ordini dei documenti
│   └── useIndice.ts     ponte fra Yjs e React
│
├── lib/
│   ├── testo.ts         normalizzazione per le ricerche (accenti, maiuscole)
│   └── dev.ts           la maniglia `pergamena` in console (solo in sviluppo)
│
├── ricerca/
│   ├── indice.ts        legge il testo dai documenti Yjs, cache e ricerca
│   └── useRicerca.ts    il ponte verso React, con attesa
│
├── materia/
│   ├── SchedaMateria.tsx   la vista: campi in cima, note libere sotto
│   ├── Testata.tsx         copertina, nome, campi
│   ├── Esami.tsx           le prove d'esame, una riga ciascuna
│   └── Collegamenti.tsx    i link
│
├── immagini/
│   ├── deposito.ts      i byte in IndexedDB, con attribuzione
│   ├── commons.ts       Wikimedia Commons (nessuna chiave)
│   ├── statoPannello.ts la pila delle ricerche
│   └── inserisci.ts     scarica, deposita, mette il nodo
│
├── impostazioni.ts      quello che si può spegnere
│
├── editor/
│   ├── Editor.tsx       colonna di scrittura + titolo + gestione del fuoco
│   ├── estensioni/
│   │   ├── index.ts     l'elenco: aggiungere una funzione = aggiungere una riga
│   │   ├── idStabile.ts ⭐ un id immutabile per ogni blocco
│   │   ├── segnoAi.ts   marca il testo che non hai scritto tu
│   │   ├── coloreTesto.ts  i cinque colori + scorciatoie
│   │   ├── frecce.ts    -> diventa →,  --> diventa ⟶
│   │   ├── slash.ts     il plugin di «/» (intercetta frecce e Invio)
│   │   ├── immagine.ts  il nodo, più incolla e trascina
│   │   └── richiestaImmagine.ts   la sintassi !…!
│   ├── immagine/
│   │   └── NodoImmagine.tsx    ridimensionamento e allineamento
│   └── menu/
│       ├── MenuSelezione.tsx   compare solo selezionando: niente barra fissa
│       ├── MenuSlash.tsx       l'elenco dei blocchi
│       ├── vociSlash.ts        quali blocchi, e con che sinonimi
│       └── statoSlash.ts       lo stato condiviso fra plugin e React
│
└── layout/
    ├── Guscio.tsx       tre zone (la terza arriva in fase 2)
    ├── BarraLaterale.tsx
    ├── Comandi.tsx      la palette ⌘K
    └── PannelloImmagini.tsx
```

### Le tre decisioni da cui dipende tutto il resto

**1. `idStabile` — ogni blocco ha un id che non cambia mai.**
È l'ancora di: patch dell'AI, timestamp audio, confini degli argomenti,
posizione delle immagini. Va in fase 0 per forza: aggiungerlo dopo
lascerebbe i documenti vecchi senza ancore.

**2. L'argomento non è un contenitore, è un'ancora.**
Una pagina è un canvas verticale continuo e contiene molti argomenti.
Un argomento è un *intervallo* fra due id di blocco, non una scatola —
altrimenti saresti di nuovo costretto a creare una pagina nuova a ogni
cambio di argomento. Questo fa funzionare insieme i filtri, il recap e
i quiz per argomento.

**3. Tutto è Yjs, anche l'indice.**
Sembra eccessivo in locale, ma in fase 1 fa comparire la
sincronizzazione quasi gratis, e dà un undo che non si rompe quando
l'AI scrive mentre stai scrivendo tu.

**4. I colori si salvano per nome, non in esadecimale.**
Nel documento finisce `data-colore="rosso"`, non `#c02626`. Il codice
esadecimale salvato su fondo chiaro sarebbe illeggibile in tema scuro,
e resterebbe sbagliato per sempre dentro gli appunti. Vale sia per il
colore del testo sia per il pallino delle materie. Cambiare tavolozza
è cambiare cinque token in `token.css`.

### Perché lo stato di «/» sta in uno store e non in React

Frecce e Invio devono essere consumati dal plugin di ProseMirror
*prima* che diventino spostamento del cursore o un a capo. Il plugin
però non può leggere lo stato di React. Uno store condiviso
(`statoSlash.ts`) è più semplice e meno fragile di un intreccio di
ref fra i due mondi.

### Perché il font è quello di sistema

Niente grazie, niente carta color panna: SF Pro e una scala di grigi
neutra su bianco. Gli unici colori nel documento sono quelli che ci
metti tu.

### Perché non c'è Tailwind

Il contenuto dell'editor lo genera ProseMirror: si stila per forza con
selettori veri. L'app ha una schermata sola. Quindi: token CSS +
CSS Modules, e Radix (quando servirà) solo per i comportamenti.
Il controllo visivo vale più della velocità di scrittura.

---

## Stato

### ✅ Fase 0 — editor

Canvas verticale continuo, quaderni e documenti, id stabili,
salvataggio locale, si riapre sull'ultimo documento.

| tasti | effetto |
|---|---|
| `⌘K` | palette: cerca nei titoli **e dentro agli appunti**, o crea |
| `/` | elenco dei blocchi, a inizio riga o dopo uno spazio |
| `⌘/` | apre il pannello delle immagini |
| `⌘\` | nasconde la barra laterale |

`/` non scatta in mezzo a una parola: così `12/03` resta una data e
non apre niente. Nel menu si scrive per filtrare (`elen` → i due
elenchi), frecce per scegliere, Invio o Tab per inserire, Esc per
annullare lasciando il testo com'era.

Formattazione: grassetto, corsivo, sottolineato, evidenziatore, codice,
titoli **H1–H3**, citazione, elenchi puntati e numerati con annidamento,
blocchi di codice, **cinque colori per il testo**.

Scorciatoie dei colori:

| tasti | effetto |
|---|---|
| `⌘⇧C` | colora con **l'ultimo colore usato** |
| `⌘⇧1` … `⌘⇧5` | rosso · arancio · verde · blu · viola |
| `⌘⇧0` | toglie il colore |

`⌘⇧1…5` non è un di più: senza un modo da tastiera per *cambiare*
l'ultimo colore, `⌘⇧C` ti costringerebbe a passare dal menu ogni volta
che cambi colore. L'ultimo colore usato sopravvive al riavvio, e la
«A» nel menu lo mostra sbiadito quando la selezione non è colorata —
così sai cosa farà `⌘⇧C` prima di premerlo.

Frecce automatiche (non scattano nei blocchi di codice):

| digiti | ottieni | | digiti | ottieni |
|---|---|---|---|---|
| `->` | → | | `<-` ␣ | ← |
| `-->` | ⟶ | | `<--` ␣ | ⟵ |
| `=>` | ⇒ | | `<->` ␣ | ↔ |
| `==>` | ⟹ | | `<-->` ␣ | ⟷ |

Le frecce a destra si convertono subito; quelle a sinistra alla
pressione dello spazio — altrimenti `<-` scatterebbe prima che tu
possa finire di scrivere `<->`.

### ✅ Fase 1a — ricerca e organizzazione

`⌘K` cerca anche **dentro** agli appunti, non solo nei titoli, e mostra
un'anteprima del punto trovato. Insensibile ad accenti e maiuscole.

I documenti nella barra si ordinano per **ultima modifica**, **data di
creazione** o **titolo** — si cicla dal comando sotto l'intestazione,
e la scelta resta fra una sessione e l'altra.

Non c'è un indice separato da tenere allineato: il testo si rilegge
dai documenti Yjs già in IndexedDB, con una cache chiusa a chiave sul
timestamp di modifica. Se il documento cambia, la voce non combacia
più e viene riletta — niente invalidazione manuale, niente indice che
si disallinea in silenzio.

Misurato su 64 documenti: **26 ms a freddo, 0 ms a caldo**.

### ✅ Fase 1b — sincronizzazione

Una tabella sola, un registro di aggiornamenti Yjs: non ci sono
tabelle «documenti» o «quaderni» perché quelli vivono *dentro* al Yjs
come tutto il resto. Meno schema sul server significa nessuna
migrazione quando cambia la forma degli appunti.

Prima volta: incolla `supabase/schema.sql` nel SQL Editor del
progetto. È sicuro rilanciarlo.

**Accesso: con la password.** Per un'app che usa una persona sola la
posta è solo un intralcio — l'SMTP integrato di Supabase manda poche
mail all'ora, e quando finiscono resti fuori.

L'utente si crea una volta sola dal pannello, senza mandare niente:

> *Authentication › Users › Add user › Create new user*
> email, password, e **spunta «Auto Confirm User»**

Da lì in poi si entra con email e password, sul Mac e sul telefono,
senza dipendere da un servizio di posta proprio quando sei in aula.

Restano due strade di riserva, dietro a *entra via email*: il **link**
(che i modelli predefiniti mandano, e che riporta dentro l'app) e il
**codice** a sei cifre. Per avere il codice invece del link, in
*Authentication › Email Templates* apri **Magic Link** e **Confirm
signup** e aggiungi al corpo:

```html
<p>Il tuo codice: <b>{{ .Token }}</b></p>
```

L'app accetta tutte e tre le strade senza sapere quale arriverà.

**Come viaggia.** Gli aggiornamenti si accumulano 1,5 s e si
uniscono prima di partire — senza, una lezione da un'ora sarebbe
decine di migliaia di righe. All'avvio si ricostruisce lo stato
*remoto* a parte, per spedire esattamente il delta locale invece di
rimandare tutto: è anche ciò che rende indolore lavorare offline.
Oltre le 300 righe si compatta, cancellando solo **sotto** all'id
davvero letto, così ciò che arriva nel frattempo da un altro
dispositivo sopravvive.

**Tutti i documenti, non solo quello aperto.** Poco dopo l'accesso
parte una passata su ogni documento dell'indice, uno alla volta,
aprendo e richiudendo. Senza, la copia coprirebbe solo ciò che hai
toccato: una lezione che non apri da settimane non arriverebbe mai sul
server, ed è esattamente il caso in cui un backup deve esserci.
La stessa passata, al contrario, riempie un Mac nuovo.

**Le immagini viaggiano a parte.** I byte non possono stare nel
documento Yjs, che gonfierebbe, né solo in locale. Vanno in un secchio
privato su Supabase Storage, una cartella per utente; nel documento
resta l'identificativo, e didascalia e attribuzione sono già attributi
del nodo. Se un'immagine manca in locale si ripesca dal server e si
rimette in cache, così la volta dopo è istantanea e funziona offline.

Senza chiavi l'app resta locale e funziona identica.

**Se IndexedDB si impianta** — capita: un database in stato anomalo
non risponde né con successo né con errore, tace e basta — il deposito
locale si arrende dopo 4 secondi e si ripiega sul server. Le immagini
si vedono lo stesso e se ne inseriscono di nuove. Verificato con un
database davvero bloccato, non simulato. Per rimetterlo a posto si
svuotano i dati del sito dal browser.

**Collaudato end-to-end:** scritto senza rete → la spia diventa rossa
e la modifica resta in coda; rete ripristinata → riparte da sola in
9 s; svuotato *tutto* il locale → quaderni, documenti e il testo
scritto offline tornano giù da Supabase identici.

### ✅ Fase 1c — telefono

App installabile, **in sola lettura**. Materie con le loro copertine,
pagine, lettura, e la ricerca che guarda anche dentro agli appunti.

Non è una limitazione mascherata da scelta: portare un editor a
blocchi sul touch è una settimana di lavoro e di guai con selezione e
tastiera, per un caso d'uso che non c'è — gli appunti si prendono sul
Mac, a lezione. Sul telefono serve ritrovarli.

**Stesso ProseMirror, in sola lettura.** Una pagina si vede identica a
come l'hai scritta: restano fuori solo le estensioni che servono a
scrivere (il menu «/», le frecce, la sintassi delle immagini). Un
renderer statico separato avrebbe voluto dire due schemi da tenere
allineati, e prima o poi due rese diverse.

**Caricamento diviso.** Il telefono non scarica palette, pannello
immagini e scelta copertine: `main.tsx` importa il guscio giusto in
modo pigro. La soglia è la larghezza (720px), non il tipo di
dispositivo, così una finestra stretta sul Mac prende comunque quello
che ci sta meglio.

Il service worker tiene in cache il guscio: dopo la prima apertura
parte anche senza rete. Gli appunti non passano di lì — vivono in
IndexedDB e li gestisce Yjs.

L'icona è un segnaposto: `public/icona.svg`. Per l'aggiunta alla
schermata Home di iOS ci vuole un PNG, ed è una decisione di design,
non mia.

### ✅ Fase 2 — immagini

`⌘/` apre il pannello a destra. Si cerca a mano, oppure si scrive
`!Basilica di Superga!` negli appunti e la ricerca parte da sola — i
punti esclamativi spariscono, **la frase resta**, perché è una frase
dei tuoi appunti e non un comando. Si spegne dal pannello.

Le immagini **non entrano mai da sole nel testo**: arrivano nel
pannello e le trascini tu. Durante una lezione un'immagine che si
infila da sola in mezzo a un paragrafo è un disastro.

Una volta nel documento: ridimensionamento dalla maniglia, tre
allineamenti (piena larghezza, a sinistra o a destra col testo che
scorre accanto). Si inseriscono anche incollandole e trascinandole dal
Finder.

**Due schede.** *Cercate* sono le ricerche tue — a mano o con
`!parola!` — dodici risultati da cui scegli, e l'immagine va dove la
trascini. *Consigliate* sono i concetti che secondo l'AI meritano
un'immagine: ogni consiglio è agganciato al passo degli appunti che lo
nomina (la citazione ci riporta lì), quindi sa già dove andare —
*Metti sotto il paragrafo*, anche se stai scrivendo altrove. Una foto
in evidenza e tre alternative invece di una griglia: la scelta l'AI
l'ha già fatta. Un consiglio aperto alla volta, gli altri su una riga.

I consigli arrivano **mai mentre scrivi**: con il merge, nella stessa
chiamata, oppure dal pulsante *Suggerisci immagini*. Dopo un merge con
consigli nuovi il pannello si apre da solo sulle Consigliate. *Non
serve* se lo ricorda la pagina (i consigli vivono nel suo documento
Yjs): un concetto scartato non torna, nemmeno chiedendone altri.

Tre decisioni dietro a questa fase:

**I byte si copiano, non si collegano.** Un link a Commons prima o poi
marcisce, e senza connessione non vedresti più niente mentre ripassi.
Le immagini vivono in IndexedDB con la loro attribuzione, che per la
licenza di Commons è un obbligo.

**Un'immagine non viene mai ingrandita oltre la sua risoluzione.**
Una foto da 500px portata a tutta colonna diventa sfocata, e fra due
mesi non capisci perché. La larghezza iniziale la decide la
risoluzione vera.

**Il trascinamento si aggancia al confine del blocco.** `posAtCoords`
dà il punto esatto sotto al puntatore, che di solito è in mezzo a un
paragrafo: inserire lì un blocco lo spezza e lascia un paragrafo
vuoto. L'immagine va sopra o sotto al blocco, secondo la metà in cui
hai lasciato la presa.

### ✅ Fase 3 — registrazione e merge

**Registra** nella barra in alto. Il microfono lo ascolta
`pergamena-ascolto`, un piccolo programma nativo che trascrive in
italiano con `SpeechTranscriber` di macOS 26 — sul Mac, senza mandare
l'audio da nessuna parte. La prima volta macOS chiede il permesso del
microfono per l'app da cui hai lanciato `npm run dev`.

```
nativo/ascolto/       il programma nativo (Swift)  ─┐  righe JSON
server/ascolto.ts     lo lancia, gira le righe      ├─ Server-Sent Events
src/registrazione/    le scrive nel documento      ─┘
src/merge/            allineamento, prompt, proposte, revisione
server/llm.ts         proxy verso OpenRouter: la chiave non va nel browser
```

`npm run dev` lo compila da solo se manca (`npm run ascolto` per
ricompilarlo).

**Dove finisce la lezione.** Dentro al documento Yjs della pagina, in
una mappa separata dal testo: si sincronizza col resto, si cancella
con la pagina, l'editor non la vede. I segmenti entrano man mano che
il riconoscitore li chiude — se il Mac si spegne a metà, fino a lì è
salvo.

**Le àncore.** Ogni 5 secondi, se il cursore è passato a un altro
blocco, si annota «al secondo *t* stavo scrivendo qui». È ciò che
permette di sapere quale pezzo di lezione corrisponde a quale pezzo di
appunti — con 4 secondi di ritardo, perché si scrive *dopo* aver
sentito.

**Il merge** è una chiamata sola per lezione (col tetto delle chiamate
gratuite, tre separate avrebbero fatto sei lezioni al giorno). Il
modello non riscrive mai gli appunti: propone **aggiunte**, ognuna
agganciata al blocco dopo cui va, e prende la forma del posto in cui
va — dopo un elenco diventa una voce di quell'elenco. Per lo stile non
c'è una descrizione a parole: ci sono gli appunti stessi, e
l'istruzione di imitarli.

**La revisione** è una modalità, e va dichiarata: `J` `K` scorrono,
`↵` accetta, `X` rifiuta, `⌘↵` accetta tutte, `esc` esce. Fuori dalla
revisione quei tasti tornano a scrivere. Il testo accettato resta
riconoscibile, sottolineato a puntini.

**Lezioni** nella barra: trascrizioni, merge, riascolto dal minuto
cliccato (se l'audio è salvato), eliminazione. L'audio è spento di
partenza — circa 17 MB l'ora in AAC 32 kbps, e il disco è al 97%.

**Il microfono.** Il programma ascolta il microfono di sistema, ma dice
da quale — e se per 6 secondi non sente niente lo scrive nella
striscia. Sul Mac di sviluppo il microfono «di sistema» era BlackHole,
un ingresso virtuale: timer che correva, silenzio registrato. Dal
pannello Lezioni si sceglie il microfono; i virtuali stanno in fondo.
La prima volta macOS chiede il permesso a nome di **pergamena-ascolto**:
il programma si rilancia rinunciando alla responsabilità ereditata,
altrimenti — lanciato da un server avviato con responsabilità già
rinunciata, come fa l'app Claude — macOS negava in silenzio.

**Le chiamate al modello** hanno un tempo massimo (90 s il merge) e un
secondo tentativo, e OpenRouter preferisce i fornitori veloci: lo
stesso modello gira su decine di fornitori, e uno ha tenuto un merge
aperto per più di due minuti e mezzo.

**La revisione vale finché la selezione è sulla proposta.** Se clicchi
altrove nel testo stai scrivendo, e Invio torna ad andare a capo.

Collaudato su una lezione sintetizzata con la voce Alice:

| | |
|---|---|
| trascrizione | 28,6 s di audio in 2 s; 4 segmenti con tempi per parola |
| merge (DeepSeek V4 Flash) | 3 proposte giuste, 22 s, **0,00043 $** |
| proposte | «costruita 1717-1731 come ex voto dopo assedio 1706» dopo il paragrafo di Superga; «recinzione delle terre» come voce dell'elenco dei fattori |
| audio | AAC mono 16 kHz, 34,1 s, riascolto dal secondo 20 |

Da verificare su una lezione vera: i **nomi propri**. «Juvarra» esce
«Ivarra» o «Iubarra» anche col vocabolario di contesto — ma a
pronunciarlo era una voce sintetica.

### ✅ La scheda della materia

Ogni materia ha una scheda: **ⓘ** nella barra laterale e sulla
copertina in Home, oppure il nome della materia in cima a una pagina.

In cima, come le proprietà di una pagina di Notion, **pochi campi
strutturati — solo quelli che fanno qualcosa**:

- **Esami** — più prove (parziale, scritto, orale), ognuna con data e
  nota. La data diventa un conto alla rovescia sulla copertina in Home
  («Scritto fra 10 giorni», in evidenza sotto le due settimane) e un
  piccolo «10g» nella barra laterale. Le prove passate scivolano in fondo
  barrate.
- **Docente, email, ricevimento** — l'email si apre nella posta.
- **Link** — Moodle, il sito del corso: si aprono davvero anche scritti
  senza `https://`.

Sotto, **testo libero**: programma, libri, regole d'esame. È una pagina
vera, con lo stesso editor, che si sincronizza, si trova con ⌘K e se ne
va insieme alla materia — ma non compare fra le pagine degli appunti.

Le date d'esame sono giorni, non istanti: si confrontano come giorni di
calendario locali, così «domani» resta domani a qualunque ora.

Sul telefono la scheda è la prima riga dell'elenco delle pagine, in sola
lettura. Guardarla non crea niente: se la materia non ha ancora note
libere si vedono solo i campi.

### Fase 4 — argomenti, ripasso e archivio
- Titoli degli argomenti proposti a fine lezione.
- Recap degli ultimi argomenti trattati.
- Quiz su quaderno / argomento / selezione.
- **Gestore dell'archivio**: quanto occupa ogni materia, ogni lezione,
  ogni trascrizione — e cancellazione selettiva di quello che non ti
  serve più. Audio, trascrizione e appunti si eliminano separatamente.

### Fase 5 — correzioni in diretta
Confronto fra quello che scrivi e quello che il professore ha appena
detto, su una finestra di ~90 s. Si parte da **date, numeri e nomi**:
è la categoria che la trascrizione azzecca di più e che serve di più.
Segno discreto a margine, mai modifiche automatiche al testo.

---

## Nota di collaudo

Le regole di input di ProseMirror (`# ` → titolo, `- ` → elenco) non
si possono verificare con l'automazione del browser, che inserisce
testo senza eventi di tastiera veri. In sviluppo `window.pergamena`
espone `{ editor, doc, documento }` per pilotare l'editor dalla console.

Per collaudare le regole di input (frecce, `# `, `- `) si può simulare
la digitazione vera:

```js
const { editor } = window.pergamena, view = editor.view
const digita = (t) => { for (const ch of t) {
  const { from, to } = view.state.selection
  if (!view.someProp('handleTextInput', f => f(view, from, to, ch)))
    view.dispatch(view.state.tr.insertText(ch, from, to))
} }
digita('causa -> effetto, poi --> conseguenza')
```
