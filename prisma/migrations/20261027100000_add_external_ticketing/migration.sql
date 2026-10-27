-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "externalTicketLabel" TEXT,
ADD COLUMN     "externalTicketUrl" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalAskedAt" TIMESTAMP(3);

