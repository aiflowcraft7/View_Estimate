import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function LoginSsoCallbackPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
