import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  adminId: string;
  email: string;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

// The "password accepted, now enter your code" ticket. It is signed like a session but can never be used as one:
// it is marked typ "2fa", carries no email, and lasts only five minutes.
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

export async function createChallengeToken(adminId: string) {
  return new SignJWT({ adminId, typ: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyChallengeToken(token: string): Promise<{ adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.typ === "2fa" && typeof payload.adminId === "string") return { adminId: payload.adminId };
    return null;
  } catch {
    return null;
  }
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.typ === "2fa") return null; // a half-finished sign-in is not a session
    if (typeof payload.adminId === "string" && typeof payload.email === "string") {
      return { adminId: payload.adminId, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
