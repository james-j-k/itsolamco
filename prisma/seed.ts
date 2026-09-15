import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@itsolamco.in";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash },
  });
  console.log(`Admin ready: ${adminEmail}`);

  const roundCount = await prisma.quizRound.count();
  if (roundCount === 0) {
    await prisma.quizRound.createMany({
      data: [
        { order: 1, title: "The Icebreaker", description: "Softballs from recent Mollywood hits to get the beer flowing and the brain warming up." },
        { order: 2, title: "Dialogue Dubs", description: "We play the clip, you finish the legendary punchline. Dialect variations count for extra." },
        { order: 3, title: "Music Bingo", description: "Identify the hook, the singer, or the bizarre 90s costume choices of Shobana." },
        { order: 4, title: "Rapid Fire", description: "Ten questions in sixty seconds. No phones, no lifelines, just pure adrenaline." },
        { order: 5, title: "The Jackpot", description: "One question. All or nothing. The kind of niche trivia that separates legends from casuals." },
      ],
    });
    console.log("Seeded 5 quiz rounds.");
  } else {
    console.log(`Quiz rounds already exist (${roundCount}), skipping seed.`);
  }

  const venueCount = await prisma.venue.count();
  if (venueCount === 0) {
    await prisma.venue.createMany({
      data: [
        { order: 1, name: "Watson's" },
        { order: 2, name: "Fly High" },
        { order: 3, name: "Rocks & Brews" },
        { order: 4, name: "O Mealby" },
      ],
    });
    console.log("Seeded 4 venues.");
  } else {
    console.log(`Venues already exist (${venueCount}), skipping seed.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
