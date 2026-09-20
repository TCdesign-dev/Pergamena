import * as Y from 'yjs'

/*  Quali immagini usa un documento.
 *
 *  Serve per cancellare davvero: eliminando una pagina i suoi byte
 *  devono sparire dal deposito e dal server, altrimenti lo spazio si
 *  riempie di immagini che non guarderà più nessuno. */

function raccogli(nodo: Y.XmlFragment | Y.XmlElement, dentro: Set<string>) {
  for (const figlio of nodo.toArray()) {
    if (!(figlio instanceof Y.XmlElement)) continue
    if (figlio.nodeName === 'immagine') {
      const id = figlio.getAttribute('idLocale')
      if (id) dentro.add(id)
    }
    raccogli(figlio, dentro)
  }
}

export function immaginiDi(doc: Y.Doc): string[] {
  const dentro = new Set<string>()
  raccogli(doc.getXmlFragment('contenuto'), dentro)
  return [...dentro]
}
