/*  Guscio in cache, così Pergamena si apre anche senza rete.
 *  Gli appunti non passano di qui: vivono in IndexedDB e li gestisce
 *  Yjs. Questo tiene in cache soltanto l'involucro dell'app. */

const CACHE = 'pergamena-guscio-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icona.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chiavi) =>
      Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const richiesta = e.request
  if (richiesta.method !== 'GET') return

  const url = new URL(richiesta.url)
  if (url.origin !== self.location.origin) return   // Supabase e Commons vanno da soli

  /*  Prima la rete: un appunto aggiornato vale più di una risposta
   *  istantanea. La cache interviene solo quando la rete non c'è. */
  e.respondWith(
    fetch(richiesta)
      .then((risposta) => {
        const copia = risposta.clone()
        void caches.open(CACHE).then((c) => c.put(richiesta, copia))
        return risposta
      })
      .catch(() =>
        caches.match(richiesta).then((c) => c ?? caches.match('/')).then((c) => c ?? Response.error()),
      ),
  )
})
