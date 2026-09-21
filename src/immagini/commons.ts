/*  Wikimedia Commons come fonte principale.
 *
 *  Per materiale scolastico è migliore di qualunque banca di foto
 *  stock: «Basilica di Superga», «ciclo di Krebs», «Filippo Juvarra»
 *  ci sono davvero, con licenza pulita e attribuzione. Nessuna chiave
 *  API, nessun limite pratico. */

export type Trovata = {
  chiave: string
  titolo: string
  miniatura: string
  originale: string
  larghezza: number
  altezza: number
  autore: string
  licenza: string
  pagina: string
  /** da dove arriva: Commons, oppure il web (vedi web.ts) */
  fonte?: 'commons' | 'google' | 'brave' | 'openverse'
}

const API = 'https://commons.wikimedia.org/w/api.php'

function ripulisci(html: string | undefined) {
  return (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/*  Il campo Artist di Commons è spesso un paragrafo di legalese:
 *  «This picture belongs to Xavier Caré. Please credit : Xavier Caré /
 *  Wikimedia Commons / CC-BY-SA. If you would like special
 *  permission…». Sotto a un'immagine negli appunti è illeggibile.
 *
 *  Il nome vero sta quasi sempre nel primo collegamento; se non c'è,
 *  si prende la prima frase e la si accorcia. */
function autore(html: string | undefined) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const collegamento = doc.querySelector('a')?.textContent?.trim()
  const grezzo = collegamento || ripulisci(html)
  const primaFrase = grezzo.split(/[.;]/)[0].trim()
  return primaFrase.length > 48 ? `${primaFrase.slice(0, 45)}…` : primaFrase
}

export async function cercaSuCommons(query: string, limite = 12): Promise<Trovata[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const parametri = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6',            // solo File:
    gsrlimit: String(limite),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '400',
    format: 'json',
    origin: '*',
  })

  const risposta = await fetch(`${API}?${parametri}`)
  if (!risposta.ok) throw new Error(`Commons ha risposto ${risposta.status}`)
  const dati = await risposta.json()

  const pagine = Object.values(dati.query?.pages ?? {}) as Array<Record<string, never>>

  return pagine
    .map((p) => {
      const i = (p as Record<string, unknown>).imageinfo as Array<Record<string, string>> | undefined
      const info = i?.[0]
      if (!info?.thumburl) return null
      const meta = (info.extmetadata ?? {}) as unknown as Record<string, { value?: string }>
      return {
        chiave: String((p as Record<string, unknown>).pageid),
        titolo: String((p as Record<string, unknown>).title).replace(/^File:/, '').replace(/\.\w+$/, ''),
        miniatura: info.thumburl,
        originale: info.url,
        larghezza: Number(info.thumbwidth) || 400,
        altezza: Number(info.thumbheight) || 300,
        autore: autore(meta.Artist?.value) || 'Autore non indicato',
        licenza: ripulisci(meta.LicenseShortName?.value) || 'vedi Commons',
        pagina: info.descriptionurl ?? '',
      }
    })
    .filter((x): x is Trovata => x !== null)
}

/** Scarica i byte veri. Commons manda CORS aperto, quindi si può
 *  leggere il blob e conservarlo nel deposito locale. Un'immagine del
 *  web invece la scarica il server (i siti non lo permettono al
 *  browser): prima l'originale, e se il sito lo nega la miniatura. */
export async function scarica(t: Trovata) {
  if (t.fonte && t.fonte !== 'commons') {
    for (const url of [t.originale, t.miniatura]) {
      const r = await fetch(`/api/immagini/scarica?url=${encodeURIComponent(url)}`).catch(() => null)
      if (r?.ok) return rimpicciolisci(await r.blob())
    }
    throw new Error('il sito non lascia scaricare l’immagine: provane un’altra')
  }
  const risposta = await fetch(t.miniatura)
  if (!risposta.ok) throw new Error(`Scaricamento fallito (${risposta.status})`)
  return risposta.blob()
}

/*  Le foto dal web arrivano anche da 5000 pixel e 8 MB: negli appunti
 *  ne bastano 1600, e il deposito (e il backup) ringraziano. */
const LATO_MASSIMO = 1600

async function rimpicciolisci(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob)
    const scala = Math.min(1, LATO_MASSIMO / Math.max(bmp.width, bmp.height))
    if (scala >= 1 && blob.size < 1_500_000) { bmp.close(); return blob }
    const tela = new OffscreenCanvas(Math.round(bmp.width * scala), Math.round(bmp.height * scala))
    tela.getContext('2d')!.drawImage(bmp, 0, 0, tela.width, tela.height)
    bmp.close()
    return await tela.convertToBlob({ type: 'image/jpeg', quality: 0.86 })
  } catch {
    return blob
  }
}
