import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DeleteDepartureButton,
  DeleteTripButton,
  DepartureDialog,
  TripDialog,
} from "@/components/catalogue/catalogue-forms";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, toDateInput, toNumber } from "@/lib/format";
import { departureStatusLabels, ridingLevelLabels, tripFormatLabels } from "@/lib/labels";
import { canManageCatalog } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/catalogue/[tripId]">): Promise<Metadata> {
  const { tripId } = await params;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { name: true } });
  return { title: trip?.name ?? "Séjour" };
}

export default async function TripPage({ params }: PageProps<"/catalogue/[tripId]">) {
  const user = await requireUser();
  const { tripId } = await params;
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      departures: {
        orderBy: { startDate: "asc" },
        include: { _count: { select: { bookings: { where: { status: { not: "annule" } } } } } },
      },
      _count: { select: { interests: true } },
    },
  });
  if (!trip) notFound();
  const canEdit = canManageCatalog(user);

  const facts: [string, React.ReactNode][] = [
    ["Destination", `${trip.destination}${trip.region ? ` · ${trip.region}` : ""} (${trip.country})`],
    ["Format", tripFormatLabels[trip.format]],
    ["Niveau requis", ridingLevelLabels[trip.level]],
    ["Durée", `${trip.durationDays} jours`],
    ["Moto fournie", trip.motorcycleModel ?? "—"],
    ["Prix de base", formatCurrency(trip.basePrice)],
    ["Contacts intéressés", trip._count.interests],
  ];

  return (
    <>
      <Link href="/catalogue" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Catalogue
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {trip.name}
            {!trip.active && <StatusBadge label="Inactif" tone="muted" />}
          </span>
        }
        description={trip.description}
        actions={
          canEdit && (
            <>
              <TripDialog
                trip={{
                  id: trip.id,
                  name: trip.name,
                  destination: trip.destination,
                  country: trip.country,
                  region: trip.region,
                  durationDays: trip.durationDays,
                  level: trip.level,
                  format: trip.format,
                  motorcycleModel: trip.motorcycleModel,
                  basePrice: toNumber(trip.basePrice),
                  description: trip.description,
                  active: trip.active,
                }}
              />
              <DeleteTripButton tripId={trip.id} />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Départs</CardTitle>
            {canEdit && <DepartureDialog tripId={trip.id} defaults={{ price: toNumber(trip.basePrice) }} />}
          </CardHeader>
          <CardContent>
            {trip.departures.length === 0 ? (
              <EmptyState>Aucun départ programmé</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dates</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Places</TableHead>
                    <TableHead className="text-right">Réservations</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.departures.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {formatDate(d.startDate)} → {formatDate(d.endDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={d.status} label={departureStatusLabels[d.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(d.price)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.seatsLeft} / {d.seatsTotal}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/reservations?depart=${d.id}`} className="tabular-nums hover:underline">
                          {d._count.bookings}
                        </Link>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <DepartureDialog
                            tripId={trip.id}
                            departure={{
                              id: d.id,
                              startDate: toDateInput(d.startDate),
                              endDate: toDateInput(d.endDate),
                              price: toNumber(d.price),
                              seatsTotal: d.seatsTotal,
                              status: d.status,
                            }}
                          />
                          <DeleteDepartureButton departureId={d.id} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
