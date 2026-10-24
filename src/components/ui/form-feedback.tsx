import { CheckCircle2, CircleAlert } from "lucide-react";

export function FormSuccess({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
