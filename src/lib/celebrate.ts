/** Fiestita en pantalla: confeti o lluvia de flores. No hace nada con «reducir movimiento» activado. */
type Kind = "confetti" | "rain";

const COLORS = ["#b82a63", "#ff9d5c", "#ffd86b", "#7fe0a9", "#a66bff", "#ff7fb0"];
const EMOJIS = ["🌸", "💖", "🌷", "✨"];

export function celebrate(kind: Kind = "confetti") {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const rain = kind === "rain";
  const parts = Array.from({ length: rain ? 60 : 110 }, (_, i) => ({
    x: rain ? Math.random() * canvas.width : canvas.width / 2,
    y: rain ? -Math.random() * canvas.height * 0.4 : canvas.height * 0.55,
    vx: rain ? (Math.random() - 0.5) * 1.2 : (Math.random() - 0.5) * 16,
    vy: rain ? 2 + Math.random() * 3 : -8 - Math.random() * 10,
    g: rain ? 0.02 : 0.35,
    r: Math.random() * 6.28,
    vr: (Math.random() - 0.5) * 0.3,
    s: (8 + Math.random() * 10) * dpr,
    c: COLORS[i % COLORS.length],
    e: rain ? EMOJIS[i % EMOJIS.length] : null,
  }));
  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of parts) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > canvas.height + 40) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      if (p.e) {
        ctx.font = `${p.s * 1.6}px serif`;
        ctx.fillText(p.e, 0, 0);
      } else {
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      }
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
