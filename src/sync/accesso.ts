import type { User } from '@supabase/supabase-js'
import { supabase, configurato } from './cliente'

/*  Accesso con codice via email, non con link.
 *
 *  Il link magico va configurato (indirizzi di ritorno, dominio) e
 *  apre una scheda nuova; un codice di sei cifre lo digiti sul Mac e
 *  sul telefono allo stesso modo, e funziona anche se la posta la
 *  leggi da un altro dispositivo. */

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
    options: { shouldCreateUser: true },
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
