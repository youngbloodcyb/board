import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

export type OpenGraph = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

export type LinkNodeData = {
  kind: "link";
  url: string;
  og?: OpenGraph;
};

export type TextNodeData = {
  kind: "text";
  text: string;
};

export type ImageNodeData = {
  kind: "image";
  objectKey?: string;
  url?: string;
  alt?: string;
  fit?: "cover" | "contain";
};

export type PdfNodeData = {
  kind: "pdf";
  objectKey?: string;
  url?: string;
  name: string;
  markdown?: string;
};

export type NodeData =
  | LinkNodeData
  | TextNodeData
  | ImageNodeData
  | PdfNodeData;

export type NodeType = "link" | "text" | "image" | "pdf";

export type ClientLinkNodeData = LinkNodeData;
export type ClientTextNodeData = TextNodeData;
export type ClientImageNodeData = {
  kind: "image";
  src: string;
  alt?: string;
  fit?: "cover" | "contain";
};
export type ClientPdfNodeData = {
  kind: "pdf";
  src: string;
  name: string;
};
export type ClientNodeData =
  | ClientLinkNodeData
  | ClientTextNodeData
  | ClientImageNodeData
  | ClientPdfNodeData;

export type ClientNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  style?: { width: number; height: number };
  zIndex?: number;
  data: ClientNodeData;
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("session_expiresAt_userId_idx").on(t.expiresAt, t.userId),
    index("session_userId_idx").on(t.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("account_accountId_providerId_idx").on(
      t.accountId,
      t.providerId,
    ),
    index("account_providerId_userId_idx").on(t.providerId, t.userId),
    index("account_userId_idx").on(t.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    index("verification_expiresAt_idx").on(t.expiresAt),
  ],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("boards_userId_createdAt_idx").on(t.userId, t.createdAt)],
);

export const nodeTypeEnum = pgEnum("node_type", [
  "link",
  "text",
  "image",
  "pdf",
]);

export const nodes = pgTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: nodeTypeEnum("type").notNull(),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
    width: doublePrecision("width"),
    height: doublePrecision("height"),
    zIndex: integer("z_index"),
    data: jsonb("data").notNull().$type<NodeData>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("nodes_boardId_idx").on(t.boardId),
    index("nodes_userId_idx").on(t.userId),
    check(
      "nodes_kind_matches_type",
      sql`(${t.data} ->> 'kind') = (${t.type})::text`,
    ),
  ],
);

export const embeddings = pgTable(
  "embeddings",
  {
    nodeId: text("node_id")
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (t) => [
    index("embeddings_userId_boardId_idx").on(t.userId, t.boardId),
    index("embeddings_by_embedding_hnsw").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Jwks = typeof jwks.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type StoredNode = typeof nodes.$inferSelect;
export type StoredEmbedding = typeof embeddings.$inferSelect;
