import { Card } from "@/components/ui/card";
import { StoreProviders } from "@/components/store/providers";

export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center px-4 py-10 sm:py-16">
      <Card className="w-full p-6 sm:p-8">
        <h1 className="font-display text-2xl font-black sm:text-3xl">{title}</h1>
        {description && <p className="mb-6 mt-1 text-sm text-muted">{description}</p>}
        {!description && <div className="mb-6" />}
        <StoreProviders>{children}</StoreProviders>
      </Card>
    </div>
  );
}
