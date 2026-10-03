import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Mon compte" description={`${user.name} · ${user.email} · ${roleLabels[user.role]}`} />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Changer de mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
