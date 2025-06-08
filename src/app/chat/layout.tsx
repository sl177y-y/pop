"use client";

import RouteGuard from "@/components/RouteGuard";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard>{children}</RouteGuard>;
}
