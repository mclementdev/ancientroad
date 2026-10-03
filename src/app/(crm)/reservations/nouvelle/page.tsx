import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { listBookableDepartures } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Nouvelle réservation" };

export default async function NewBookingPage({ searchParams }: PageProps<"/reservations/nouvelle">) {
  await requireUser();
  const sp = await searchParams;
  const contactId = typeof sp.contact === "string" ? sp.contact : undefined;
  const departureId = typeof sp.depart === "string" ? sp.depart : undefined;
  const [departures, payer] = await Promise.all([
    listBookableDepartures(),
    contactId
      ? db.contact.findUnique({ where: { id: contactId }, select: { id: true, firstName: true, lastName: true, email: true, city: true } })
      : null,
  ]);

  return (
    <>
      <Link
        href={payer ? `/contacts/${payer.id}` : "/reservations"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {payer ? `${payer.firstName} ${payer.lastName}` : "Réservations"}
      </Link>
      <PageHeader title="Nouvelle réservation" description="Départ, payeur et participants pilotes / passagers" />
      <Card>
        <CardContent>
          <BookingForm departures={departures} initial={{ payer, departureId }} />
        </CardContent>
      </Card>
    </>
  );
}
