import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AiLevel, ContactStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Recherche multi-mots : chaque mot doit apparaître dans prénom, nom, email, téléphone ou ville. */
export function contactSearchWhere(q: string | undefined): Prisma.ContactWhereInput {
  const terms = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return {};
  return {
    AND: terms.map((t) => {
      const digits = t.replace(/[^\d]/g, "");
      return {
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { email: { contains: t.toLowerCase() } },
          { city: { contains: t, mode: "insensitive" as const } },
          ...(digits.length >= 4
            ? [{ phoneMobile: { contains: digits.replace(/^0/, "") } }, { phoneHome: { contains: digits.replace(/^0/, "") } }]
            : []),
        ],
      };
    }),
  };
}

export const SCORE_BUCKETS: Record<AiLevel, [number, number]> = {
  froid: [0, 24],
  tiede: [25, 49],
  chaud: [50, 74],
  pret_a_reserver: [75, 100],
};

export const LAST_CONTACT_FILTERS = {
  "7j": "Moins de 7 jours",
  "30j": "Moins de 30 jours",
  "90j": "Moins de 90 jours",
  plus90j: "Plus de 90 jours",
  jamais: "Jamais contacté",
} as const;

export type ContactListFilters = {
  q?: string;
  status?: ContactStatus;
  destination?: string;
  score?: AiLevel | "non_analyse";
  lastContact?: keyof typeof LAST_CONTACT_FILTERS;
  owner?: string;
  sort?: "nom" | "score" | "contact";
  page?: number;
};

export const PAGE_SIZE = 25;

export async function listContacts(filters: ContactListFilters) {
  const and: Prisma.ContactWhereInput[] = [contactSearchWhere(filters.q)];
  if (filters.status) and.push({ status: filters.status });
  if (filters.owner) and.push({ ownerUserId: filters.owner });
  if (filters.destination) {
    and.push({
      interests: {
        some: {
          OR: [
            { destination: { equals: filters.destination, mode: "insensitive" } },
            { trip: { destination: filters.destination } },
          ],
        },
      },
    });
  }
  if (filters.score === "non_analyse") and.push({ lastScore: null });
  else if (filters.score) {
    const [min, max] = SCORE_BUCKETS[filters.score];
    and.push({ lastScore: { gte: min, lte: max } });
  }
  if (filters.lastContact) {
    const days = { "7j": 7, "30j": 30, "90j": 90, plus90j: 90, jamais: 0 }[filters.lastContact];
    const since = new Date(Date.now() - days * 86_400_000);
    if (filters.lastContact === "jamais") and.push({ lastInteractionAt: null });
    else if (filters.lastContact === "plus90j") and.push({ lastInteractionAt: { lt: since } });
    else and.push({ lastInteractionAt: { gte: since } });
  }

  const orderBy: Prisma.ContactOrderByWithRelationInput[] =
    filters.sort === "score"
      ? [{ lastScore: { sort: "desc", nulls: "last" } }, { lastName: "asc" }]
      : filters.sort === "contact"
        ? [{ lastInteractionAt: { sort: "desc", nulls: "last" } }, { lastName: "asc" }]
        : [{ lastName: "asc" }, { firstName: "asc" }];

  const where: Prisma.ContactWhereInput = { AND: and };
  const page = Math.max(1, filters.page ?? 1);
  const [total, rows] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        status: true,
        riderRole: true,
        lastScore: true,
        lastInteractionAt: true,
        owner: { select: { name: true } },
        _count: { select: { participations: { where: { booking: { status: { not: "annule" } } } } } },
        interests: {
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { destination: true, trip: { select: { destination: true, name: true } } },
        },
      },
    }),
  ]);
  return { total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), rows };
}

/** Destinations proposées dans le filtre : celles du catalogue et des intérêts libres. */
export async function listInterestDestinations(): Promise<string[]> {
  const [trips, free] = await Promise.all([
    db.trip.findMany({ distinct: ["destination"], select: { destination: true } }),
    db.tripInterest.findMany({ where: { destination: { not: null } }, distinct: ["destination"], select: { destination: true } }),
  ]);
  const set = new Set<string>([...trips.map((t) => t.destination), ...free.map((f) => f.destination!)]);
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}
