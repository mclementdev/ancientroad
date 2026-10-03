import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { BookingForm } from "@/components/bookings/booking-form";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/format";
import { bookingStatusLabels, departureStatusLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { listBookableDepartures } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Réservation" };

export default async function BookingPage({ params }: PageProps<"/reservations/[id]">) {
  await requireUser();
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      departure: { include: { trip: true } },
      payer: { select: { id: true, firstName: true, lastName: true, email: true, city: true } },
      participants: {
        orderBy: { role: "asc" },
        include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, city: true } } },
      },
    },
  });
  if (!booking) notFound();
  const departures = await listBookableDepartures(booking.departureId);
  const d = booking.departure;

  return (
    <>
      <Link href="/reservations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Réservations
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.trip.name}
            <StatusBadge value={booking.status} label={bookingStatusLabels[booking.status]} />
          </span>
        }
        description={`${formatDate(d.startDate)} → ${formatDate(d.endDate)} · réservé le ${formatDateTime(booking.bookedAt)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Montant total</div>
              <div className="text-xl font-semibold tabular-nums">{formatCurrency(booking.totalAmount, booking.currency)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Payeur</div>
              <Link href={`/contacts/${booking.payer.id}`} className="hover:underline">
                {booking.payer.firstName} {booking.payer.lastName}
              </Link>
            </div>
            <div>
              <div className="text-muted-foreground">Départ</div>
              <Link href={`/catalogue/${d.trip.id}`} className="hover:underline">
                {d.trip.name}
              </Link>{" "}
              · {departureStatusLabels[d.status]} · {d.seatsLeft}/{d.seatsTotal} places libres
            </div>
            <div>
              <div className="text-muted-foreground">Participants</div>
              <ul>
                {booking.participants.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={`/contacts/${p.contact.id}`} className="hover:underline">
                      {p.contact.firstName} {p.contact.lastName}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">
                      {p.role} · {formatCurrency(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modifier la réservation</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingForm
              bookingId={booking.id}
              departures={departures}
              initial={{
                departureId: booking.departureId,
                status: booking.status,
                payer: booking.payer,
                participants: booking.participants.map((p) => ({ contact: p.contact, role: p.role, amount: toNumber(p.amount) })),
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
