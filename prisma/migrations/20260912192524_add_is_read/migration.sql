-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("contactName", "createdAt", "email", "eventId", "id", "message", "phone", "status", "teamName", "teamSize") SELECT "contactName", "createdAt", "email", "eventId", "id", "message", "phone", "status", "teamName", "teamSize" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE TABLE "new_VenueInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VenueInquiry" ("contactName", "createdAt", "email", "id", "message", "phone", "status", "venueName") SELECT "contactName", "createdAt", "email", "id", "message", "phone", "status", "venueName" FROM "VenueInquiry";
DROP TABLE "VenueInquiry";
ALTER TABLE "new_VenueInquiry" RENAME TO "VenueInquiry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
