-- CreateEnum
CREATE TYPE "Role" AS ENUM ('conseiller', 'manager', 'admin');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('femme', 'homme', 'non_precise');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('prospect', 'client', 'fidele', 'inactif');

-- CreateEnum
CREATE TYPE "RiderRole" AS ENUM ('pilote', 'passager');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('A', 'A2', 'A1', 'B_125', 'aucun');

-- CreateEnum
CREATE TYPE "RidingLevel" AS ENUM ('debutant', 'intermediaire', 'confirme', 'expert');

-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('email_form', 'callback', 'inbound_call');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('nouveau', 'qualification', 'devis_envoye', 'gagne', 'perdu', 'injoignable');

-- CreateEnum
CREATE TYPE "TripFormat" AS ENUM ('guide', 'liberte', 'sur_mesure');

-- CreateEnum
CREATE TYPE "DepartureStatus" AS ENUM ('ouvert', 'garanti', 'complet', 'annule', 'termine');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('option', 'confirme', 'solde', 'annule');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('conjoint', 'enfant', 'parent', 'frere_soeur', 'ami', 'collegue', 'autre');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('faible', 'moyen', 'fort');

-- CreateEnum
CREATE TYPE "InterestSource" AS ENUM ('formulaire', 'appel', 'email', 'salon', 'newsletter', 'conseiller');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('call_in', 'call_out', 'email_in', 'email_out', 'newsletter_sent', 'newsletter_open', 'newsletter_click', 'callback', 'meeting', 'fair');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('entrant', 'sortant');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('rappel', 'relance', 'devis', 'autre');

-- CreateEnum
CREATE TYPE "AiLevel" AS ENUM ('froid', 'tiede', 'chaud', 'pret_a_reserver');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'conseiller',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'conseiller',
    "token" TEXT NOT NULL,
    "invited_by" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "gender" "Gender",
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE,
    "email" TEXT,
    "phone_mobile" TEXT,
    "phone_home" TEXT,
    "address_line" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'FR',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "status" "ContactStatus" NOT NULL DEFAULT 'prospect',
    "owner_user_id" TEXT,
    "rider_role" "RiderRole",
    "license_type" "LicenseType",
    "license_date" DATE,
    "riding_level" "RidingLevel",
    "height_cm" INTEGER,
    "diet" TEXT,
    "free_notes" TEXT,
    "newsletter_optin" BOOLEAN NOT NULL DEFAULT false,
    "sms_optin" BOOLEAN NOT NULL DEFAULT false,
    "consent_date" TIMESTAMP(3),
    "last_score" INTEGER,
    "last_score_level" "AiLevel",
    "last_analyzed_at" TIMESTAMP(3),
    "last_interaction_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_relationships" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "related_contact_id" TEXT NOT NULL,
    "relation" "RelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT,
    "channel" "LeadChannel" NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "callback_slot" TEXT,
    "callback_at" TIMESTAMP(3),
    "trip_id" TEXT,
    "message" TEXT,
    "utm_source" TEXT,
    "utm_campaign" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'nouveau',
    "lost_reason" TEXT,
    "assigned_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "duration_days" INTEGER NOT NULL,
    "level" "RidingLevel" NOT NULL,
    "format" "TripFormat" NOT NULL,
    "motorcycle_model" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departures" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "seats_total" INTEGER NOT NULL,
    "seats_left" INTEGER NOT NULL,
    "status" "DepartureStatus" NOT NULL DEFAULT 'ouvert',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "departure_id" TEXT NOT NULL,
    "payer_contact_id" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "BookingStatus" NOT NULL DEFAULT 'option',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "role" "RiderRole" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_interests" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "destination" TEXT,
    "source" "InterestSource" NOT NULL,
    "level" "InterestLevel" NOT NULL DEFAULT 'moyen',
    "period_wanted" TEXT,
    "budget" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "type" "InteractionType" NOT NULL,
    "direction" "Direction",
    "subject" TEXT,
    "summary" TEXT,
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "type" "TaskType" NOT NULL,
    "title" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "done_at" TIMESTAMP(3),
    "assigned_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" "AiLevel" NOT NULL,
    "summary" TEXT NOT NULL,
    "result_json" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_status_idx" ON "contacts"("status");

-- CreateIndex
CREATE INDEX "contacts_owner_user_id_idx" ON "contacts"("owner_user_id");

-- CreateIndex
CREATE INDEX "contacts_last_name_first_name_idx" ON "contacts"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "contacts_phone_mobile_idx" ON "contacts"("phone_mobile");

-- CreateIndex
CREATE INDEX "contacts_last_score_idx" ON "contacts"("last_score");

-- CreateIndex
CREATE INDEX "contacts_last_interaction_at_idx" ON "contacts"("last_interaction_at");

-- CreateIndex
CREATE INDEX "contact_relationships_related_contact_id_idx" ON "contact_relationships"("related_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_relationships_contact_id_related_contact_id_key" ON "contact_relationships"("contact_id", "related_contact_id");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "trips_active_idx" ON "trips"("active");

-- CreateIndex
CREATE INDEX "departures_trip_id_start_date_idx" ON "departures"("trip_id", "start_date");

-- CreateIndex
CREATE INDEX "departures_start_date_idx" ON "departures"("start_date");

-- CreateIndex
CREATE INDEX "bookings_payer_contact_id_idx" ON "bookings"("payer_contact_id");

-- CreateIndex
CREATE INDEX "bookings_departure_id_idx" ON "bookings"("departure_id");

-- CreateIndex
CREATE INDEX "booking_participants_contact_id_idx" ON "booking_participants"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_participants_booking_id_contact_id_key" ON "booking_participants"("booking_id", "contact_id");

-- CreateIndex
CREATE INDEX "trip_interests_contact_id_idx" ON "trip_interests"("contact_id");

-- CreateIndex
CREATE INDEX "trip_interests_destination_idx" ON "trip_interests"("destination");

-- CreateIndex
CREATE INDEX "interactions_contact_id_occurred_at_idx" ON "interactions"("contact_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_due_at_done_at_idx" ON "tasks"("assigned_user_id", "due_at", "done_at");

-- CreateIndex
CREATE INDEX "tasks_due_at_idx" ON "tasks"("due_at");

-- CreateIndex
CREATE INDEX "ai_analyses_contact_id_created_at_idx" ON "ai_analyses"("contact_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_related_contact_id_fkey" FOREIGN KEY ("related_contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payer_contact_id_fkey" FOREIGN KEY ("payer_contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interests" ADD CONSTRAINT "trip_interests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_interests" ADD CONSTRAINT "trip_interests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un intérêt porte soit sur un séjour du catalogue, soit sur une destination libre
ALTER TABLE "trip_interests" ADD CONSTRAINT "trip_interests_target_check" CHECK ("trip_id" IS NOT NULL OR "destination" IS NOT NULL);
