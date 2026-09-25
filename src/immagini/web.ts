import type { Trovata } from './commons'
import { intestazioniChiavi } from '../chiavi'
import { tr } from '../lingua/lingua'

/*  Le immagini dal web: le cerca il server (server/immagini.ts), con
 *  Google Immagini se c'è la chiave di Serper, altrimenti con Openverse.
 *  Qui si chiede e basta: le chiavi non passano dal browser.
 *
 *  `inglese` è lo stesso concetto detto in inglese, quando Wikipedia
 *  lo sa (vedi wikipedia.ts): Google capisce l'italiano, Openverse no,
 *  e il server sceglie di conseguenza. */

export type FonteWeb = 'google' | 'brave' | 'openverse'

export async function cercaSulWeb(query: string, n = 12, inglese?: string | null): Promise<{ fonte: FonteWeb; risultati: Trovata[] }> {
  const en = inglese ? `&en=${encodeURIComponent(inglese)}` : ''
  const r = await fetch(`/api/immagini/cerca?q=${encodeURIComponent(query.trim())}&n=${n}${en}`, { headers: intestazioniChiavi() })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.errore ?? tr('ricerca fallita ({stato})', { stato: r.status }))
  return j
}

export const NOMI_FONTI: Record<string, string> = {
  commons: 'Commons', google: tr('Google Immagini'), brave: 'Brave', openverse: 'Openverse',
}
