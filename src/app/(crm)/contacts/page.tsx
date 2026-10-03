import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { ScorePill } from "@/components/common/score";
import { FilterSelect, Pagination, ResetFilters, SearchInput } from "@/components/common/filters";
import { ContactCreateDialog } from "@/components/contacts/contact-create-dialog";
import type { AiLevel, ContactStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { aiLevelLabels, contactStatusLabels, options, riderRoleLabels } from "@/lib/labels";
import { canAssign } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import {
  LAST_CONTACT_FILTERS,
  listContacts,
  listInterestDestinations,
  type ContactListFilters,
} from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Contacts" };

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: ContactListFilters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    status: pick<ContactStatus>(sp.statut, Object.keys(contactStatusLabels) as ContactStatus[]),
    destination: typeof sp.destination === "string" ? sp.destination : undefined,
    score: pick<AiLevel | "non_analyse">(sp.score, [...(Object.keys(aiLevelLabels) as AiLevel[]), "non_analyse"]),
    lastContact: pick(sp.contact, Object.keys(LAST_CONTACT_FILTERS) as (keyof typeof LAST_CONTACT_FILTERS)[]),
    owner: typeof sp.conseiller === "string" ? sp.conseiller : undefined,
    sort: pick(sp.tri, ["nom", "score", "contact"] as const),
    page: Number(sp.page) || 1,
  };

  const [{ rows, total, page, pageCount }, destinations, users] = await Promise.all([
    listContacts(filters),
    listInterestDestinations(),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const userOptions = users.map((u) => [u.id, u.name] as [string, string]);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Clients, prospects et passagers"
        actions={<ContactCreateDialog users={userOptions} canAssign={canAssign(user)} />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Nom, email, téléphone, ville…" />
        <FilterSelect param="statut" placeholder="Tous statuts" options={options(contactStatusLabels)} />
        <FilterSelect param="destination" placeholder="Toutes destinations d'intérêt" options={destinations.map((d) => [d, d])} />
        <FilterSelect param="score" placeholder="Tous scores" options={[...options(aiLevelLabels), ["non_analyse", "Non analysé"]]} />
        <FilterSelect param="contact" placeholder="Dernier contact" options={Object.entries(LAST_CONTACT_FILTERS)} />
        <FilterSelect param="conseiller" placeholder="Tous conseillers" options={userOptions} />
        <FilterSelect param="tri" placeholder="Tri : nom" options={[["score", "Tri : score"], ["contact", "Tri : dernier contact"]]} />
        <ResetFilters />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Intérêts</TableHead>
              <TableHead className="text-right">Voyages</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Dernier contact</TableHead>
              <TableHead>Conseiller</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {c.riderRole && `${riderRoleLabels[c.riderRole]} · `}
                    {c.email ?? "pas d'email"}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge value={c.status} label={contactStatusLabels[c.status]} />
                </TableCell>
                <TableCell>{c.city ?? "—"}</TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                  {c.interests.map((i) => i.trip?.name ?? i.destination).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c._count.participations}</TableCell>
                <TableCell>
                  <ScorePill score={c.lastScore} />
                </TableCell>
                <TableCell className="text-sm">{formatDate(c.lastInteractionAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.owner?.name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <EmptyState>Aucun contact ne correspond à ces critères</EmptyState>}
      </Card>
      <Pagination page={page} pageCount={pageCount} total={total} />
    </>
  );
}
