import { formatARS } from "@/lib/format";

/**
 * Barra del carrito: cuánto falta para sumar al Club y para el envío a domicilio.
 * Se llena sola a medida que suben los productos y brilla cuando llega a todo.
 */
export function CartProgress({
  totalCents,
  clubMinCents,
  shippingMinCents,
  shippingAvailable,
}: {
  totalCents: number;
  clubMinCents: number;
  shippingMinCents: number;
  shippingAvailable: boolean;
}) {
  const target = shippingAvailable && shippingMinCents > 0 ? shippingMinCents : clubMinCents;
  if (target <= 0) return null;
  const pct = Math.min(100, Math.round((totalCents / target) * 100));
  const full = totalCents >= target;
  let message: React.ReactNode;
  if (clubMinCents > 0 && totalCents < clubMinCents) {
    message = (
      <>
        Te faltan <strong>{formatARS(clubMinCents - totalCents)}</strong> para sumar al Club 🎁
      </>
    );
  } else if (shippingAvailable && shippingMinCents > 0 && totalCents < shippingMinCents) {
    message = (
      <>
        {clubMinCents > 0 ? "¡Ya suma al Club! 🎁 " : ""}Te faltan <strong>{formatARS(shippingMinCents - totalCents)}</strong> para el envío a domicilio 🚚
      </>
    );
  } else {
    message = <>{shippingAvailable && shippingMinCents > 0 ? "🚚 ¡Tenés envío a domicilio!" : ""}{clubMinCents > 0 ? " Y suma al Club 🎁" : ""}</>;
  }
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70" role="status">
      <div className="h-4 overflow-hidden rounded-full bg-line/70" aria-hidden="true">
        <div className={`cart-bar h-full rounded-full ${full ? "cart-bar-full" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold">{message}</p>
    </div>
  );
}
