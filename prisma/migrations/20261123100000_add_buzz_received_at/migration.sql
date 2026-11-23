-- AlterTable
ALTER TABLE "LiveBuzz" ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Buzzes recorded before this change were ordered by arrival, so their arrival time is their press time.
UPDATE "LiveBuzz" SET "receivedAt" = "buzzedAt";
