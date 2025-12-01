/**
 * Jellyfin API Response Parser
 *
 * Pure functions for parsing raw Jellyfin API responses into typed objects.
 * Separated from the client for testability and reuse.
 */

import {
  parseString,
  parseNumber,
  parseBoolean,
  parseOptionalString,
  parseOptionalNumber,
  parseArray,
  getNestedObject,
  getNestedValue,
  parseDateString,
} from '../../../utils/parsing.js';
import type { MediaSession, MediaUser, MediaLibrary, MediaWatchHistoryItem } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Jellyfin ticks per millisecond (10,000 ticks = 1ms) */
const TICKS_PER_MS = 10000;

// ============================================================================
// Session Parsing
// ============================================================================

/**
 * Convert Jellyfin ticks to milliseconds
 */
function ticksToMs(ticks: unknown): number {
  const tickNum = parseNumber(ticks);
  return Math.floor(tickNum / TICKS_PER_MS);
}

/**
 * Parse Jellyfin media type to unified type
 */
function parseMediaType(type: unknown): MediaSession['media']['type'] {
  const typeStr = parseString(type).toLowerCase();
  switch (typeStr) {
    case 'movie':
      return 'movie';
    case 'episode':
      return 'episode';
    case 'audio':
      return 'track';
    case 'photo':
      return 'photo';
    default:
      return 'unknown';
  }
}

/**
 * Parse playback state from Jellyfin to unified state
 */
function parsePlaybackState(isPaused: unknown): MediaSession['playback']['state'] {
  return parseBoolean(isPaused) ? 'paused' : 'playing';
}

/**
 * Calculate progress percentage from position and duration
 */
function calculateProgress(positionMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(100, Math.round((positionMs / durationMs) * 100));
}

/**
 * Get bitrate from Jellyfin session in kbps (prefer transcoding bitrate, fall back to source)
 * Note: Jellyfin API returns bitrate in bps, so we convert to kbps for consistency with Plex
 */
function getBitrate(session: Record<string, unknown>): number {
  // Check transcoding info first
  const transcodingInfo = getNestedObject(session, 'TranscodingInfo');
  if (transcodingInfo) {
    const transcodeBitrate = parseNumber(transcodingInfo.Bitrate);
    if (transcodeBitrate > 0) return Math.round(transcodeBitrate / 1000); // bps → kbps
  }

  // Fall back to source media bitrate
  const nowPlaying = getNestedObject(session, 'NowPlayingItem');
  const mediaSources = nowPlaying?.MediaSources;
  if (Array.isArray(mediaSources) && mediaSources.length > 0) {
    const firstSource = mediaSources[0] as Record<string, unknown>;
    const bitrate = parseNumber(firstSource?.Bitrate);
    return Math.round(bitrate / 1000); // bps → kbps
  }

  return 0;
}

/**
 * Determine if stream is being transcoded
 */
function isTranscoding(session: Record<string, unknown>): boolean {
  const transcodingInfo = getNestedObject(session, 'TranscodingInfo');
  if (!transcodingInfo) return false;

  // If IsVideoDirect is false, it's transcoding
  const isVideoDirect = getNestedValue(transcodingInfo, 'IsVideoDirect');
  return isVideoDirect === false;
}

/**
 * Parse raw Jellyfin session data into a MediaSession object
 */
export function parseSession(session: Record<string, unknown>): MediaSession | null {
  const nowPlaying = getNestedObject(session, 'NowPlayingItem');
  if (!nowPlaying) return null; // No active playback

  const playState = getNestedObject(session, 'PlayState');
  const transcodingInfo = getNestedObject(session, 'TranscodingInfo');
  const imageTags = getNestedObject(nowPlaying, 'ImageTags');

  const durationMs = ticksToMs(nowPlaying.RunTimeTicks);
  const positionMs = ticksToMs(playState?.PositionTicks);
  const mediaType = parseMediaType(nowPlaying.Type);

  const isTranscode = isTranscoding(session);
  const videoDecision = isTranscode ? 'transcode' : 'directplay';
  if (transcodingInfo?.IsVideoDirect === false) {
    // It's actually transcoding
  }

  const result: MediaSession = {
    sessionKey: parseString(session.Id),
    mediaId: parseString(nowPlaying.Id),
    user: {
      id: parseString(session.UserId),
      username: parseString(session.UserName),
      thumb: parseOptionalString(session.UserPrimaryImageTag),
    },
    media: {
      title: parseString(nowPlaying.Name),
      type: mediaType,
      durationMs,
      year: parseOptionalNumber(nowPlaying.ProductionYear),
      thumbPath: imageTags?.Primary ? parseString(imageTags.Primary) : undefined,
    },
    playback: {
      state: parsePlaybackState(playState?.IsPaused),
      positionMs,
      progressPercent: calculateProgress(positionMs, durationMs),
    },
    player: {
      name: parseString(session.DeviceName),
      deviceId: parseString(session.DeviceId),
      product: parseOptionalString(session.Client),
      device: parseOptionalString(session.DeviceType),
      platform: undefined, // Jellyfin doesn't provide platform separately
    },
    network: {
      ipAddress: parseString(session.RemoteEndPoint),
      // Jellyfin doesn't explicitly indicate local vs remote
      isLocal: false,
    },
    quality: {
      bitrate: getBitrate(session),
      isTranscode,
      videoDecision,
    },
  };

  // Add episode-specific metadata if this is an episode
  if (mediaType === 'episode') {
    result.episode = {
      showTitle: parseString(nowPlaying.SeriesName),
      showId: parseOptionalString(nowPlaying.SeriesId),
      seasonNumber: parseNumber(nowPlaying.ParentIndexNumber),
      episodeNumber: parseNumber(nowPlaying.IndexNumber),
      seasonName: parseOptionalString(nowPlaying.SeasonName),
      showThumbPath: parseOptionalString(nowPlaying.SeriesPrimaryImageTag),
    };
  }

  return result;
}

/**
 * Parse Jellyfin sessions API response
 * Filters to only sessions with active playback
 */
export function parseSessionsResponse(sessions: unknown[]): MediaSession[] {
  if (!Array.isArray(sessions)) return [];

  const results: MediaSession[] = [];
  for (const session of sessions) {
    const parsed = parseSession(session as Record<string, unknown>);
    if (parsed) results.push(parsed);
  }
  return results;
}

// ============================================================================
// User Parsing
// ============================================================================

/**
 * Parse raw Jellyfin user data into a MediaUser object
 */
export function parseUser(user: Record<string, unknown>): MediaUser {
  const policy = getNestedObject(user, 'Policy');

  return {
    id: parseString(user.Id),
    username: parseString(user.Name),
    email: undefined, // Jellyfin doesn't expose email in user API
    thumb: parseOptionalString(user.PrimaryImageTag),
    isAdmin: parseBoolean(policy?.IsAdministrator),
    isDisabled: parseBoolean(policy?.IsDisabled),
    lastLoginAt: user.LastLoginDate ? new Date(parseString(user.LastLoginDate)) : undefined,
    lastActivityAt: user.LastActivityDate ? new Date(parseString(user.LastActivityDate)) : undefined,
  };
}

/**
 * Parse Jellyfin users API response
 */
export function parseUsersResponse(users: unknown[]): MediaUser[] {
  if (!Array.isArray(users)) return [];
  return users.map((user) => parseUser(user as Record<string, unknown>));
}

// ============================================================================
// Library Parsing
// ============================================================================

/**
 * Parse raw Jellyfin library (virtual folder) data into a MediaLibrary object
 */
export function parseLibrary(folder: Record<string, unknown>): MediaLibrary {
  return {
    id: parseString(folder.ItemId),
    name: parseString(folder.Name),
    type: parseString(folder.CollectionType, 'unknown'),
    locations: Array.isArray(folder.Locations) ? (folder.Locations as string[]) : [],
  };
}

/**
 * Parse Jellyfin libraries (virtual folders) API response
 */
export function parseLibrariesResponse(folders: unknown[]): MediaLibrary[] {
  if (!Array.isArray(folders)) return [];
  return folders.map((folder) => parseLibrary(folder as Record<string, unknown>));
}

// ============================================================================
// Watch History Parsing
// ============================================================================

/**
 * Parse raw Jellyfin watch history item into a MediaWatchHistoryItem object
 */
export function parseWatchHistoryItem(item: Record<string, unknown>): MediaWatchHistoryItem {
  const userData = getNestedObject(item, 'UserData');
  const mediaType = parseMediaType(item.Type);

  const historyItem: MediaWatchHistoryItem = {
    mediaId: parseString(item.Id),
    title: parseString(item.Name),
    type: mediaType === 'photo' ? 'unknown' : mediaType,
    // Jellyfin returns ISO date string
    watchedAt: parseDateString(userData?.LastPlayedDate) ?? '',
    playCount: parseNumber(userData?.PlayCount),
  };

  // Add episode metadata if applicable
  if (mediaType === 'episode') {
    historyItem.episode = {
      showTitle: parseString(item.SeriesName),
      seasonNumber: parseOptionalNumber(item.ParentIndexNumber),
      episodeNumber: parseOptionalNumber(item.IndexNumber),
    };
  }

  return historyItem;
}

/**
 * Parse Jellyfin watch history (Items) API response
 */
export function parseWatchHistoryResponse(data: unknown): MediaWatchHistoryItem[] {
  const items = (data as { Items?: unknown[] })?.Items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => parseWatchHistoryItem(item as Record<string, unknown>));
}

// ============================================================================
// Activity Log Parsing
// ============================================================================

/**
 * Activity log entry from Jellyfin
 */
export interface JellyfinActivityEntry {
  id: number;
  name: string;
  overview?: string;
  shortOverview?: string;
  type: string;
  itemId?: string;
  userId?: string;
  date: string;
  severity: string;
}

/**
 * Parse raw Jellyfin activity log item
 */
export function parseActivityLogItem(item: Record<string, unknown>): JellyfinActivityEntry {
  return {
    id: parseNumber(item.Id),
    name: parseString(item.Name),
    overview: parseOptionalString(item.Overview),
    shortOverview: parseOptionalString(item.ShortOverview),
    type: parseString(item.Type),
    itemId: parseOptionalString(item.ItemId),
    userId: parseOptionalString(item.UserId),
    date: parseString(item.Date),
    severity: parseString(item.Severity, 'Information'),
  };
}

/**
 * Parse Jellyfin activity log API response
 */
export function parseActivityLogResponse(data: unknown): JellyfinActivityEntry[] {
  const items = (data as { Items?: unknown[] })?.Items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => parseActivityLogItem(item as Record<string, unknown>));
}

// ============================================================================
// Authentication Response Parsing
// ============================================================================

/**
 * Authentication result from Jellyfin
 */
export interface JellyfinAuthResult {
  id: string;
  username: string;
  token: string;
  serverId: string;
  isAdmin: boolean;
}

/**
 * Parse Jellyfin authentication response
 */
export function parseAuthResponse(data: Record<string, unknown>): JellyfinAuthResult {
  const user = getNestedObject(data, 'User') ?? {};
  const policy = getNestedObject(user, 'Policy') ?? {};

  return {
    id: parseString(user.Id),
    username: parseString(user.Name),
    token: parseString(data.AccessToken),
    serverId: parseString(data.ServerId),
    isAdmin: parseBoolean(policy.IsAdministrator),
  };
}
