-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "attended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "rsvpAt" TIMESTAMP(3),
ADD COLUMN     "rsvpHeadcount" INTEGER,
ADD COLUMN     "rsvpStatus" TEXT,
ADD COLUMN     "rsvpTableBooked" BOOLEAN,
ADD COLUMN     "rsvpToken" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "districtUrl" TEXT,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "reminderOfferNote" TEXT,
ADD COLUMN     "swiggyUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_rsvpToken_key" ON "Booking"("rsvpToken");
