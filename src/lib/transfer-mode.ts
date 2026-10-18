/** Si hay alias o CBU cargado, «Transferencia» es siempre por alias; el link de Mercado Pago solo se usa cuando es lo único cargado. */
export function paysWithMpLink(t: { alias: string | null; cbu: string | null; mpLink: string | null } | null | undefined): boolean {
  return Boolean(t?.mpLink && !t.alias && !t.cbu);
}
