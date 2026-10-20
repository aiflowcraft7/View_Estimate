"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function LogoutPage() {
  const { signOut } = useClerk();
  useEffect(() => {
    void (async () => {
      // Drop tenant + admin act-as cookies before Clerk clears the session.
      await fetch("/api/logout", { method: "POST", redirect: "manual" }).catch(() => {});
      await signOut({ redirectUrl: "/login" });
    })();
  }, [signOut]);
  return null;
}
