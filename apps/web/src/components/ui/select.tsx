import { forwardRef, type SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        "w-full rounded border border-navy-100 bg-white px-3 py-2 text-sm text-ink",
        "focus:border-navy focus:outline-none dark:border-navy-400 dark:bg-navy-900 dark:text-paper",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
