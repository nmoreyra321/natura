/** Para quién es un producto, según su nombre ("Desodorante Kaiak Masculino" → masculino). null = para todos. */
export function guessGender(name: string): "femenino" | "masculino" | null {
  if (/(masculin|homem|hombre)/i.test(name)) return "masculino";
  if (/(femenin|mujer)/i.test(name)) return "femenino";
  return null;
}
