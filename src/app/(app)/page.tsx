"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import type { Board } from "@/db/schema";
import { createBoard, listBoards } from "@/services/boards";

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[] | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    listBoards().then((b) => {
      if (!cancelled) setBoards(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async () => {
    const id = await createBoard("Untitled board");
    router.push(`/${id}`);
  };

  if (boards === undefined) return <Loading />;

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your boards</h1>
        <Button onClick={onCreate}>New board</Button>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No boards yet. Create your first one.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/${b.id}`}
                className="flex aspect-[4/3] flex-col justify-end rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
              >
                <div className="truncate text-sm font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
