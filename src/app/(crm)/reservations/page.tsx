import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { FilterSelect, ResetFilters, SearchInput } from "@/components/common/filters";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { bookingStatusLabels, options } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { contactSearchWhere } from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Réservations" };

export default async function BookingsPage({ searchParams }: PageProps<"/reservations">) {
  await requireUser();
  const sp = await searchParams;
  const status = typeof sp.statut === "string" && sp.statut in bookingStatusLabels ? (sp.statut as BookingStatus) : undefined;
  const departureId = typeof sp.depart === "string" ? sp.depart : undefined;
  const period = typeof sp.periode === "string" ? sp.periode : "avenir";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Prisma.BookingWhereInput = {
    status,
    departureId,
    departure: departureId ? undefined : period === "avenir" ? { endDate: { gte: today } } : period === "passees" ? { endDate: { lt: today } } : undefined,
    ...(q ? { participants: { some: { contact: contactSearchWhere(q) } } } : {}),
  };

  const bookings = await db.booking.findMany({
    where,
    orderBy: { departure: { startDate: period === "passees" ? "desc" : "asc" } },
    take: 200,
    include: {
      departure: { include: { trip: { select: { id: true, name: true } } } },
      payer: { select: { id: true, firstName: true, lastName: true } },
      participants: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  const sum = bookings.filter((b) => b.status === "confirme" || b.status === "solde").reduce((s, b) => s + Number(b.totalAmount), 0);

  return (
    <>
      <PageHeader
        title="Réservations"
        description={`${bookings.length} réservation(s) · ${formatCurrency(sum)} confirmés ou soldés`}
        actions={
          <Button asChild>
            <Link href="/reservations/nouvelle">
              <Plus /> Nouvelle réservation
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Participant…" />
        <FilterSelect param="periode" placeholder="À venir" options={[["passees", "Passées"], ["toutes", "Toutes"]]} />
        <FilterSelect param="statut" placeholder="Tous statuts" options={options(bookingStatusLabels)} />
        <ResetFilters />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Départ</TableHead>
              <TableHead>Payeur</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Réservé le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link href={`/reservations/${b.id}`} className="font-medium hover:underline">
                    {b.departure.trip.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(b.departure.startDate)} → {formatDate(b.departure.endDate)}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/contacts/${b.payer.id}`} className="hover:underline">
                    {b.payer.firstName} {b.payer.lastName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-72 text-sm">
                  {b.participants.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/contacts/${p.contact.id}`} className="hover:underline">
                        {p.contact.firstName} {p.contact.lastName}
                      </Link>
                      <span className="text-muted-foreground"> ({p.role === "pilote" ? "P" : "Pa"})</span>
                    </span>
                  ))}
                </TableCell>
                <TableCell>
                  <StatusBadge value={b.status} label={bookingStatusLabels[b.status]} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(b.totalAmount, b.currency)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(b.bookedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {bookings.length === 0 && <EmptyState>Aucune réservation</EmptyState>}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">P = pilote, Pa = passager</p>
    </>
  );
}
