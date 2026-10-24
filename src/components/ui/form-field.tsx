import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + hint/error wrapper. Pair the control with `aria-describedby={`${id}-msg`}`. */
export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${htmlFor}-msg`} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Props to spread on the control so it is linked to its FormField message. */
export const fieldA11y = (id: string, error?: string, hasHint = false) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error || hasHint ? `${id}-msg` : undefined,
});
