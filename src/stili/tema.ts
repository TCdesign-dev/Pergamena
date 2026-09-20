/*  Il tema vive su `document.documentElement[data-tema]`.
 *  `sistema` toglie l'attributo e lascia decidere a prefers-color-scheme,
 *  che è il comportamento giusto di default su macOS. */

export type Tema = 'sistema' | 'chiaro' | 'scuro'

const CHIAVE = 'pergamena:tema'

export const ETICHETTE_TEMA: Record<Tema, string> = {
  sistema: 'Tema: come il sistema',
  chiaro: 'Tema: chiaro',
  scuro: 'Tema: scuro',
}

export function leggiTema(): Tema {
  try {
    const v = localStorage.getItem(CHIAVE) as Tema | null
    if (v === 'chiaro' || v === 'scuro' || v === 'sistema') return v
  } catch { /* finestra privata */ }
  return 'sistema'
}

export function applicaTema(t: Tema) {
  const radice = document.documentElement
  if (t === 'sistema') radice.removeAttribute('data-tema')
  else radice.setAttribute('data-tema', t)
  try { localStorage.setItem(CHIAVE, t) } catch { /* pazienza */ }
}
