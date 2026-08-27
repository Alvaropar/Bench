import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { authSessions, projects, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { ApiError, badRequest } from "@/lib/errors";
import { getSessionId } from "@/lib/session";

// promisify picks the three-argument overload, which drops the cost
// parameters, so the signature is restated here.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing on Node's built-in scrypt rather than bcrypt or argon2.
 *
 * Both of those are native modules that have to build for the deployment
 * target; scrypt is memory-hard, in the standard library, and needs no
 * dependency at all. The parameters are encoded into the stored string so they
 * can be raised later without invalidating existing hashes.
 */
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16_384;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
  })) as Buffer;
  return `scrypt$${SCRYPT_COST}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !cost || !salt || !hash) return false;

  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: Number(cost),
  })) as Buffer;
  const expected = Buffer.from(hash, "hex");

  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface Viewer {
  /** Always present — the browser, signed in or not. */
  sessionId: string;
  user: User | null;
}

/**
 * Who is making this request.
 *
 * Anonymous browsing stays first-class: a visitor can build and publish without
 * ever registering. An account only changes which projects they can reach.
 */
export async function getViewer(): Promise<Viewer> {
  const sessionId = await getSessionId();

  const [row] = await getDb()
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.sessionId, sessionId))
    .limit(1);

  return { sessionId, user: row?.user ?? null };
}

/**
 * A project belongs to the viewer if they own the account it is filed under,
 * or -- while it is still anonymous -- if it came from this browser.
 */
export function ownsProject(
  viewer: Viewer,
  project: { sessionId: string; userId: string | null },
): boolean {
  if (project.userId) return viewer.user?.id === project.userId;
  return project.sessionId === viewer.sessionId;
}

/** Drizzle condition for "projects this viewer can see". */
export function ownedByViewer(viewer: Viewer) {
  const anonymous = and(isNull(projects.userId), eq(projects.sessionId, viewer.sessionId));
  if (!viewer.user) return anonymous;
  return or(eq(projects.userId, viewer.user.id), anonymous);
}

export async function register(input: {
  email: string;
  password: string;
  sessionId: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Enter a valid email address");
  if (input.password.length < 8) {
    throw badRequest("Password must be at least 8 characters");
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new ApiError(409, "An account with that email already exists");

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(input.password) })
    .returning();

  await startSession(input.sessionId, user.id);
  await adoptAnonymousProjects(input.sessionId, user.id);
  return user;
}

export async function login(input: {
  email: string;
  password: string;
  sessionId: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);

  // One message for both "no such account" and "wrong password", so the
  // response cannot be used to enumerate which emails are registered.
  const invalid = new ApiError(401, "Email or password is incorrect");
  if (!user) throw invalid;
  if (!(await verifyPassword(input.password, user.passwordHash))) throw invalid;

  await startSession(input.sessionId, user.id);
  await adoptAnonymousProjects(input.sessionId, user.id);
  return user;
}

export async function logout(sessionId: string): Promise<void> {
  await getDb().delete(authSessions).where(eq(authSessions.sessionId, sessionId));
}

async function startSession(sessionId: string, userId: string): Promise<void> {
  await getDb()
    .insert(authSessions)
    .values({ sessionId, userId })
    .onConflictDoUpdate({ target: authSessions.sessionId, set: { userId } });
}

/**
 * Hands the projects built in this browser to the account that just signed in.
 *
 * Without this, registering would appear to delete your work: the apps you just
 * built were filed under an anonymous session and would drop out of your list
 * the moment you had an account.
 */
export async function adoptAnonymousProjects(
  sessionId: string,
  userId: string,
): Promise<number> {
  const adopted = await getDb()
    .update(projects)
    .set({ userId })
    .where(and(eq(projects.sessionId, sessionId), isNull(projects.userId)))
    .returning({ id: projects.id });

  return adopted.length;
}
