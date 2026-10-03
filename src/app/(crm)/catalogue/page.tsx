import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { FilterSelect, ResetFilters } from "@/components/common/filters";
import { TripDialog } from "@/components/catalogue/catalogue-forms";
import type { Prisma } from "@/generated/prisma/client";
import type { TripFormat } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { options, ridingLevelLabels, tripFormatLabels } from "@/lib/labels";
import { canManageCatalog } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Catalogue" };

export default async function CataloguePage({ searchParams }: PageProps<"/catalogue">) {
  const user = await requireUser();
  const sp = await searchParams;
  const destination = typeof sp.destination === "string" ? sp.destination : undefined;
  const format = typeof sp.format === "string" && sp.format in tripFormatLabels ? (sp.format as TripFormat) : undefined;
  const active = sp.actif === "non" ? false : sp.actif === "tous" ? undefined : true;

  const where: Prisma.TripWhereInput = { destination, format, active };
  const today = new Date();
  const [trips, destinations] = await Promise.all([
    db.trip.findMany({
      where,
      orderBy: [{ destination: "asc" }, { name: "asc" }],
      include: {
        departures: {
          where: { startDate: { gte: today }, status: { notIn: ["annule", "termine"] } },
          orderBy: { startDate: "asc" },
          select: { startDate: true, seatsLeft: true },
        },
      },
    }),
    db.trip.findMany({ distinct: ["destination"], select: { destination: true }, orderBy: { destination: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Catalogue"
        description={`${trips.length} séjour(s)`}
        actions={canManageCatalog(user) && <TripDialog />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect param="destination" placeholder="Toutes destinations" options={destinations.map((d) => [d.destination, d.destination])} />
        <FilterSelect param="format" placeholder="Tous formats" options={options(tripFormatLabels)} />
        <FilterSelect param="actif" placeholder="Actifs" options={[["non", "Inactifs"], ["tous", "Actifs et inactifs"]]} />
        <ResetFilters />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Séjour</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead className="text-right">Durée</TableHead>
              <TableHead className="text-right">Prix de base</TableHead>
              <TableHead>Prochain départ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((t) => {
              const next = t.departures[0];
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/catalogue/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                    {!t.active && <StatusBadge className="ml-2" label="Inactif" tone="muted" />}
                    <div className="text-xs text-muted-foreground">{t.motorcycleModel}</div>
                  </TableCell>
                  <TableCell>
                    {t.destination}
                    {t.region && <div className="text-xs text-muted-foreground">{t.region}</div>}
                  </TableCell>
                  <TableCell>{tripFormatLabels[t.format]}</TableCell>
                  <TableCell>{ridingLevelLabels[t.level]}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.durationDays} j</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(t.basePrice)}</TableCell>
                  <TableCell>
                    {next ? (
                      <>
                        {formatDate(next.startDate)}
                        <div className="text-xs text-muted-foreground">
                          {next.seatsLeft} place(s) · {t.departures.length} départ(s) à venir
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {trips.length === 0 && <EmptyState>Aucun séjour ne correspond aux filtres</EmptyState>}
      </Card>
    </>
  );
}
