import { SignJWT, jwtVerify } from "jose";

// A pass for ONE quiz night's projector page and host pad. They use it on their second route to the server, the one
// that carries no cookies (see liveFetch). It opens only that night's state and host buttons, runs out by itself,
// and is signed with its own key, so it can never be mistaken for an admin sign-in or the other way round.
function passKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(`${secret}:live-pass`);
}

export async function createLivePass(sessionId: string): Promise<string> {
  return new SignJWT({ night: sessionId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("18h").sign(passKey());
}

export async function verifyLivePass(token: string, sessionId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, passKey(), { algorithms: ["HS256"] });
    return payload.night === sessionId;
  } catch {
    return false;
  }
}
