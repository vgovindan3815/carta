-- Audit events table: records all destructive admin actions with actor, reason, timestamp
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_name" text,
	"performed_by" text DEFAULT 'system' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
