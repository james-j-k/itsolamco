-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "teamSizeEmailSentFor" INTEGER;

-- Backfill existing rows to their current teamSize so the admin panel's
-- notify button doesn't light up for every booking that hasn't actually
-- had its size edited since this migration.
UPDATE "Booking" SET "teamSizeEmailSentFor" = "teamSize" WHERE "teamSizeEmailSentFor" IS NULL;
