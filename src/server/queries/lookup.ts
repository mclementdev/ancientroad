import type { Prisma } from "@/generated/prisma/client";
import type { ContactLookup } from "@/lib/domain/lead-dedup";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

/** Implémentation Prisma du dédoublonnage. */
export function prismaContactLookup(client: Client = db): ContactLookup {
  return {
    async findIdByEmail(email) {
      const c = await client.contact.findUnique({ where: { email }, select: { id: true } });
      return c?.id ?? null;
    },
    async findIdByPhone(phone) {
      const c = await client.contact.findFirst({
        where: { OR: [{ phoneMobile: phone }, { phoneHome: phone }] },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return c?.id ?? null;
    },
  };
}
