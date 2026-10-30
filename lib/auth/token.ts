import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cv_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  sid: string;
  exp: number;
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(sid: string, secret: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const payload = Buffer.from(
    JSON.stringify({ sid, exp: Date.now() + ttlSeconds * 1000 } satisfies SessionPayload),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!data.sid || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function passwordsMatch(input: string, expected: string): boolean {
  const actual = Buffer.from(input);
  const stored = Buffer.from(expected);
  if (actual.length !== stored.length) {
    timingSafeEqual(stored, stored);
    return false;
  }
  return timingSafeEqual(actual, stored);
}
