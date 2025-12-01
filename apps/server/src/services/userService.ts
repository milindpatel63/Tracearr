/**
 * User Service
 *
 * Centralizes common user operations to reduce code duplication across
 * routes and services. Follows the repository pattern - routes handle
 * HTTP concerns, this service handles business logic and data access.
 *
 * Key patterns:
 * - Get operations return User | null for flexibility
 * - Require operations throw NotFoundError for fail-fast behavior
 * - Upsert operations handle create-or-update atomically
 */

import { eq, and, sql } from 'drizzle-orm';
import type { MediaUser } from './mediaServer/index.js';
import { db } from '../db/client.js';
import { users, servers, sessions } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

// Type for user table row
export type User = typeof users.$inferSelect;

// Type for user with server info (common join pattern)
export interface UserWithServer {
  id: string;
  serverId: string | null;
  serverName: string;
  externalId: string | null;
  username: string;
  email: string | null;
  thumbUrl: string | null;
  isOwner: boolean;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

// Type for user with stats
export type UserWithStats = UserWithServer & {
  stats: {
    totalSessions: number;
    totalWatchTime: number;
  };
};

// ============================================================================
// Core User Lookups
// ============================================================================

/**
 * Get user by ID (returns null if not found)
 */
export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Get user by ID (throws if not found)
 */
export async function requireUserById(id: string): Promise<User> {
  const user = await getUserById(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}

/**
 * Get user by server ID and external ID (Plex/Jellyfin user ID)
 */
export async function getUserByExternalId(
  serverId: string,
  externalId: string
): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.serverId, serverId), eq(users.externalId, externalId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get user by Plex account ID (for Login with Plex)
 */
export async function getUserByPlexAccountId(plexAccountId: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.plexAccountId, plexAccountId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get user with server info (common join pattern)
 */
export async function getUserWithServer(id: string): Promise<UserWithServer | null> {
  const rows = await db
    .select({
      id: users.id,
      serverId: users.serverId,
      serverName: servers.name,
      externalId: users.externalId,
      username: users.username,
      email: users.email,
      thumbUrl: users.thumbUrl,
      isOwner: users.isOwner,
      trustScore: users.trustScore,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(servers, eq(users.serverId, servers.id))
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get user with stats (for user detail page)
 */
export async function getUserWithStats(id: string): Promise<UserWithStats | null> {
  const user = await getUserWithServer(id);
  if (!user) return null;

  const statsResult = await db
    .select({
      totalSessions: sql<number>`count(*)::int`,
      totalWatchTime: sql<number>`coalesce(sum(duration_ms), 0)::bigint`,
    })
    .from(sessions)
    .where(eq(sessions.userId, id));

  const stats = statsResult[0];

  return {
    ...user,
    stats: {
      totalSessions: stats?.totalSessions ?? 0,
      totalWatchTime: Number(stats?.totalWatchTime ?? 0),
    },
  };
}

// ============================================================================
// User Creation and Updates
// ============================================================================

/**
 * Create a new user from media server data
 */
export async function createUserFromMediaServer(
  serverId: string,
  mediaUser: MediaUser
): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      serverId,
      externalId: mediaUser.id,
      username: mediaUser.username,
      email: mediaUser.email ?? null,
      thumbUrl: mediaUser.thumb ?? null,
      isOwner: mediaUser.isAdmin,
    })
    .returning();
  return rows[0]!;
}

/**
 * Update user from media server data (syncs username, email, thumb)
 */
export async function updateUserFromMediaServer(
  userId: string,
  mediaUser: MediaUser
): Promise<User> {
  const rows = await db
    .update(users)
    .set({
      username: mediaUser.username,
      email: mediaUser.email ?? null,
      thumbUrl: mediaUser.thumb ?? null,
      isOwner: mediaUser.isAdmin,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return rows[0]!;
}

/**
 * Upsert user from media server data (create or update)
 * Returns { user, created: boolean }
 *
 * Uses onConflictDoUpdate for atomic operation - prevents race conditions
 * when multiple concurrent syncs try to create the same user.
 */
export async function upsertUserFromMediaServer(
  serverId: string,
  mediaUser: MediaUser
): Promise<{ user: User; created: boolean }> {
  const now = new Date();

  const rows = await db
    .insert(users)
    .values({
      serverId,
      externalId: mediaUser.id,
      username: mediaUser.username,
      email: mediaUser.email ?? null,
      thumbUrl: mediaUser.thumb ?? null,
      isOwner: mediaUser.isAdmin,
    })
    .onConflictDoUpdate({
      target: [users.serverId, users.externalId],
      set: {
        username: mediaUser.username,
        email: mediaUser.email ?? null,
        thumbUrl: mediaUser.thumb ?? null,
        isOwner: mediaUser.isAdmin,
        updatedAt: now,
      },
    })
    .returning();

  const user = rows[0]!;

  // Determine if created or updated by comparing timestamps
  // If createdAt equals updatedAt (within 1 second), it was just created
  const created = Math.abs(user.createdAt.getTime() - user.updatedAt.getTime()) < 1000;

  return { user, created };
}

/**
 * Update user trust score
 */
export async function updateUserTrustScore(userId: string, trustScore: number): Promise<User> {
  const rows = await db
    .update(users)
    .set({
      trustScore,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  const user = rows[0];
  if (!user) {
    throw new UserNotFoundError(userId);
  }
  return user;
}

// ============================================================================
// Batch Operations (for polling optimization)
// ============================================================================

/**
 * Get all users for a server (for batch processing in poller)
 * Returns a Map keyed by externalId for O(1) lookups
 */
export async function getUsersByServer(serverId: string): Promise<Map<string, User>> {
  const serverUsers = await db
    .select()
    .from(users)
    .where(eq(users.serverId, serverId));

  const userMap = new Map<string, User>();
  for (const user of serverUsers) {
    if (user.externalId) {
      userMap.set(user.externalId, user);
    }
  }
  return userMap;
}

/**
 * Batch create users from media server data
 * Returns array of created users in same order as input
 */
export async function batchCreateUsers(
  serverId: string,
  mediaUsers: MediaUser[]
): Promise<User[]> {
  if (mediaUsers.length === 0) return [];

  return db
    .insert(users)
    .values(
      mediaUsers.map((u) => ({
        serverId,
        externalId: u.id,
        username: u.username,
        email: u.email ?? null,
        thumbUrl: u.thumb ?? null,
        isOwner: u.isAdmin,
      }))
    )
    .returning();
}

// ============================================================================
// Auth-related Operations
// ============================================================================

/**
 * Get the owner user (for auth setup validation)
 */
export async function getOwnerUser(): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.isOwner, true))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create owner user (for initial setup)
 */
export async function createOwnerUser(data: {
  username: string;
  passwordHash?: string;
  email?: string;
  plexAccountId?: string;
  thumbUrl?: string;
}): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      username: data.username,
      passwordHash: data.passwordHash ?? null,
      email: data.email ?? null,
      plexAccountId: data.plexAccountId ?? null,
      thumbUrl: data.thumbUrl ?? null,
      isOwner: true,
    })
    .returning();
  return rows[0]!;
}

/**
 * Link Plex account to existing user
 */
export async function linkPlexAccount(
  userId: string,
  plexAccountId: string,
  thumbUrl?: string
): Promise<User> {
  const rows = await db
    .update(users)
    .set({
      plexAccountId,
      thumbUrl: thumbUrl ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  const user = rows[0];
  if (!user) {
    throw new UserNotFoundError(userId);
  }
  return user;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * User not found error - extends NotFoundError for consistent error handling.
 * Integrates with the global error handler for proper HTTP 404 responses.
 */
export class UserNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('User', id);
    this.name = 'UserNotFoundError';
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}
