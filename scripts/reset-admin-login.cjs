// Emergency tool for the site owner: turn two-step login off for one admin and/or clear the failed-login locks.
// For when the phone AND the recovery codes are both gone, or after locking yourself out while testing.
//
// It NEVER reads a database address from the environment or from .env files. You must type it on the command line,
// so it can't touch the live database by accident. Pointing it at the live database needs --live as well.
//
//   node scripts/reset-admin-login.cjs --url "postgresql://..." --email you@example.com --reset-2fa
//   node scripts/reset-admin-login.cjs --url "postgresql://..." --clear-locks
//   (add --live when the address is the real site's database)
const args = process.argv.slice(2);
const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(name);

const url = get("--url");
if (!url || !/^postgres(ql)?:\/\//.test(url)) { console.error("REFUSING: pass the database address with --url \"postgresql://...\" (it is never read from the environment)."); process.exit(1); }
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
if (!isLocal && !has("--live")) { console.error("REFUSING: that is not a local database. If you really mean the live site, add --live."); process.exit(1); }
const host = url.replace(/^[^@]*@/, "").replace(/[/?].*$/, "");
console.log(`${isLocal ? "LOCAL" : "LIVE"} database host: ${host}`);

const doReset = has("--reset-2fa");
const doClear = has("--clear-locks");
const email = get("--email");
if (!doReset && !doClear) { console.error("Nothing to do: add --reset-2fa (with --email) and/or --clear-locks."); process.exit(1); }
if (doReset && !email) { console.error("--reset-2fa needs --email <the admin's email>."); process.exit(1); }

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasourceUrl: url });
(async () => {
  if (doReset) {
    const r = await prisma.admin.updateMany({
      where: { email: email.trim() },
      data: { totpSecret: null, totpPending: null, totpEnabledAt: null, totpLastStep: null, recoveryHashes: [] },
    });
    console.log(r.count === 1 ? `Two-step login turned off for ${email}. Sign in with the password, then turn it on again.` : `No admin found with the email ${email}.`);
  }
  if (doClear) {
    const r = await prisma.authThrottle.deleteMany({});
    console.log(`Cleared ${r.count} failed-login counter(s) and lock(s).`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
