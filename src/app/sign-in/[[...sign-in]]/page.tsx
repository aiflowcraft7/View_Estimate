import { redirect } from "next/navigation";

export default function ClerkSignInRedirect() {
  redirect("/login");
}
