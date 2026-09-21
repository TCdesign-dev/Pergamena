import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ascolto } from './server/ascolto'
import { llm } from './server/llm'
import { immagini } from './server/immagini'

export default defineConfig(({ mode }) => {
  // tutte le variabili, anche quelle SENZA prefisso VITE_: servono
  // solo qui, lato server, e non arrivano mai al browser
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), ascolto(env), llm(env), immagini(env)],
    server: { port: 5180 },
  }
})
