import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loginPassword, readEnv } from "@/lib/env";
import { getRedis, keys } from "@/lib/redis";
import {
  createSessionToken,
  passwordsMatch,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/token";
import { AppError } from "@/lib/errors";

export async function getSessionId(): Promise<string | null> {
  const env = readEnv();
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value, env.APP_AUTH_SECRET)?.sid ?? null;
}

export async function requireUser(): Promise<void> {
  await connection();
  const sid = await getSessionId();
  if (!sid) redirect("/login");
  const exists = await getRedis().exists(keys.session(sid));
  if (!exists) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    redirect("/login");
  }
}

export async function login(password: string, ip: string): Promise<void> {
  const env = readEnv();
  const redis = getRedis();
  const attemptKey = keys.loginAttempts(createHash("sha256").update(ip).digest("hex").slice(0, 24));
  const attempts = await redis.incr(attemptKey);
  if (attempts === 1) await redis.expire(attemptKey, 600);
  if (attempts > 8) {
    throw new AppError("Demasiados intentos. Espere unos minutos y vuelva a intentar.");
  }
  if (!passwordsMatch(password, loginPassword(env))) {
    throw new AppError("La contraseña no coincide.");
  }
  const sid = randomUUID();
  await redis.set(keys.session(sid), "1", { ex: SESSION_TTL_SECONDS });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(sid, env.APP_AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await redis.del(attemptKey);
}

export async function logout(): Promise<void> {
  const env = readEnv();
  const jar = await cookies();
  const sid = readSessionToken(jar.get(SESSION_COOKIE)?.value, env.APP_AUTH_SECRET)?.sid;
  if (sid) await getRedis().del(keys.session(sid));
  jar.delete(SESSION_COOKIE);
}
