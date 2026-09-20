import { createClient } from '@supabase/supabase-js'
import { esponi } from '../lib/dev'

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
      /*  `detectSessionInUrl` acceso: i modelli di email predefiniti di
       *  Supabase mandano un LINK, non un codice. Cliccandolo si torna
       *  qui con i gettoni nell'indirizzo, e il client li raccoglie da
       *  solo. Il codice a sei cifre resta come seconda strada, per il
       *  telefono e per chi legge la posta su un altro dispositivo. */
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

esponi({ supabase })
