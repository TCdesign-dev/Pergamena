import type { Trovata } from './commons'

/*  Le immagini dal web: le cerca il server (server/immagini.ts), con
 *  Google Immagini se c'è la chiave di Serper, altrimenti con Openverse.
 *  Qui si chiede e basta: le chiavi non passano dal browser. */

export type FonteWeb = 'google' | 'brave' | 'openverse'

export async function cercaSulWeb(query: string, n = 12): Promise<{ fonte: FonteWeb; risultati: Trovata[] }> {
  const r = await fetch(`/api/immagini/cerca?q=${encodeURIComponent(query.trim())}&n=${n}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.errore ?? `ricerca fallita (${r.status})`)
  return j
}

export const NOMI_FONTI: Record<string, string> = {
  commons: 'Commons', google: 'Google Immagini', brave: 'Brave', openverse: 'Openverse',
}
