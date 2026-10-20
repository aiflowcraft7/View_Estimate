import { redirect } from "next/navigation";

export default function ClerkSignUpRedirect() {
  redirect("/login");
}
