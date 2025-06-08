"use client";

import RouteGuard from "@/components/RouteGuard";

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard>{children}</RouteGuard>;
}
