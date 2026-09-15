import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-header";
import "./admin-theme.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-theme">
      <AdminHeader />
      {children}
    </div>
  );
}
