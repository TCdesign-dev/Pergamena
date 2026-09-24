/*  Il set di icone di Pergamena (restyling, settembre 2026).
 *  Griglia 20, tratto 1,5, estremità arrotondate. Prendono il colore
 *  dal testo (currentColor): nessun colore scritto qui.
 *  16 px nell'interfaccia, 14 nei pulsanti con testo.
 *  Un'icona da sola in un pulsante vuole l'aria-label sul pulsante. */

import type { JSX } from 'react'

const TRATTI = {
  'barra-laterale': <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M8 4v12" /></>,
  'cerca': <><circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" /></>,
  'materie': <><path d="M3.5 9L10 3.5 16.5 9v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" /><path d="M8 16.5v-4h4v4" /></>,
  'microfono': <><rect x="7.5" y="2.5" width="5" height="9" rx="2.5" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" /><path d="M10 15v2.5" /></>,
  'microfono-muto': <><path d="M12.5 8V5a2.5 2.5 0 0 0-5 0v1" /><path d="M7.5 9a2.5 2.5 0 0 0 4 2" /><path d="M4.5 9.5a5.5 5.5 0 0 0 9 4.2M15.5 9.5c0 .6-.1 1.1-.2 1.6" /><path d="M10 15v2.5" /><path d="M3 3l14 14" /></>,
  'pausa': <><path d="M7.5 5v10M12.5 5v10" /></>,
  'termina': <><rect x="5.5" y="5.5" width="9" height="9" rx="1.5" /></>,
  'registra': <><circle cx="10" cy="10" r="4.5" /></>,
  'lezioni': <><path d="M4 8.5v3M7 6v8M10 7.5v5M13 3.5v13M16 8.5v3" /></>,
  'immagini': <><rect x="3" y="4" width="14" height="12" rx="2" /><circle cx="7.5" cy="8.5" r="1.5" /><path d="M3.5 14.5L8.5 10l3 3 2-1.5 3 2.5" /></>,
  'elimina': <><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10" /></>,
  'altro': <><circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" /></>,
  'giu': <><path d="M6 8l4 4 4-4" /></>,
  'destra': <><path d="M8 6l4 4-4 4" /></>,
  'sinistra': <><path d="M12 6l-4 4 4 4" /></>,
  'accetta': <><path d="M4.5 10.5l3.5 3.5 7.5-8" /></>,
  'chiudi': <><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></>,
  'impostazioni': <><path d="M3.5 6h7M15 6h1.5M3.5 14h1.5M9.5 14h7" /><circle cx="12.8" cy="6" r="2" /><circle cx="7.2" cy="14" r="2" /></>,
  'chiaro': <><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1" /></>,
  'scuro': <><path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" /></>,
  'nuovo': <><path d="M10 4.5v11M4.5 10h11" /></>,
  'materia': <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5z" /><path d="M4 16.5A1.5 1.5 0 0 0 5.5 18H16" /></>,
  'ripasso': <><rect x="3" y="6" width="10.5" height="11" rx="2" /><path d="M6.5 3.5H15a2 2 0 0 1 2 2V14" /></>,
  'archivio': <><rect x="3" y="4" width="14" height="4" rx="1" /><path d="M4.5 8v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8M8.5 11h3" /></>,
  'scollegato': <><path d="M7.5 9.5l-2 2a2.5 2.5 0 0 0 3.5 3.5l2-2M12.5 10.5l2-2A2.5 2.5 0 0 0 11 5l-2 2M3.5 3.5l13 13" /></>,
  'errore': <><path d="M10 3.5l7.2 12.5H2.8z" /><path d="M10 8.5v3.2" /><circle cx="10" cy="13.9" r=".6" fill="currentColor" stroke="none" /></>,
  'altra-finestra': <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 7.5h14" /></>,
  'invio': <><path d="M15.5 5v3.5a2 2 0 0 1-2 2H5M8 7.5l-3 3 3 3" /></>,
  'ai': <><path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5z" /></>,
  'chiave': <><circle cx="7" cy="10" r="3.5" /><path d="M10.5 10H17M14.5 10v2.5M16.5 10v2" /></>,
  'commento': <><path d="M3.5 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z" /></>,
  'esame': <><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8.5h14M7 3v3M13 3v3" /></>,
  'sposta': <><circle cx="8" cy="5.5" r=".9" fill="currentColor" stroke="none" /><circle cx="12" cy="5.5" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="10" r=".9" fill="currentColor" stroke="none" /><circle cx="12" cy="10" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="14.5" r=".9" fill="currentColor" stroke="none" /><circle cx="12" cy="14.5" r=".9" fill="currentColor" stroke="none" /></>,
  'riprova': <><path d="M16 10a6 6 0 1 1-1.8-4.3" /><path d="M16 3.5v3.5h-3.5" /></>,
  'attesa': <><path d="M10 3.5a6.5 6.5 0 1 1-6.5 6.5" /></>,
  'testo': <><path d="M5 5.5h10M10 5.5v10" /></>,
  'formula': <><path d="M13 4.5H8.5L6 15.5 4.5 12M9.5 9.5l5 5M14.5 9.5l-5 5" /></>,
  'trascrizione': <><path d="M4 5.5h12M4 9h12M4 12.5h7" /><path d="M13.5 13.5l2 2 3-3.5" /></>,
  'scarica': <><path d="M10 3.5v9M6.5 9l3.5 3.5L13.5 9M4 16h12" /></>,
  'nascondi': <><path d="M3 3l14 14M8.3 8.3a2.5 2.5 0 0 0 3.4 3.4" /><path d="M6 6.2C4.4 7.2 3.2 8.6 2.5 10c1.3 2.8 4.3 5 7.5 5 1.3 0 2.5-.3 3.6-.9M9 5.1c.3 0 .7-.1 1-.1 3.2 0 6.2 2.2 7.5 5-.4.9-1 1.7-1.7 2.4" /></>,
  'tastiera': <><rect x="2.5" y="5" width="15" height="10" rx="2" /><path d="M5.5 8h1M9.5 8h1M13.5 8h1M6.5 12h7" /></>,
  'apri-fuori': <><path d="M11 4h5v5M16 4l-7 7M14 12v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3" /></>,
} satisfies Record<string, JSX.Element>

export type NomeIcona = keyof typeof TRATTI

export function Icona({ nome, dimensione = 16, className }: {
  nome: NomeIcona
  dimensione?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={dimensione}
      height={dimensione}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {TRATTI[nome]}
    </svg>
  )
}
