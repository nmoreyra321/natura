import Link from "next/link";

/** Marca: una flor alegre de cinco pétalos de colores. */
export function LeafMark({ className = "" }: { className?: string }) {
  const petals = ["#d1166b", "#ff9a62", "#ffd45c", "#2fa36b", "#7b3fa0"];
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      {petals.map((color, i) => (
        <ellipse key={color} cx="16" cy="8.5" rx="5" ry="7" fill={color} transform={`rotate(${i * 72} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="4.5" fill="#fff7ef" />
      <circle cx="16" cy="16" r="2.4" fill="#3b1e4a" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2 rounded-lg text-forest ${className}`}
      aria-label="Natu Mariel, ir al inicio"
    >
      <LeafMark className="size-9 transition-transform duration-500 group-hover:rotate-[72deg]" />
      <span className="font-display text-[1.6rem] leading-none font-bold tracking-tight">
        Natu <span className="text-coral-deep">Mariel</span>
      </span>
    </Link>
  );
}
