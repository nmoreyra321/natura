import type { ComponentProps, ReactNode } from "react";

export const inputClasses =
  "w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-base text-forest placeholder:text-muted/70 shadow-[inset_0_1px_2px_rgb(31_58_44/0.04)] transition-colors hover:border-forest/30 focus:border-botanical focus:outline-none focus:ring-3 focus:ring-botanical/20 aria-invalid:border-coral-deep aria-invalid:ring-coral-deep/15 disabled:bg-cream";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-forest">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-coral-deep">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClasses} h-11 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${inputClasses} min-h-32 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClasses} h-11 pr-10 ${className}`} {...props} />;
}

export function Checkbox({
  label,
  description,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-3.5 transition-colors hover:border-forest/30 has-[:checked]:border-botanical has-[:checked]:bg-sage/50 ${className}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--botanical-deep)]"
        {...props}
      />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
