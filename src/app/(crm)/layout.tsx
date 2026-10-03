import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { db } from "@/lib/db";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export default async function CrmLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const newLeads = await db.lead.count({ where: { status: "nouveau" } });
  const nav = { newLeads, isAdmin: user.role === "admin" };

  return (
    <div className="flex min-h-screen">
      <Sidebar {...nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <MobileNav {...nav} />
          <div className="flex-1" />
          <UserMenu name={user.name} email={user.email} roleLabel={roleLabels[user.role]} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
