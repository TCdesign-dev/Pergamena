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
├── editor/
│   ├── Editor.tsx       colonna di scrittura + titolo + gestione del fuoco
│   ├── estensioni/
│   │   ├── index.ts     l'elenco: aggiungere una funzione = aggiungere una riga
│   │   ├── idStabile.ts ⭐ un id immutabile per ogni blocco
│   │   ├── segnoAi.ts   marca il testo che non hai scritto tu
│   │   ├── coloreTesto.ts  i cinque colori + scorciatoie
│   │   ├── frecce.ts    -> diventa →,  --> diventa ⟶
│   │   └── slash.ts     il plugin di «/» (intercetta frecce e Invio)
│   └── menu/
│       ├── MenuSelezione.tsx   compare solo selezionando: niente barra fissa
│       ├── MenuSlash.tsx       l'elenco dei blocchi
│       ├── vociSlash.ts        quali blocchi, e con che sinonimi
│       └── statoSlash.ts       lo stato condiviso fra plugin e React
│
└── layout/
    ├── Guscio.tsx       tre zone (la terza arriva in fase 2)
    ├── BarraLaterale.tsx
    └── Comandi.tsx      la palette ⌘K
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

### Fase 1b — sync e telefono · in attesa delle chiavi

Supabase e PWA **in sola lettura** da resa statica (niente editor su
mobile). Serve riempire le tre righe `VITE_SUPABASE_*` in `.env.local`.

### Fase 2 — immagini
Wikimedia Commons, sintassi `!Basilica di Superga!`, pannello laterale
con trascinamento nel testo, ridimensionamento.

### Fase 3 — registrazione e merge
- Guscio **Tauri**.
- Trascrizione **in diretta** con `SpeechTranscriber` di macOS 26
  (on-device, `it-IT` già installato, consumo basso: si registra a
  batteria senza problemi).
- **La trascrizione live è la fonte primaria.** Il merge lavora su
  quella.
- Ancore temporali del cursore: ogni 5 s si annota in quale blocco
  eri. È ciò che permette di allineare la lezione agli appunti.
- **Il merge è per singola lezione e su richiesta** — si fa in un'ora
  buca, non in un batch serale da ore.
- Salvataggio dell'audio **opzionale**: se lo tieni, si può fare una
  passata più profonda con DeepSeek, e puoi riascoltare il professore
  cliccando un blocco.
- Massimo 5-8 patch per lezione: il resto finisce in note a margine
  ripiegate. Revisione da tastiera: `J`/`K`, `↵` accetta, `X` rifiuta.

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
