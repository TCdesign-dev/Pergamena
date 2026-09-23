/** «adesso», «12 min fa», «alle 9:40», «il 3/10 alle 9:40». */
export function quandoFa(ms: number) {
  const minuti = Math.round((Date.now() - ms) / 60_000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return `${minuti} min fa`
  const d = new Date(ms)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return new Date().toDateString() === d.toDateString()
    ? `alle ${ora}`
    : `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${ora}`
}
