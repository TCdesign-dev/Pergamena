/*  Maniglia di sviluppo: in console `pergamena` raccoglie le parti
 *  vive dell'app — l'editor, l'archivio, l'apertura dei documenti.
 *  Serve a collaudare senza sparpagliare `console.log` nel codice,
 *  e in produzione non esiste (`import.meta.env.DEV` la cancella). */
export function esponi(parti: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as Record<string, unknown>
  w.pergamena = { ...((w.pergamena as object) ?? {}), ...parti }
}
