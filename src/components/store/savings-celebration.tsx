import { formatARS } from "@/lib/format";

/** Cartelito de "¡Felicitaciones!" con el ahorro total frente al precio de revista. */
export function SavingsCelebration({ savingsCents, totalCents }: { savingsCents: number; totalCents: number }) {
  if (savingsCents <= 0) return null;
  const percent = Math.floor((savingsCents * 100) / (totalCents + savingsCents));
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-sun bg-sun/50 px-3 py-2.5 text-sm leading-snug">
      <span className="text-xl" aria-hidden="true">
        🎉
      </span>
      <p>
        <strong>¡Felicitaciones!</strong> Con Natu Mariel ahorrás{" "}
        <strong key={savingsCents} className="animate-pop inline-block whitespace-nowrap text-botanical-deep tabular">
          {formatARS(savingsCents)}
        </strong>
        {percent >= 1 ? (
          <span className="ml-1 rounded-full bg-botanical-deep px-1.5 py-0.5 text-xs font-bold text-white tabular">
            −{percent}%
          </span>
        ) : null}{" "}
        frente al precio de revista.
      </p>
    </div>
  );
}
