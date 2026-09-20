/** Toglie accenti e maiuscole, così cercare "citazione" trova
 *  "Citazione" e "matematica" trova "Matemàtica". */
export function normalizza(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
