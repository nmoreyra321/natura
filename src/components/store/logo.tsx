import Link from "next/link";

export function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path
        d="M16 29c0-9 2-15 10-21-9 0-15 5-15 13 0 2 .5 4 1.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M26 8C17 8 11 13 11 21c0 3 1.5 6 5 8 6-4 10-11 10-21Z" fill="currentColor" opacity=".22" />
      <circle cx="9" cy="9" r="4" fill="var(--coral)" />
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
      <LeafMark className="size-8 text-botanical transition-transform duration-300 group-hover:-rotate-6" />
      <span className="font-display text-[1.55rem] leading-none font-semibold tracking-tight">
        Natu <span className="italic text-coral-deep">Mariel</span>
      </span>
    </Link>
  );
}
