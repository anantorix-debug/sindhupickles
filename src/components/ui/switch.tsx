import * as React from "react";
import { cn } from "@/lib/utils";

/** Accessible toggle built on a native checkbox so it works with React Hook Form's `register`. */
export const Switch = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
        "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform checked:after:translate-x-5",
        className,
      )}
      {...props}
    />
  ),
);
Switch.displayName = "Switch";
