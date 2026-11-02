import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "highlight" = thẻ nền xanh đậm nổi bật theo mockup. */
  tone?: "default" | "highlight";
}

export function Card({ tone = "default", className = "", ...rest }: CardProps) {
  const toneClass =
    tone === "highlight"
      ? "bg-brand text-white"
      : "bg-white text-neutral-900 border border-neutral-200/70 dark:bg-panel-dark dark:text-neutral-100 dark:border-white/5";
  return <div {...rest} className={`rounded-xl2 p-5 shadow-sm ${toneClass} ${className}`} />;
}
