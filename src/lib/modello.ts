import { esponi } from './dev'

/*  Le chiamate al modello che devono rispondere in JSON.
 *
 *  DeepSeek V4 Flash, col ragionamento acceso, ogni tanto ragionava
 *  finché non finivano i token e la risposta arrivava VUOTA: da lì
 *  «il modello non ha risposto in JSON», e al secondo tentativo
 *  andava. Provato sulla lezione vera di Materiali: 1 volta su 3.
 *  Col ragionamento spento: 4 s invece di 20, un quarto del costo,
 *  JSON valido ogni volta, e proposte che si ripetono meno.
 *
 *  Resta un secondo tentativo automatico: OpenRouter smista il
 *  modello fra tanti fornitori, e non tutti si comportano uguale. */

type Messaggio = { role: 'system' | 'user' | 'assistant'; content: string }
type Compito = 'merge' | 'quiz' | 'veloce'

const TENTATIVI = 2

let ultimaIlleggibile: { compito: Compito; motivo: string; testo: string } | null = null

/** Il primo oggetto JSON nel testo, anche se il modello ci ha messo
 *  intorno ```json o due parole di cortesia. */
function leggi(grezzo: string): Record<string, unknown> | null {
  const inizio = grezzo.indexOf('{')
  const fine = grezzo.lastIndexOf('}')
  if (inizio < 0 || fine <= inizio) return null
  try {
    const j = JSON.parse(grezzo.slice(inizio, fine + 1))
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

export async function chiediJson(compito: Compito, messaggi: Messaggio[], opzioni: {
  maxToken: number
  /** chiamata quando parte il secondo tentativo, per dirlo a chi aspetta */
  riprovo?: () => void
}): Promise<{ json: Record<string, unknown>; costo: number }> {
  let costo = 0
  let motivo = ''

  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    if (tentativo > 1) opzioni.riprovo?.()

    const r = await fetch(`/api/llm/${compito}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messaggi,
        response_format: { type: 'json_object' },
        reasoning: { enabled: false },
        max_tokens: opzioni.maxToken,
        temperature: 0.2,
      }),
    })
    const dati = await r.json().catch(() => ({}))
    // gli errori del servizio il server li ha già riprovati: inutile insistere
    if (!r.ok || dati.error) throw new Error(dati.error?.message ?? dati.errore ?? `il modello non risponde (${r.status})`)

    costo += Number(dati.usage?.cost) || 0
    const scelta = dati.choices?.[0]
    const grezzo = String(scelta?.message?.content ?? '')
    const json = leggi(grezzo)
    if (json) return { json, costo }

    motivo = scelta?.finish_reason === 'length' ? 'si è interrotto a metà risposta'
      : grezzo.trim() ? 'ha risposto in un formato illeggibile'
      : 'ha risposto vuoto'
    ultimaIlleggibile = { compito, motivo, testo: grezzo.slice(0, 4000) }
    console.warn(`[modello] ${compito}: ${motivo} (tentativo ${tentativo})`, grezzo.slice(0, 500))
  }

  throw new Error(`il modello ${motivo}, due volte di fila. Riprova fra poco.`)
}

esponi({ modello: { chiediJson, ultimaIlleggibile: () => ultimaIlleggibile } })
