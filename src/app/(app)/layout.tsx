import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SignOutButton />
    </>
  );
}
