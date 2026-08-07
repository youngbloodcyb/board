CREATE TYPE "board_share_role" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TABLE "board_shares" (
	"board_id" text,
	"user_id" text,
	"role" "board_share_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_shares_boardId_userId_pk" PRIMARY KEY("board_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "board_shares_userId_boardId_idx" ON "board_shares" ("user_id","board_id");--> statement-breakpoint
ALTER TABLE "board_shares" ADD CONSTRAINT "board_shares_board_id_boards_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "board_shares" ADD CONSTRAINT "board_shares_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;