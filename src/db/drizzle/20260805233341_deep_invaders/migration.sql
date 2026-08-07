ALTER TABLE "embeddings" ADD COLUMN "source_key" text;--> statement-breakpoint
UPDATE "embeddings" SET "source_key" = 'legacy:' || "node_id";--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "source_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "embedding_source" text;--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN "content";
