ALTER TABLE "embeddings" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "nodes_searchText_gin_idx" ON "nodes" USING gin (to_tsvector('simple', "search_text"));