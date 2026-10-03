"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchContactsAction } from "@/server/actions/contacts";
import { cn } from "@/lib/utils";

export type PickedContact = { id: string; firstName: string; lastName: string; email: string | null; city: string | null };

/**
 * Sélecteur de contact avec recherche serveur. Si `name` est fourni, un champ caché
 * porte l'id choisi pour les formulaires.
 */
export function ContactPicker({
  name,
  value,
  onChange,
  placeholder = "Rechercher un contact…",
  excludeIds = [],
  className,
}: {
  name?: string;
  value: PickedContact | null;
  onChange: (c: PickedContact | null) => void;
  placeholder?: string;
  excludeIds?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Résultats associés à la requête qui les a produits : « en cours » se déduit de l'écart
  const [found, setFound] = React.useState<{ query: string; results: PickedContact[] }>({ query: "", results: [] });
  const searchable = query.trim().length >= 2;
  const loading = searchable && found.query !== query;

  React.useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const results = await searchContactsAction(query);
      if (!cancelled) setFound({ query, results });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const visible = searchable ? found.results.filter((r) => !excludeIds.includes(r.id)) : [];

  return (
    <>
      {name && <input type="hidden" name={name} value={value?.id ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className={cn("w-full justify-between font-normal", className)}>
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? `${value.firstName} ${value.lastName}` : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Nom, email, téléphone…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{!searchable ? "Tapez au moins 2 caractères" : loading ? "Recherche…" : "Aucun contact"}</CommandEmpty>
              {visible.length > 0 && (
                <CommandGroup>
                  {visible.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("size-4", value?.id === c.id ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0">
                        <div className="truncate">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{[c.email, c.city].filter(Boolean).join(" · ")}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
