"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/common/form";
import { cn } from "@/lib/utils";

/** Met à jour un paramètre d'URL (et remet la pagination à 1). */
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [router, pathname, params],
  );
}

export function FilterSelect({
  param,
  options,
  placeholder,
  className,
}: {
  param: string;
  options: [string, string][];
  placeholder: string;
  className?: string;
}) {
  const params = useSearchParams();
  const setParam = useSetParam();
  return (
    <NativeSelect
      aria-label={placeholder}
      className={cn("w-auto min-w-36", className)}
      options={options}
      placeholder={placeholder}
      value={params.get(param) ?? ""}
      onChange={(e) => setParam(param, e.target.value || null)}
    />
  );
}

export function SearchInput({ param = "q", placeholder = "Rechercher…" }: { param?: string; placeholder?: string }) {
  const params = useSearchParams();
  const setParam = useSetParam();
  const [value, setValue] = React.useState(params.get(param) ?? "");
  React.useEffect(() => {
    const current = params.get(param) ?? "";
    if (value === current) return;
    const t = setTimeout(() => setParam(param, value.trim() || null), 300);
    return () => clearTimeout(t);
  }, [value, param, params, setParam]);
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

export function ResetFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (params.size === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
      <X /> Réinitialiser
    </Button>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const setParam = useSetParam();
  if (pageCount <= 1) return <p className="mt-4 text-sm text-muted-foreground">{total} résultat(s)</p>;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} résultat(s) · page {page} / {pageCount}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
          Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setParam("page", String(page + 1))}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
