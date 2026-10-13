import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "whatsapp";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-coral-deep text-white shadow-soft hover:bg-[#a93a30] hover:shadow-lift",
  secondary: "bg-botanical-deep text-white shadow-soft hover:bg-[#245a3c]",
  outline: "border border-forest/20 bg-warm-white text-forest hover:border-forest/40 hover:bg-white",
  ghost: "text-forest hover:bg-forest/5",
  danger: "bg-[#b42318] text-white hover:bg-[#912018]",
  whatsapp: "bg-[#1a7f4b] text-white shadow-soft hover:bg-[#156a3e]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className = "", ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
