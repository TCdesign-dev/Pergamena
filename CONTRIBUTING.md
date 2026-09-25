# Contribuire a Pergamena

*[English version below](#contributing-to-pergamena)*

## Traduzioni

L'interfaccia di Pergamena è scritta in italiano dentro il codice. Ogni
altra lingua è un file JSON in `lingue/`: la chiave è la frase italiana,
il valore la traduzione.

```json
{
  "_": { "nome": "English", "locale": "en-GB" },
  "Chiedi alla lezione": "Ask the lecture",
  "{n} lezione | {n} lezioni": "{n} lecture | {n} lectures"
}
```

Quando una traduzione manca compare l'italiano. Una lingua è quindi
utilizzabile anche incompleta, e una pull request con metà delle frasi
tradotte è una pull request valida.

### Aggiungere una lingua

```bash
npm run lingue -- --nuova es
```

Il comando crea `lingue/es.json` con tutte le frasi del codice, i valori
vuoti e un blocco `_` da compilare. La lingua compare nelle impostazioni
(Aspetto › Lingua) appena il file esiste: non c'è nessun elenco da
aggiornare altrove.

Per vedere la traduzione mentre la si scrive:

```bash
npm run dev
```

### Il blocco `_`

| Campo | Cosa contiene |
| --- | --- |
| `nome` | il nome della lingua scritto in quella lingua: `Español`, `Deutsch` |
| `locale` | il locale per date, ore e numeri: `es-ES` |
| `ascolto` | il locale della trascrizione, se diverso: `es-MX` |
| `modello` | la riga che dice al modello in che lingua rispondere, scritta in quella lingua o in inglese |
| `tradotta` | chi ha scritto la traduzione, se vuole essere citato |

`ascolto` esiste perché la lingua in cui si scrive e quella in cui si
ascolta a lezione non coincidono sempre. Deve essere un locale che
macOS riconosce per il riconoscimento vocale.

### Come si scrivono le frasi

**Segnaposto.** Le parentesi graffe sono buchi che l'applicazione
riempie. Vanno riportati tutti, con lo stesso nome, ma possono cambiare
posizione:

```json
"Lezioni di questa pagina: {n}": "Lectures on this page: {n}"
```

**Plurali.** Le forme si scrivono su una riga sola, separate da `|`.
Quante sono lo decide la lingua d'arrivo — due in italiano e in inglese,
quattro in polacco — e si scrivono nell'ordine di Unicode: *zero, uno,
due, poche, molte, altro*.

```json
"{n} pagina | {n} pagine": "{n} strona | {n} strony | {n} stron | {n} strony"
```

**Marcatura.** Alcune frasi contengono `<b>`, `<i>`, `<code>`, `<kbd>` o
`<br>`. Vanno mantenuti, attorno alle parole che nella lingua d'arrivo
hanno quel ruolo:

```json
"Rifiuta <kbd>X</kbd>": "Reject <kbd>X</kbd>"
```

**Tasti e simboli.** `⌘`, `⌥`, `↵`, `esc` e le lettere delle scorciatoie
(`J`, `K`, `X`) restano come sono: sono i tasti che l'applicazione
ascolta davvero.

### Rivedere una traduzione esistente

Si modificano i valori nel file della lingua e si apre una pull request.
Le correzioni di una traduzione fatta da altri sono benvenute quanto una
lingua nuova: chi ha scritto il file compare in `_.tradotta`, e chi lo
corregge viene aggiunto.

### Dopo aver modificato il codice

Se una pull request aggiunge o cambia frasi dell'interfaccia:

```bash
npm run lingue
```

Il comando rilegge il codice, aggiunge le frasi nuove a tutti i file
delle lingue e toglie quelle sparite. Le modifiche ai file di `lingue/`
vanno incluse nella pull request; la verifica automatica le richiede.

### Cosa non si traduce

Restano in italiano, apposta:

- le istruzioni ai modelli (`src/merge/prompt.ts`, `src/ripasso/quiz.ts`
  e simili): sono testo per il modello, non per chi usa l'applicazione;
- i nomi dei blocchi passati al modello insieme agli appunti;
- i titoli salvati dentro i documenti.

La lingua in cui il modello risponde non dipende da questi testi: la
decide il campo `modello` del blocco `_`.

## Segnalazioni e pull request

Segnalazioni e domande:
[issue](https://github.com/TCdesign-dev/Pergamena/issues). Per un
problema di avvio sono utili la versione di macOS, quella di Node e
l'output del terminale in cui gira `npm run dev`.

Per modifiche sostanziali al codice conviene aprire prima una issue:
alcune scelte strutturali — assenza di librerie di componenti, documento
come unica fonte, chiavi API fuori dal browser — condizionano
l'implementazione.

Prima di aprire una pull request:

```bash
npm run check
npm run lingue
```

---

# Contributing to Pergamena

## Translations

Pergamena's interface is written in Italian inside the code. Every other
language is a JSON file in `lingue/`: the key is the Italian phrase, the
value is the translation.

```json
{
  "_": { "nome": "English", "locale": "en-GB" },
  "Chiedi alla lezione": "Ask the lecture",
  "{n} lezione | {n} lezioni": "{n} lecture | {n} lectures"
}
```

When a translation is missing, the Italian shows instead. A language is
therefore usable even when incomplete, and a pull request with half the
phrases translated is a valid pull request.

### Adding a language

```bash
npm run lingue -- --nuova es
```

This creates `lingue/es.json` with every phrase found in the code, empty
values and a `_` block to fill in. The language appears in the settings
(Appearance › Language) as soon as the file exists: there is no list to
update anywhere else.

To see your translation while you write it:

```bash
npm run dev
```

### The `_` block

| Field | What it holds |
| --- | --- |
| `nome` | the language's name in that language: `Español`, `Deutsch` |
| `locale` | the locale for dates, times and numbers: `es-ES` |
| `ascolto` | the locale used for transcription, when different: `es-MX` |
| `modello` | the line telling the model which language to answer in, written in that language or in English |
| `tradotta` | who wrote the translation, if they want the credit |

`ascolto` exists because the language you write in and the language you
listen to in class are not always the same. It must be a locale macOS
recognises for speech recognition.

### How phrases are written

**Placeholders.** Curly braces are holes the application fills in. Keep
all of them, with the same names, but move them where your language
needs them:

```json
"Lezioni di questa pagina: {n}": "Lectures on this page: {n}"
```

**Plurals.** The forms go on a single line, separated by `|`. How many
there are is decided by your language — two in Italian and English, four
in Polish — and they are written in Unicode order: *zero, one, two, few,
many, other*.

```json
"{n} pagina | {n} pagine": "{n} strona | {n} strony | {n} stron | {n} strony"
```

**Markup.** Some phrases contain `<b>`, `<i>`, `<code>`, `<kbd>` or
`<br>`. Keep them, around whichever words play that role in your
language:

```json
"Rifiuta <kbd>X</kbd>": "Reject <kbd>X</kbd>"
```

**Keys and symbols.** `⌘`, `⌥`, `↵`, `esc` and the shortcut letters
(`J`, `K`, `X`) stay as they are: those are the keys the application
actually listens for.

### Revising an existing translation

Change the values in that language's file and open a pull request.
Corrections to somebody else's translation are as welcome as a new
language: whoever wrote the file is credited in `_.tradotta`, and
whoever corrects it is added.

### After changing the code

If a pull request adds or changes interface phrases:

```bash
npm run lingue
```

This re-reads the code, adds new phrases to every language file and
removes the ones that are gone. Changes to files in `lingue/` belong in
the pull request; the automated check asks for them.

### What is not translated

These stay in Italian on purpose:

- the instructions given to the models (`src/merge/prompt.ts`,
  `src/ripasso/quiz.ts` and similar): they are text for the model, not
  for the person using the application;
- the block names passed to the model along with the notes;
- the titles stored inside documents.

The language the model answers in does not depend on those texts: it is
set by the `modello` field of the `_` block.

## Issues and pull requests

Issues and questions:
[issue tracker](https://github.com/TCdesign-dev/Pergamena/issues). For a
start-up problem, the macOS version, the Node version and the output of
the terminal running `npm run dev` are useful.

For substantial changes to the code, opening an issue first is
worthwhile: some structural choices — no component library, the document
as the single source, API keys kept out of the browser — shape how
things have to be implemented.

Before opening a pull request:

```bash
npm run check
npm run lingue
```
