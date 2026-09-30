-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VenueInquiry" ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false;
