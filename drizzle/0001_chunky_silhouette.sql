CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id","created_at");