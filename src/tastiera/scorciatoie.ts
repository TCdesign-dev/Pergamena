import { imposta, leggiImpostazioni } from '../impostazioni'
import { tr } from '../lingua/lingua'

/*  Le scorciatoie, in un posto solo.
 *
 *  Il formato interno è «mod+shift+b»: modificatori in ordine fisso e
 *  tasto minuscolo. `mod` è ⌘ sul Mac e Ctrl altrove, come in TipTap.
 *
 *  Il tasto si prende da `event.code`, non da `event.key`: con ⌥
 *  premuto il Mac scrive «∫» al posto di «b», e una scorciatoia
 *  registrata a mano non si sarebbe più riconosciuta. `code` dice che
 *  fisicamente è il tasto B, qualunque cosa ci esca. */

const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export type Ambito = 'app' | 'editor'
export type Comando = {
  id: string
  nome: string
  ambito: Ambito
  predefinita: string
  /** un aiuto quando il nome non basta */
  nota?: string
}

/*  Quelle che si possono cambiare. Restano fuori le cose che non sono
 *  scorciatoie ma sintassi (`/`, `$$…$$`, `!…!`) e i tasti della
 *  revisione (J, K, X, ↵): lì una lettera riassegnata male vorrebbe
 *  dire non riuscire più a scrivere. */
export const COMANDI: Comando[] = [
  { id: 'cerca', nome: tr('Cerca o dai un comando'), ambito: 'app', predefinita: 'mod+k' },
  { id: 'barra', nome: tr('Barra laterale'), ambito: 'app', predefinita: 'mod+\\' },
  { id: 'registra', nome: tr('Registra la lezione'), ambito: 'app', predefinita: 'mod+r' },
  { id: 'immagini', nome: tr('Pannello delle immagini'), ambito: 'app', predefinita: 'mod+/' },
  { id: 'impostazioni', nome: tr('Impostazioni'), ambito: 'app', predefinita: 'mod+,' },
  { id: 'chiedi', nome: tr('Chiedi alla lezione'), ambito: 'app', predefinita: 'mod+shift+d' },

  { id: 'commenta', nome: tr('Commenta la selezione'), ambito: 'editor', predefinita: 'mod+shift+m' },
  { id: 'grassetto', nome: tr('Grassetto'), ambito: 'editor', predefinita: 'mod+b' },
  { id: 'corsivo', nome: tr('Corsivo'), ambito: 'editor', predefinita: 'mod+i' },
  { id: 'sottolineato', nome: tr('Sottolineato'), ambito: 'editor', predefinita: 'mod+u' },
  { id: 'codice', nome: tr('Codice'), ambito: 'editor', predefinita: 'mod+e' },
  { id: 'evidenzia', nome: tr('Evidenziatore'), ambito: 'editor', predefinita: 'mod+shift+h' },
  { id: 'titolo1', nome: 'Titolo 1', ambito: 'editor', predefinita: 'mod+alt+1' },
  { id: 'titolo2', nome: 'Titolo 2', ambito: 'editor', predefinita: 'mod+alt+2' },
  { id: 'titolo3', nome: 'Titolo 3', ambito: 'editor', predefinita: 'mod+alt+3' },
  { id: 'colore1', nome: tr('Colora di rosso'), ambito: 'editor', predefinita: 'mod+shift+1' },
  { id: 'colore2', nome: tr('Colora di arancio'), ambito: 'editor', predefinita: 'mod+shift+2' },
  { id: 'colore3', nome: tr('Colora di verde'), ambito: 'editor', predefinita: 'mod+shift+3' },
  { id: 'colore4', nome: tr('Colora di blu'), ambito: 'editor', predefinita: 'mod+shift+4' },
  { id: 'colore5', nome: tr('Colora di viola'), ambito: 'editor', predefinita: 'mod+shift+5' },
  { id: 'coloreUltimo', nome: tr('Colora col colore di prima'), ambito: 'editor', predefinita: 'mod+shift+c' },
  { id: 'scolora', nome: tr('Togli il colore'), ambito: 'editor', predefinita: 'mod+shift+0' },
  { id: 'spostaSu', nome: tr('Sposta il blocco in su'), ambito: 'editor', predefinita: 'mod+shift+up' },
  { id: 'spostaGiu', nome: tr('Sposta il blocco in giù'), ambito: 'editor', predefinita: 'mod+shift+down' },
]

export const comandoDi = (id: string) => COMANDI.find((c) => c.id === id)

/** Quella in uso: la tua, se l'hai cambiata; se no, quella di serie. */
export function combinazioneDi(id: string): string {
  return leggiImpostazioni().scorciatoie?.[id] ?? comandoDi(id)?.predefinita ?? ''
}

/** I comandi che hai riassegnato: id → combinazione. */
export function personalizzate(): { comando: Comando; combinazione: string }[] {
  const tue = leggiImpostazioni().scorciatoie ?? {}
  return COMANDI
    .filter((c) => tue[c.id] && tue[c.id] !== c.predefinita)
    .map((c) => ({ comando: c, combinazione: tue[c.id] }))
}

/** Chi usa già questa combinazione, se qualcuno la usa. */
export function giaPresa(combinazione: string, tranne?: string): Comando | null {
  return COMANDI.find((c) => c.id !== tranne && combinazioneDi(c.id) === combinazione) ?? null
}

export function impostaScorciatoia(id: string, combinazione: string | null) {
  const tue = { ...(leggiImpostazioni().scorciatoie ?? {}) }
  if (!combinazione || combinazione === comandoDi(id)?.predefinita) delete tue[id]
  else tue[id] = combinazione
  imposta('scorciatoie', tue)
}

export const azzeraScorciatoie = () => imposta('scorciatoie', {})

// ── dagli eventi alle combinazioni, e viceversa ────────────────────

const TASTI: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
  Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`',
  Space: 'space', Enter: 'enter', Tab: 'tab', Backspace: 'backspace', Delete: 'canc',
}

/** Il tasto fisico, senza modificatori: «b», «1», «,», «up». */
function tastoDa(e: KeyboardEvent): string | null {
  const code = e.code
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6)
  if (/^F[1-9][0-9]?$/.test(code)) return code.toLowerCase()
  return TASTI[code] ?? null
}

/*  Serve almeno un modificatore vero (⌘, ⌃, ⌥): ⇧ da solo è una
 *  maiuscola, e una scorciatoia su «B» vorrebbe dire non poter più
 *  scrivere la lettera B. */
export function combinazioneDa(e: KeyboardEvent): string | null {
  const tasto = tastoDa(e)
  if (!tasto) return null
  const mod = APPLE ? e.metaKey : e.ctrlKey
  const ctrl = APPLE ? e.ctrlKey : false
  if (!mod && !ctrl && !e.altKey) return null
  const parti: string[] = []
  if (mod) parti.push('mod')
  if (ctrl) parti.push('ctrl')
  if (e.altKey) parti.push('alt')
  if (e.shiftKey) parti.push('shift')
  return [...parti, tasto].join('+')
}

/** L'evento è la scorciatoia di questo comando? */
export function corrisponde(id: string, e: KeyboardEvent): boolean {
  const combinazione = combinazioneDa(e)
  return !!combinazione && combinazione === combinazioneDi(id)
}

const SEGNI: Record<string, string> = {
  mod: APPLE ? '⌘' : 'Ctrl', ctrl: '⌃', alt: APPLE ? '⌥' : 'Alt', shift: '⇧',
  up: '↑', down: '↓', left: '←', right: '→',
  enter: '↵', space: 'spazio', tab: '⇥', backspace: '⌫', canc: '⌦',
}

/** Come si scrive su una tastiera: «⌘⇧B». */
export function scrittaDi(combinazione: string): string {
  if (!combinazione) return ''
  const parti = combinazione.split('+')
  const tasto = parti.pop() ?? ''
  const modificatori = parti.map((p) => SEGNI[p] ?? p).join('')
  return modificatori + (SEGNI[tasto] ?? tasto.toUpperCase())
}

export const scrittaDiComando = (id: string) => scrittaDi(combinazioneDi(id))
