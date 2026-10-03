import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/common/page-header";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/labels";
import { canManageUsers } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { InviteForm, InvitationLink, RevokeButton, RoleSelect } from "./users-client";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const me = await requireUser();
  if (!canManageUsers(me)) notFound();

  const [users, invitations] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <>
      <PageHeader title="Utilisateurs" description="Comptes de l'équipe et invitations en attente" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-44">Rôle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.id === me.id ? roleLabels[u.role] : <RoleSelect userId={u.id} role={u.role} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inviter une personne</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invitations en attente</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {invitations.length === 0 && <EmptyState>Aucune invitation en attente</EmptyState>}
              {invitations.map((inv) => (
                <div key={inv.id} className="grid gap-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {roleLabels[inv.role]} · expire le {formatDate(inv.expiresAt)}
                      </div>
                    </div>
                    <RevokeButton invitationId={inv.id} />
                  </div>
                  <InvitationLink url={`${appUrl}/invitation/${inv.token}`} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
