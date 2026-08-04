"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onSignOut}
      className="fixed top-4 right-4 z-50"
    >
      Sign out
    </Button>
  );
}
