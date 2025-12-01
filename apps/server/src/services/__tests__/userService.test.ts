/**
 * User Service Tests
 *
 * Tests for the userService module that centralizes user operations.
 * Uses mocked database to test business logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// Mock the database
vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Import after mocking
import { db } from '../../db/client.js';
import {
  getUserById,
  requireUserById,
  getUserByExternalId,
  getUserByPlexAccountId,
  getUserByUsername,
  getOwnerUser,
  getUserWithServer,
  getUserWithStats,
  createOwnerUser,
  linkPlexAccount,
  upsertUserFromMediaServer,
  updateUserTrustScore,
  getUsersByServer,
  batchCreateUsers,
  UserNotFoundError,
} from '../userService.js';

// Helper to create mock user
function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    serverId: randomUUID(),
    externalId: 'external-123',
    username: 'testuser',
    email: 'test@example.com',
    thumbUrl: null,
    passwordHash: null,
    plexAccountId: null,
    isOwner: false,
    trustScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to setup select chain mock
function mockSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn().mockReturnThis(),
  };
  vi.mocked(db.select).mockReturnValue(chain as never);
  return chain;
}

// Helper to setup insert chain mock
function mockInsertChain(result: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  vi.mocked(db.insert).mockReturnValue(chain as never);
  return chain;
}

// Helper to setup update chain mock
function mockUpdateChain(result: unknown[]) {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  vi.mocked(db.update).mockReturnValue(chain as never);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserById', () => {
  it('should return user when found', async () => {
    const mockUser = createMockUser();
    mockSelectChain([mockUser]);

    const result = await getUserById(mockUser.id);

    expect(result).toEqual(mockUser);
    expect(db.select).toHaveBeenCalled();
  });

  it('should return null when user not found', async () => {
    mockSelectChain([]);

    const result = await getUserById('non-existent-id');

    expect(result).toBeNull();
  });
});

describe('requireUserById', () => {
  it('should return user when found', async () => {
    const mockUser = createMockUser();
    mockSelectChain([mockUser]);

    const result = await requireUserById(mockUser.id);

    expect(result).toEqual(mockUser);
  });

  it('should throw UserNotFoundError when user not found', async () => {
    mockSelectChain([]);

    await expect(requireUserById('non-existent-id')).rejects.toThrow(UserNotFoundError);
    await expect(requireUserById('non-existent-id')).rejects.toThrow(
      "User with ID 'non-existent-id' not found"
    );
  });
});

describe('getUserByExternalId', () => {
  it('should return user when found by serverId and externalId', async () => {
    const mockUser = createMockUser();
    mockSelectChain([mockUser]);

    const result = await getUserByExternalId(mockUser.serverId as string, 'external-123');

    expect(result).toEqual(mockUser);
  });

  it('should return null when not found', async () => {
    mockSelectChain([]);

    const result = await getUserByExternalId('server-id', 'non-existent');

    expect(result).toBeNull();
  });
});

describe('getUserByPlexAccountId', () => {
  it('should return user when found by Plex account ID', async () => {
    const mockUser = createMockUser({ plexAccountId: 'plex-123' });
    mockSelectChain([mockUser]);

    const result = await getUserByPlexAccountId('plex-123');

    expect(result).toEqual(mockUser);
  });

  it('should return null when not found', async () => {
    mockSelectChain([]);

    const result = await getUserByPlexAccountId('non-existent');

    expect(result).toBeNull();
  });
});

describe('getUserByUsername', () => {
  it('should return user when found by username', async () => {
    const mockUser = createMockUser({ username: 'johndoe' });
    mockSelectChain([mockUser]);

    const result = await getUserByUsername('johndoe');

    expect(result).toEqual(mockUser);
  });

  it('should return null when not found', async () => {
    mockSelectChain([]);

    const result = await getUserByUsername('nonexistent');

    expect(result).toBeNull();
  });
});

describe('getOwnerUser', () => {
  it('should return owner user when exists', async () => {
    const mockOwner = createMockUser({ isOwner: true });
    mockSelectChain([mockOwner]);

    const result = await getOwnerUser();

    expect(result).toEqual(mockOwner);
    expect(result?.isOwner).toBe(true);
  });

  it('should return null when no owner exists', async () => {
    mockSelectChain([]);

    const result = await getOwnerUser();

    expect(result).toBeNull();
  });
});

describe('getUserWithServer', () => {
  it('should return user with server info when found', async () => {
    const userId = randomUUID();
    const serverId = randomUUID();
    const userWithServer = {
      id: userId,
      serverId,
      serverName: 'My Plex Server',
      externalId: 'ext-123',
      username: 'testuser',
      email: 'test@example.com',
      thumbUrl: null,
      isOwner: false,
      trustScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock the join query chain
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([userWithServer]),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUserWithServer(userId);

    expect(result).toEqual(userWithServer);
    expect(result?.serverName).toBe('My Plex Server');
  });

  it('should return null when user not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUserWithServer('non-existent');

    expect(result).toBeNull();
  });

  it('should return null for user without server (owner)', async () => {
    // INNER JOIN means users without servers won't be returned
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUserWithServer(randomUUID());

    expect(result).toBeNull();
  });
});

describe('getUserWithStats', () => {
  it('should return user with stats when found', async () => {
    const userId = randomUUID();
    const serverId = randomUUID();
    const userWithServer = {
      id: userId,
      serverId,
      serverName: 'My Server',
      externalId: 'ext-123',
      username: 'testuser',
      email: null,
      thumbUrl: null,
      isOwner: false,
      trustScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stats = { totalSessions: 42, totalWatchTime: BigInt(3600000) };

    // First call: getUserWithServer
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([userWithServer]),
    };
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([stats]),
      } as never);

    const result = await getUserWithStats(userId);

    expect(result).not.toBeNull();
    expect(result?.stats.totalSessions).toBe(42);
    expect(result?.stats.totalWatchTime).toBe(3600000);
  });

  it('should return null when user not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUserWithStats('non-existent');

    expect(result).toBeNull();
  });

  it('should handle zero stats', async () => {
    const userId = randomUUID();
    const userWithServer = {
      id: userId,
      serverId: randomUUID(),
      serverName: 'Server',
      externalId: 'ext-1',
      username: 'newuser',
      email: null,
      thumbUrl: null,
      isOwner: false,
      trustScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stats = { totalSessions: 0, totalWatchTime: BigInt(0) };

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([userWithServer]),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([stats]),
      } as never);

    const result = await getUserWithStats(userId);

    expect(result?.stats.totalSessions).toBe(0);
    expect(result?.stats.totalWatchTime).toBe(0);
  });
});

describe('createOwnerUser', () => {
  it('should create owner user with password', async () => {
    const ownerUser = createMockUser({
      username: 'admin',
      isOwner: true,
      passwordHash: 'hashed-password',
    });

    const chain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([ownerUser]),
    };
    vi.mocked(db.insert).mockReturnValue(chain as never);

    const result = await createOwnerUser({
      username: 'admin',
      passwordHash: 'hashed-password',
    });

    expect(result.isOwner).toBe(true);
    expect(result.username).toBe('admin');
    expect(db.insert).toHaveBeenCalled();
  });

  it('should create owner user with Plex account', async () => {
    const ownerUser = createMockUser({
      username: 'plexadmin',
      isOwner: true,
      plexAccountId: 'plex-12345',
      thumbUrl: 'https://plex.tv/avatar.jpg',
    });

    const chain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([ownerUser]),
    };
    vi.mocked(db.insert).mockReturnValue(chain as never);

    const result = await createOwnerUser({
      username: 'plexadmin',
      plexAccountId: 'plex-12345',
      thumbUrl: 'https://plex.tv/avatar.jpg',
    });

    expect(result.isOwner).toBe(true);
    expect(result.plexAccountId).toBe('plex-12345');
  });
});

describe('linkPlexAccount', () => {
  it('should link Plex account to existing user', async () => {
    const userId = randomUUID();
    const updatedUser = createMockUser({
      id: userId,
      plexAccountId: 'plex-linked',
      thumbUrl: 'https://plex.tv/thumb.jpg',
    });

    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedUser]),
    };
    vi.mocked(db.update).mockReturnValue(chain as never);

    const result = await linkPlexAccount(userId, 'plex-linked', 'https://plex.tv/thumb.jpg');

    expect(result.plexAccountId).toBe('plex-linked');
    expect(result.thumbUrl).toBe('https://plex.tv/thumb.jpg');
  });

  it('should link Plex account without thumb', async () => {
    const userId = randomUUID();
    const updatedUser = createMockUser({
      id: userId,
      plexAccountId: 'plex-no-thumb',
    });

    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedUser]),
    };
    vi.mocked(db.update).mockReturnValue(chain as never);

    const result = await linkPlexAccount(userId, 'plex-no-thumb');

    expect(result.plexAccountId).toBe('plex-no-thumb');
  });

  it('should throw UserNotFoundError when user not found', async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.update).mockReturnValue(chain as never);

    await expect(linkPlexAccount('non-existent', 'plex-123')).rejects.toThrow(UserNotFoundError);
  });
});

describe('upsertUserFromMediaServer', () => {
  const serverId = randomUUID();
  const mediaUser = {
    id: 'external-456',
    username: 'plexuser',
    email: 'plex@example.com',
    thumb: 'https://plex.tv/thumb.jpg',
    isAdmin: false,
  };

  it('should create new user when not exists', async () => {
    const now = new Date();
    const newUser = createMockUser({
      externalId: mediaUser.id,
      username: mediaUser.username,
      // For new users, createdAt and updatedAt are the same
      createdAt: now,
      updatedAt: now,
    });

    // Atomic upsert returns the user
    mockInsertChain([newUser]);

    const result = await upsertUserFromMediaServer(serverId, mediaUser);

    expect(result.created).toBe(true);
    expect(result.user.externalId).toBe(mediaUser.id);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('should update existing user when exists (via onConflict)', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const updatedAt = new Date('2024-06-15T12:00:00Z');
    const updatedUser = createMockUser({
      externalId: mediaUser.id,
      username: mediaUser.username,
      // For updates, updatedAt is different from createdAt
      createdAt,
      updatedAt,
    });

    // Atomic upsert returns the updated user
    mockInsertChain([updatedUser]);

    const result = await upsertUserFromMediaServer(serverId, mediaUser);

    // Created is false because timestamps differ by more than 1 second
    expect(result.created).toBe(false);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('should be atomic (single database operation)', async () => {
    const now = new Date();
    const newUser = createMockUser({ createdAt: now, updatedAt: now });
    const insertChain = mockInsertChain([newUser]);

    await upsertUserFromMediaServer(serverId, mediaUser);

    // Verify onConflictDoUpdate was called for atomic upsert
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
  });
});

describe('updateUserTrustScore', () => {
  it('should update trust score successfully', async () => {
    const userId = randomUUID();
    const updatedUser = createMockUser({ id: userId, trustScore: 80 });
    mockUpdateChain([updatedUser]);

    const result = await updateUserTrustScore(userId, 80);

    expect(result.trustScore).toBe(80);
  });

  it('should throw UserNotFoundError when user not found', async () => {
    mockUpdateChain([]);

    await expect(updateUserTrustScore('non-existent', 50)).rejects.toThrow(UserNotFoundError);
  });
});

describe('getUsersByServer', () => {
  it('should return map of users by externalId', async () => {
    const serverId = randomUUID();
    const users = [
      createMockUser({ externalId: 'ext-1', username: 'user1' }),
      createMockUser({ externalId: 'ext-2', username: 'user2' }),
      createMockUser({ externalId: 'ext-3', username: 'user3' }),
    ];

    // Setup select to return array directly (no limit)
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(users),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUsersByServer(serverId);

    expect(result.size).toBe(3);
    expect(result.get('ext-1')?.username).toBe('user1');
    expect(result.get('ext-2')?.username).toBe('user2');
    expect(result.get('ext-3')?.username).toBe('user3');
  });

  it('should return empty map when no users', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUsersByServer(randomUUID());

    expect(result.size).toBe(0);
  });

  it('should skip users without externalId', async () => {
    const users = [
      createMockUser({ externalId: 'ext-1' }),
      createMockUser({ externalId: null }), // Owner user without externalId
    ];

    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(users),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);

    const result = await getUsersByServer(randomUUID());

    expect(result.size).toBe(1);
    expect(result.has('ext-1')).toBe(true);
  });
});

describe('batchCreateUsers', () => {
  it('should create multiple users in one insert', async () => {
    const serverId = randomUUID();
    const mediaUsers = [
      { id: 'ext-1', username: 'user1', isAdmin: false },
      { id: 'ext-2', username: 'user2', isAdmin: false },
    ];
    const createdUsers = mediaUsers.map((u) =>
      createMockUser({ externalId: u.id, username: u.username })
    );

    mockInsertChain(createdUsers);

    const result = await batchCreateUsers(serverId, mediaUsers);

    expect(result).toHaveLength(2);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('should return empty array for empty input', async () => {
    const result = await batchCreateUsers(randomUUID(), []);

    expect(result).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('UserNotFoundError', () => {
  it('should be instanceof Error', () => {
    const error = new UserNotFoundError('test-id');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new UserNotFoundError('test-id');
    expect(error.name).toBe('UserNotFoundError');
  });

  it('should format message with ID', () => {
    const error = new UserNotFoundError('abc-123');
    expect(error.message).toBe("User with ID 'abc-123' not found");
  });

  it('should format message without ID', () => {
    const error = new UserNotFoundError();
    expect(error.message).toBe('User not found');
  });

  it('should have HTTP status code 404', () => {
    const error = new UserNotFoundError('test');
    expect(error.statusCode).toBe(404);
  });

  it('should have error code from NotFoundError', () => {
    const error = new UserNotFoundError('test');
    expect(error.code).toBe('RES_001');
  });
});
