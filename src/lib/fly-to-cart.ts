/**
 * Un puntito sale del botón y viaja en arco hasta el ícono del carrito que se vea en pantalla
 * (el de arriba o el de la barra de abajo). Si no hay ninguno a la vista, no hace nada.
 */
export function flyToCart(from: HTMLElement): void {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  const target = targets.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height / 2;
  const ex = b.left + b.width / 2;
  const ey = b.top + b.height / 2;
  const cx = (sx + ex) / 2;
  const cy = Math.min(sy, ey) - 90;

  const dot = document.createElement("i");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText =
    "position:fixed;left:0;top:0;z-index:90;width:28px;height:28px;border-radius:9999px;pointer-events:none;background:#d1166b;box-shadow:0 6px 14px -4px rgb(209 22 107 / .7)";
  document.body.appendChild(dot);

  const frames: Keyframe[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const u = 1 - t;
    const x = u * u * sx + 2 * u * t * cx + t * t * ex - 14;
    const y = u * u * sy + 2 * u * t * cy + t * t * ey - 14;
    frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 - t * 0.5})`, opacity: t > 0.92 ? 0 : 1 });
  }
  const anim = dot.animate(frames, { duration: 750, easing: "cubic-bezier(.4,0,.6,1)" });
  anim.onfinish = () => dot.remove();
  anim.oncancel = () => dot.remove();
}
