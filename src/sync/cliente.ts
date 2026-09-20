import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY

/*  Se le chiavi non ci sono, Pergamena resta un'app locale e basta:
 *  niente accesso, niente sincronizzazione, tutto il resto funziona.
 *  Non è un ripiego, è il comportamento giusto — gli appunti devono
 *  aprirsi anche se Supabase è giù o se sei su un Mac nuovo senza
 *  ancora aver configurato niente. */
export const configurato = Boolean(url && chiave)

export const supabase = configurato
  ? createClient(url, chiave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
