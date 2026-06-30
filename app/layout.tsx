import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Secret Mouse Tickets",
  description:
    "We track discounted Disney World ticket sales that are not advertised to the public.",
  icons: {
    icon: "/secret-mouse-tickets-logo.png",
    shortcut: "/secret-mouse-tickets-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
