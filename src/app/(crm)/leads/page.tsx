import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { FilterSelect, ResetFilters } from "@/components/common/filters";
import { ConvertLeadDialog, LeadAssignSelect, LeadStatusDialog } from "@/components/leads/lead-controls";
import type { Prisma } from "@/generated/prisma/client";
import type { LeadChannel, LeadStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/normalize";
import { leadChannelLabels, leadStatusLabels, options } from "@/lib/labels";
import { canAssign } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

const OPEN: LeadStatus[] = ["nouveau", "qualification", "devis_envoye"];
const DAY = 86_400_000;

function ageLabel(createdAt: Date, now: number) {
  const h = Math.floor((now - createdAt.getTime()) / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requireUser();
  const sp = await searchParams;
  const statusParam = typeof sp.statut === "string" ? sp.statut : "ouverts";
  const channel = typeof sp.canal === "string" && sp.canal in leadChannelLabels ? (sp.canal as LeadChannel) : undefined;
  const assignee = typeof sp.affecte === "string" ? sp.affecte : undefined;

  const where: Prisma.LeadWhereInput = {
    status:
      statusParam === "tous"
        ? undefined
        : statusParam in leadStatusLabels
          ? (statusParam as LeadStatus)
          : { in: OPEN },
    channel,
    assignedUserId: assignee === "moi" ? user.id : assignee === "personne" ? null : assignee,
  };

  const [leads, users] = await Promise.all([
    db.lead.findMany({
      where,
      // File unique : les nouveaux d'abord, puis les plus anciens en premier (FIFO)
      orderBy: [{ createdAt: "asc" }],
      take: 200,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        trip: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const statusRank: Record<LeadStatus, number> = { nouveau: 0, qualification: 1, devis_envoye: 2, injoignable: 3, gagne: 4, perdu: 5 };
  leads.sort((a, b) => statusRank[a.status] - statusRank[b.status]);

  // Composant serveur rendu à chaque requête : lire l'heure courante est voulu ici
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const late = leads.filter((l) => l.status === "nouveau" && now - l.createdAt.getTime() > DAY).length;
  const userOptions = users.map((u) => [u.id, u.name] as [string, string]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="File unique des demandes entrantes (site, rappels, appels)"
        actions={
          late > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-800">
              <AlertTriangle className="size-4" /> {late} lead(s) « nouveau » depuis plus de 24 h
            </span>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          param="statut"
          placeholder="Ouverts"
          options={[...options(leadStatusLabels), ["tous", "Tous les statuts"]]}
        />
        <FilterSelect param="canal" placeholder="Tous canaux" options={options(leadChannelLabels)} />
        <FilterSelect param="affecte" placeholder="Toute l'équipe" options={[["moi", "Mes leads"], ["personne", "Non affectés"], ...userOptions]} />
        <ResetFilters />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reçu</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Séjour / message</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Affecté à</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => {
              const isLate = l.status === "nouveau" && now - l.createdAt.getTime() > DAY;
              const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "Anonyme";
              return (
                <TableRow key={l.id} className={cn(isLate && "bg-red-50/60")}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className={cn(isLate && "font-medium text-red-700")}>{ageLabel(l.createdAt, now)}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    {l.contact ? (
                      <Link href={`/contacts/${l.contact.id}`} className="font-medium hover:underline">
                        {l.contact.firstName} {l.contact.lastName}
                      </Link>
                    ) : (
                      <span className="font-medium">{name}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {[l.email, l.phone && formatPhone(l.phone)].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {leadChannelLabels[l.channel]}
                    {l.callbackAt && (
                      <div className="text-xs text-muted-foreground">
                        {l.callbackSlot ?? "Rappel"} · {formatDateTime(l.callbackAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 text-sm">
                    {l.trip && (
                      <Link href={`/catalogue/${l.trip.id}`} className="font-medium hover:underline">
                        {l.trip.name}
                      </Link>
                    )}
                    {l.message && <p className="line-clamp-2 text-muted-foreground">{l.message}</p>}
                    {l.utmSource && (
                      <div className="text-[11px] text-muted-foreground">
                        {l.utmSource}
                        {l.utmCampaign && ` / ${l.utmCampaign}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <LeadStatusDialog
                      leadId={l.id}
                      status={l.status}
                      lostReason={l.lostReason}
                      label={<StatusBadge value={l.status} label={leadStatusLabels[l.status]} className="cursor-pointer" />}
                    />
                    {l.lostReason && <div className="mt-1 max-w-40 text-xs text-muted-foreground">{l.lostReason}</div>}
                  </TableCell>
                  <TableCell>
                    <LeadAssignSelect
                      leadId={l.id}
                      assignedUserId={l.assignedUserId}
                      users={userOptions}
                      canAssign={canAssign(user)}
                      currentUserId={user.id}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!l.contact && (
                      <ConvertLeadDialog
                        lead={{ id: l.id, firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {leads.length === 0 && <EmptyState>Aucun lead dans cette vue</EmptyState>}
      </Card>
    </>
  );
}
