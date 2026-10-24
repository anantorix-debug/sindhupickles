"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/admin/common/empty-state";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "left" | "right";
}

export interface TableFilter<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  matches: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Text used by the search box. Omit to hide search. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  rowActions?: (row: T) => React.ReactNode;
  toolbar?: React.ReactNode;
  pageSize?: number;
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  caption: string;
  initialQuery?: string;
}

type SortState = { id: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  data,
  getRowId,
  searchText,
  searchPlaceholder = "Search…",
  filters = [],
  rowActions,
  toolbar,
  pageSize = 8,
  loading,
  error,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  caption,
  initialQuery = "",
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState(initialQuery);
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>({});
  const [sort, setSort] = React.useState<SortState>(null);
  const [page, setPage] = React.useState(1);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = data.filter((row) => {
      if (q && searchText && !searchText(row).toLowerCase().includes(q)) return false;
      return filters.every((f) => {
        const v = filterValues[f.id];
        return !v || f.matches(row, v);
      });
    });
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const get = col.sortValue;
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * dir;
        });
      }
    }
    return out;
  }, [data, query, filterValues, sort, columns, filters, searchText]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);
  const isFiltered = query.trim() !== "" || Object.values(filterValues).some(Boolean);

  const toggleSort = (id: string) => {
    setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
    setPage(1);
  };

  const hasToolbar = searchText || filters.length > 0 || toolbar;

  return (
    <Card className="overflow-hidden">
      {hasToolbar && (
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          {searchText && (
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                aria-label={`Search ${caption}`}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          )}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {filters.map((f) => (
              <Select
                key={f.id}
                aria-label={f.label}
                value={filterValues[f.id] ?? ""}
                onChange={(e) => {
                  setFilterValues((v) => ({ ...v, [f.id]: e.target.value }));
                  setPage(1);
                }}
                className="w-auto min-w-36"
              >
                <option value="">{f.label}: All</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ))}
            {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
          </div>
        </div>
      )}

      {error ? (
        <ErrorState description={error} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                {columns.map((c) => {
                  const active = sort?.id === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn("px-4 py-3 font-semibold", c.align === "right" && "text-right", c.className)}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.id)}
                          className={cn(
                            "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent",
                            active && "text-accent",
                          )}
                        >
                          {c.header}
                          {active ? (
                            sort.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {rowActions && (
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {columns.map((c) => (
                        <td key={c.id} className="px-4 py-4">
                          <Skeleton className="h-4 w-full max-w-32" />
                        </td>
                      ))}
                      {rowActions && <td className="px-4 py-4" />}
                    </tr>
                  ))
                : visible.map((row) => (
                    <tr key={getRowId(row)} className="border-b border-border transition-colors last:border-0 hover:bg-surface-raised/60">
                      {columns.map((c) => (
                        <td key={c.id} className={cn("px-4 py-3.5 align-middle", c.align === "right" && "text-right", c.className)}>
                          {c.cell(row)}
                        </td>
                      ))}
                      {rowActions && <td className="px-4 py-3.5 text-right">{rowActions(row)}</td>}
                    </tr>
                  ))}
            </tbody>
          </table>

          {!loading && rows.length === 0 &&
            (isFiltered ? (
              <EmptyState
                icon={SearchX}
                title="No results found"
                description="Try a different search term or clear the filters."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setFilterValues({});
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
            ))}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted sm:flex-row">
          <p aria-live="polite">
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="px-2 text-foreground">
              Page {current} of {pageCount}
            </span>
            <Button variant="secondary" size="sm" disabled={current === pageCount} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
