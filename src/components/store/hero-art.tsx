/** Ilustración del hero: manchas de color, flores y hojas (sin texto ni productos). */
export function HeroArt({ className = "" }: { className?: string }) {
  const flower = (x: number, y: number, s: number, petal: string, center: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="0" cy="-22" rx="14" ry="24" fill={petal} transform={`rotate(${r})`} />
      ))}
      <circle r="11" fill={center} />
    </g>
  );
  return (
    <svg viewBox="0 0 480 460" aria-hidden="true" className={className}>
      <path
        d="M248 30c92-8 190 48 206 140 16 90-46 176-128 222-84 47-198 40-262-28C3 300-12 196 40 122 84 59 160 38 248 30Z"
        fill="#ffc4d6"
      />
      <path d="M92 80c40-30 104-20 120 22 14 38-22 80-70 82-56 2-92-66-50-104Z" fill="#ffd45c" className="animate-float-slow" style={{ transformOrigin: "140px 120px" }} />
      <path d="M352 300c46-14 98 16 100 60 2 40-44 66-90 58-52-8-62-102-10-118Z" fill="#d7f2e3" />
      <circle cx="392" cy="96" r="38" fill="#ff9a62" className="animate-float" style={{ transformOrigin: "392px 96px" }} />
      <circle cx="84" cy="372" r="22" fill="#7b3fa0" opacity=".85" />
      <circle cx="440" cy="210" r="10" fill="#d1166b" />
      <circle cx="54" cy="236" r="8" fill="#2fa36b" />
      <g className="animate-float" style={{ transformOrigin: "240px 280px" }}>
        <path d="M238 430c-6-96 10-180 66-260" stroke="#1b7a57" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M304 170c44-32 100-36 130-20-20 42-76 68-130 20Z" fill="#2fa36b" />
        <path d="M270 248c-54-36-116-34-148-14 24 44 88 62 148 14Z" fill="#2fa36b" />
        <path d="M254 334c46-22 100-16 126 6-26 34-84 40-126-6Z" fill="#1b7a57" />
      </g>
      {flower(164, 124, 1.15, "#ffffff", "#d1166b")}
      {flower(312, 160, 0.9, "#d1166b", "#ffd45c")}
      {flower(372, 330, 0.75, "#ffffff", "#ff9a62")}
      {flower(120, 300, 0.6, "#7b3fa0", "#ffd45c")}
      {/* destellos */}
      {[
        [210, 60],
        [430, 150],
        [60, 160],
        [300, 420],
      ].map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y - 12} L${x + 3} ${y - 3} L${x + 12} ${y} L${x + 3} ${y + 3} L${x} ${y + 12} L${x - 3} ${y + 3} L${x - 12} ${y} L${x - 3} ${y - 3} Z`}
          fill="#ffd45c"
        />
      ))}
    </svg>
  );
}

/** Onda decorativa para separar secciones. */
export function Wave({ className = "", color = "var(--sun)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" className={`relative z-[1] -my-px block h-8 w-full sm:h-12 ${className}`}>
      <path d="M0 30 C 120 0 240 60 360 30 S 600 0 720 30 S 960 60 1080 30 S 1320 0 1440 30 V60 H0 Z" fill={color} />
    </svg>
  );
}
