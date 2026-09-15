import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded border border-navy-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-navy-400",
        "focus:border-navy focus:outline-none dark:border-navy-400 dark:bg-navy-900 dark:text-paper",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
