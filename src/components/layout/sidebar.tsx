"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Inbox, LayoutDashboard, Map, Menu, Users, UserCog } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

type NavProps = { newLeads: number; isAdmin: boolean };

const items = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/leads", label: "Leads", icon: Inbox, badge: "leads" as const },
  { href: "/catalogue", label: "Catalogue", icon: Map },
  { href: "/reservations", label: "Réservations", icon: CalendarCheck },
];

function NavLinks({ newLeads, isAdmin, onNavigate }: NavProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = isAdmin ? [...items, { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserCog }] : items;
  return (
    <nav className="grid gap-0.5">
      {all.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {"badge" in item && newLeads > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {newLeads}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar(props: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
      <Brand className="px-2" />
      <NavLinks {...props} />
    </aside>
  );
}

export function MobileNav(props: NavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 border-none bg-sidebar px-3 py-5 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand className="mb-6 px-2" />
        <NavLinks {...props} />
      </SheetContent>
    </Sheet>
  );
}
