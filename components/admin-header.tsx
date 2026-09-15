"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BarChart3, LayoutDashboard, Search } from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/conversions", label: "Conversions", icon: BarChart3 },
  { href: "/admin/scrape", label: "Event scrape", icon: Search },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <header className="admin-header">
      <div className="admin-header-top">
        <Link href="/admin" className="admin-brand" aria-label="Secret Mouse Tickets admin">
          <Image src="/secret-mouse-tickets-logo-horizontal.webp" alt="Secret Mouse Tickets" width={2752} height={1536} unoptimized priority />
        </Link>
        <span className="admin-workspace-label">Admin workspace</span>
        <Link href="/" className="admin-site-link">View website <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <nav className="admin-navigation" aria-label="Admin navigation">
        {adminLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
