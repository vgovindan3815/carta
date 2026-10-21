-- Add internal_flow column to dep_graphs for paragraph-level control flow data
ALTER TABLE "dep_graphs" ADD COLUMN "internal_flow" jsonb;
