import Link from "next/link";
import { NewBoardButton } from "@/components/new-board-button";
import { listBoards } from "@/services/boards";

export default async function BoardsPage() {
  const boards = await listBoards();

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your boards</h1>
        <NewBoardButton />
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
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  {b.accessRole !== "owner" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                      {b.accessRole}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
