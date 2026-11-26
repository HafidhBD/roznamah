CREATE TYPE "public"."download_status" AS ENUM('queued', 'rendering', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('national', 'religious', 'international', 'field', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('confirmed', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."recurrence_kind" AS ENUM('gregorian_fixed', 'hijri_fixed', 'annual_manual');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_group" AS ENUM('sector', 'field', 'audience', 'use');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"event_id" uuid,
	"custom_title_ar" text,
	"custom_title_en" text,
	"custom_date" date,
	"custom_color" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_token" text,
	"user_id" text,
	"start_month" date NOT NULL,
	"selections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"design" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendars_draft_token_unique" UNIQUE("draft_token")
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"calendar_id" uuid,
	"formats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" "download_status" DEFAULT 'queued' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "downloads_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "event_occurrences" (
	"event_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"start_date" date NOT NULL,
	"status" "occurrence_status" DEFAULT 'confirmed' NOT NULL,
	"source_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_occurrences_event_id_year_pk" PRIMARY KEY("event_id","year")
);
--> statement-breakpoint
CREATE TABLE "event_tags" (
	"event_id" uuid NOT NULL,
	"term_id" integer NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "event_tags_event_id_term_id_pk" PRIMARY KEY("event_id","term_id"),
	CONSTRAINT "event_tags_weight_range" CHECK ("event_tags"."weight" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ar" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"kind" "event_kind" NOT NULL,
	"recurrence" "recurrence_kind" NOT NULL,
	"g_month" integer,
	"g_day" integer,
	"h_month" integer,
	"h_day" integer,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"icon" text,
	"color" text,
	"content_idea_ar" text,
	"content_idea_en" text,
	"prep_days" integer DEFAULT 14 NOT NULL,
	"source_name" text,
	"source_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"org_name" text NOT NULL,
	"sector" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phone" text,
	"calendar_id" uuid,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"group" "taxonomy_group" NOT NULL,
	"key" text NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "taxonomy_terms_group_key_unique" UNIQUE("group","key")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_term_id_taxonomy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_calendar_event_unique" ON "calendar_events" USING btree ("calendar_id","event_id") WHERE "calendar_events"."event_id" is not null;--> statement-breakpoint
CREATE INDEX "calendar_events_calendar_idx" ON "calendar_events" USING btree ("calendar_id");