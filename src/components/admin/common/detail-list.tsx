import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DetailRow {
  label: string;
  value: React.ReactNode;
}

/** Labelled key/value list inside a titled card — used on detail pages. */
export function DetailCard({ title, rows, actions }: { title: string; rows: DetailRow[]; actions?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{r.label}</dt>
              <dd className="mt-1 break-words text-sm text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
