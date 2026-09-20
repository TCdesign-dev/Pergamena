import type { User } from '@supabase/supabase-js'
import { supabase, configurato } from './cliente'

/*  Due strade, perché i modelli di email di Supabase possono mandare
 *  l'una o l'altra cosa:
 *
 *  · il LINK — è il predefinito. Si clicca, si torna sull'app e il
 *    client raccoglie i gettoni dall'indirizzo. Comodo sul Mac.
 *
 *  · il CODICE a sei cifre — serve il modello modificato (vedi
 *    README). È l'unica strada sensata sul telefono, e quando la
 *    posta la leggi su un dispositivo diverso da quello su cui vuoi
 *    entrare.
 *
 *  L'app accetta entrambe senza sapere quale arriverà. */

export type StatoAccesso = {
  pronto: boolean
  utente: User | null
}

let stato: StatoAccesso = { pronto: !configurato, utente: null }
const ascoltatori = new Set<() => void>()

export const leggiAccesso = () => stato

export function iscrivitiAccesso(fn: () => void) {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(nuovo: StatoAccesso) {
  stato = nuovo
  ascoltatori.forEach((f) => f())
}

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => {
    pubblica({ pronto: true, utente: data.session?.user ?? null })
  })
  supabase.auth.onAuthStateChange((_evento, sessione) => {
    pubblica({ pronto: true, utente: sessione?.user ?? null })
  })
}

export async function inviaCodice(email: string) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      // dove torna il link. In sviluppo è questo stesso indirizzo
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function verificaCodice(email: string, codice: string) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: codice.trim(),
    type: 'email',
  })
  if (error) throw error
}

export async function esci() {
  await supabase?.auth.signOut()
}
