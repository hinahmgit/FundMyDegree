"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export function AdminNav({ items }: { items: [string, string][] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={cn("rounded-lg px-3 py-2 text-sm whitespace-nowrap", active(href) ? "bg-brand-100 font-semibold text-brand-800" : "text-stone-600 hover:bg-stone-100")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
