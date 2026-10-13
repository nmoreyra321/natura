/** Ilustración botánica decorativa del hero (sin texto). */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 440" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="hb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fcebee" />
          <stop offset="1" stopColor="#f8d7dd" />
        </linearGradient>
      </defs>
      <path
        d="M241 22c86-6 182 42 210 128 27 84-25 182-104 230-80 48-189 46-258-14C20 306-6 196 37 121 77 51 155 28 241 22Z"
        fill="url(#hb)"
      />
      <circle cx="380" cy="86" r="34" fill="#f0766a" opacity=".85" />
      <circle cx="96" cy="350" r="18" fill="#f0766a" opacity=".5" />
      <g className="animate-float" style={{ transformOrigin: "240px 260px" }}>
        <path d="M238 410c-6-90 8-170 60-250" stroke="#2f6b4a" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M298 160c40-30 92-34 120-20-18 40-70 64-120 20Z" fill="#3e7c59" />
        <path d="M268 236c-50-34-108-32-138-14 22 42 82 60 138 14Z" fill="#3e7c59" opacity=".85" />
        <path d="M252 318c42-20 92-14 116 6-24 32-78 38-116-6Z" fill="#2f6b4a" opacity=".9" />
        <path d="M244 372c-36-24-80-24-104-8 18 32 66 44 104 8Z" fill="#3e7c59" opacity=".7" />
      </g>
      <g transform="translate(150 110)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-22" rx="14" ry="24" fill="#fffcf8" transform={`rotate(${r})`} />
        ))}
        <circle r="10" fill="#f0766a" />
      </g>
      <g transform="translate(360 300) scale(.7)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-22" rx="14" ry="24" fill="#fffcf8" transform={`rotate(${r})`} />
        ))}
        <circle r="10" fill="#c2453a" />
      </g>
    </svg>
  );
}
