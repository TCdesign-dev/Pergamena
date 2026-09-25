import { Extension, type Editor } from '@tiptap/core'

/*  ⌘Z e ⌘⇧Z, con la rete sotto.
 *
 *  Lo storico è quello di Yjs (vedi Collaboration): annullare vuol dire
 *  rimettere il documento a uno stato di prima e poi riportare il
 *  cursore dov'era. È il secondo passo che ogni tanto si rompe: in
 *  @tiptap/y-tiptap 3.0.9 `isMisresolvedAfterStructuralChange` chiama
 *  `doc.resolve()` su una posizione calcolata su un'altra versione del
 *  documento, senza controllare che ci stia dentro, e tira un
 *  «Position N out of range». Succede quando l'annullamento toglie dei
 *  blocchi interi — un elenco, un paragrafo, una proposta dell'AI.
 *
 *  L'eccezione esce dal comando e lascia l'editor a metà del lavoro: da
 *  lì in poi ⌘Z non risponde più, e quello che scrivi dopo può
 *  ricomparire due volte, perché il documento che vedi e quello di Yjs
 *  hanno smesso di essere lo stesso. Fermarla qui costa una riga e
 *  lascia il documento com'era un attimo prima.
 *
 *  Si toglie quando esce una versione di y-tiptap che controlla i
 *  limiti prima di risolvere. */

type Pila = { undoStack: unknown[]; redoStack: unknown[] }

/** Lo storico di Yjs: il plugin che lo tiene è l'unico che ne ha uno. */
function pile(editor: Editor): Pila | null {
  for (const plugin of editor.state.plugins) {
    const stato = plugin.getState(editor.state) as { undoManager?: Pila } | undefined
    if (stato?.undoManager) return stato.undoManager
  }
  return null
}

function conRete(editor: Editor, verso: 'annulla' | 'rifai', fai: () => boolean) {
  try {
    fai()
  } catch (e) {
    /*  L'eccezione arriva dopo che Yjs ha già spostato il passo
     *  sull'altra pila, ma prima che il documento cambi davvero: il
     *  passo è lì, pronto a essere rifatto, e rifarlo aggiungerebbe una
     *  seconda copia del testo — è così che comparivano i doppioni.
     *  Meglio perdere un passo di storia che duplicare una riga. */
    const p = pile(editor)
    if (verso === 'annulla') p?.redoStack.pop()
    else p?.undoStack.pop()
    console.warn('[annulla] y-tiptap non è riuscito a rimettere il cursore: passo saltato', e)
  }
  //  vero comunque: il tasto è nostro, e l'annullamento del browser
  //  dentro un contenteditable sincronizzato farebbe altri danni
  return true
}

export const Annulla = Extension.create({
  name: 'annulla',
  /*  Prima di tutti: Collaboration registra le stesse combinazioni
   *  senza rete, e qui vince chi arriva per primo. Conseguenza voluta:
   *  ⌘Z resta l'annullamento anche se lo si riassegna a un altro
   *  comando dalle impostazioni. */
  priority: 1100,

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => conRete(this.editor, 'annulla', () => this.editor.commands.undo()),
      'Mod-y': () => conRete(this.editor, 'rifai', () => this.editor.commands.redo()),
      'Shift-Mod-z': () => conRete(this.editor, 'rifai', () => this.editor.commands.redo()),
    }
  },
})
