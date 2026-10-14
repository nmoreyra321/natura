import { QuickSale } from "@/components/admin/quick-sale";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Venta rápida" };

export default async function QuickSalePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Venta rápida</h1>
      <p className="mb-5 text-muted">
        Para las ventas que hacés por fuera de la tienda (vivos de Facebook, en persona, WhatsApp). Al registrarla se
        descuenta el stock y queda en Pedidos y en Ventas.
      </p>
      <QuickSale />
    </div>
  );
}
