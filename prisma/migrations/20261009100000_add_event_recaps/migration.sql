-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "recapPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recapStats" TEXT,
ADD COLUMN     "recapSummary" TEXT,
ADD COLUMN     "winnerTeam" TEXT;

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "posterUrl" TEXT,
    "posterPathname" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventMedia_eventId_idx" ON "EventMedia"("eventId");

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
