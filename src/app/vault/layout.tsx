"use client";

import RouteGuard from "@/components/RouteGuard";

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard>{children}</RouteGuard>;
}
