import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
  as?: "h1" | "h2";
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({ title, description, eyebrow, as: Tag = "h2", align = "center", className }: SectionHeadingProps) {
  return (
    <div className={cn("reveal space-y-3", align === "center" && "text-center", className)}>
      {eyebrow && (
        <span className="inline-block rounded-sm bg-accent-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent">{eyebrow}</span>
      )}
      <Tag className="font-display text-3xl font-black text-foreground sm:text-4xl lg:text-[40px] lg:leading-tight">{title}</Tag>
      {description && <p className={cn("text-base text-muted", align === "center" && "mx-auto max-w-2xl")}>{description}</p>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-20", className)}>{children}</div>;
}
