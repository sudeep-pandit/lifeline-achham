import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-paper hover:bg-navy-600 dark:bg-crimson dark:hover:bg-crimson-600",
  secondary: "bg-transparent border border-navy-100 text-navy hover:bg-navy-50 dark:border-navy-400 dark:text-paper dark:hover:bg-navy-600",
  ghost: "bg-transparent text-navy hover:bg-navy-50 dark:text-paper dark:hover:bg-navy-600",
  danger: "bg-crimson text-paper hover:bg-crimson-600",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
