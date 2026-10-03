import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { roleLabels } from "@/lib/labels";
import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = { title: "Créer mon compte" };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const invitation = await db.invitation.findUnique({ where: { token } });
  const valid = invitation && !invitation.acceptedAt && invitation.expiresAt > new Date();

  if (!valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation invalide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ce lien a expiré ou a déjà été utilisé. Demandez une nouvelle invitation à un administrateur.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer mon compte</CardTitle>
        <p className="text-sm text-muted-foreground">
          {invitation.email} · {roleLabels[invitation.role]}
        </p>
      </CardHeader>
      <CardContent>
        <AcceptInvitationForm token={token} />
      </CardContent>
    </Card>
  );
}
