CREATE TABLE "chain_cursors" (
	"name" varchar(64) PRIMARY KEY NOT NULL,
	"cursor" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
