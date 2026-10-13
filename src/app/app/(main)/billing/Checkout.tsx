"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (e: string) => void };
      Initialize: (o: Record<string, unknown>) => void;
      Checkout: { open: (o: Record<string, unknown>) => void };
    };
  }
}

let initialized = false;

export function CheckoutButton({
  priceId,
  clientToken,
  env,
  email,
  businessId,
  label,
  variant = "primary",
}: {
  priceId: string;
  clientToken: string;
  env: "sandbox" | "production";
  email: string;
  businessId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [ready, setReady] = useState(!!(typeof window !== "undefined" && window.Paddle));
  useEffect(() => {
    if (window.Paddle) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  function open() {
    const P = window.Paddle;
    if (!P) return;
    if (!initialized) {
      if (env === "sandbox") P.Environment.set("sandbox");
      P.Initialize({ token: clientToken });
      initialized = true;
    }
    P.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { businessId },
      settings: { displayMode: "overlay", theme: "light", successUrl: `${window.location.origin}/app/billing?checkout=success` },
    });
  }

  return (
    <Button type="button" variant={variant} onClick={open} disabled={!ready} className="w-full">
      {label}
    </Button>
  );
}
