import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-lime text-brand-dark hover:bg-lime-dark",
  dark: "bg-brand text-white hover:bg-brand-light dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark",
  outline:
    "border border-neutral-300 bg-transparent text-neutral-800 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-white/5",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
