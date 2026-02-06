/**
 * Play Statistics Routes
 *
 * GET /plays - Plays over time (engagement-based, >= 2 min sessions)
 * GET /plays-by-dayofweek - Plays grouped by day of week
 * GET /plays-by-hourofday - Plays grouped by hour of day
 *
 * All endpoints use engagement-based counting which filters out
 * sessions shorter than 2 minutes (Netflix-style "intent" threshold).
 */

import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { statsQuerySchema } from '@tracearr/shared';
import { db } from '../../db/client.js';
import { resolveDateRange } from './utils.js';
import { validateServerAccess, buildServerFilterFragment } from '../../utils/serverFiltering.js';
import { MEDIA_TYPE_SQL_FILTER } from '../../constants/index.js';

// Minimum session duration for a "valid" play (2 minutes in milliseconds)
const MIN_PLAY_DURATION_MS = 120000;

/**
 * Get bucket interval based on the requested period.
 * Returns interval string for TimescaleDB time_bucket().
 */
function getBucketInterval(period: string): string {
  switch (period) {
    case 'day':
      return '1 hour';
    case 'week':
      return '6 hours';
    case 'month':
    case 'year':
      return '1 day';
    case 'all':
    default:
      return '1 week';
  }
}

export const playsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /plays - Plays over time (engagement-based)
   *
   * Returns validated plays (sessions >= 2 min) grouped by day.
   * Uses timezone-aware day bucketing so plays are grouped by user's local day.
   */
  app.get('/plays', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.badRequest('Invalid query parameters');
    }

    const { period, startDate, endDate, serverId, timezone } = query.data;
    const authUser = request.user;
    const dateRange = resolveDateRange(period, startDate, endDate);
    // Default to UTC for backwards compatibility
    const tz = timezone ?? 'UTC';

    // Validate server access if specific server requested
    if (serverId) {
      const error = validateServerAccess(authUser, serverId);
      if (error) {
        return reply.forbidden(error);
      }
    }

    const serverFilter = buildServerFilterFragment(serverId, authUser);
    const bucketInterval = getBucketInterval(period);

    // Query sessions table with time_bucket for flexible granularity
    const baseWhere = dateRange.start
      ? sql`WHERE started_at >= ${dateRange.start} AND duration_ms >= ${MIN_PLAY_DURATION_MS}`
      : sql`WHERE duration_ms >= ${MIN_PLAY_DURATION_MS}`;

    const endDateWhere =
      period === 'custom' && dateRange.end ? sql`AND started_at < ${dateRange.end}` : sql``;

    const result = await db.execute(sql`
        SELECT
          time_bucket(${bucketInterval}::interval, started_at AT TIME ZONE ${tz})::text as date,
          COUNT(DISTINCT COALESCE(reference_id, id))::int as count
        FROM sessions
        ${baseWhere}
        ${MEDIA_TYPE_SQL_FILTER}
        ${endDateWhere}
        ${serverFilter}
        GROUP BY 1
        ORDER BY 1
      `);

    return { data: result.rows as { date: string; count: number }[] };
  });

  /**
   * GET /plays-by-dayofweek - Plays grouped by day of week (engagement-based)
   *
   * Returns validated plays (sessions >= 2 min) grouped by day of week.
   */
  app.get('/plays-by-dayofweek', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.badRequest('Invalid query parameters');
    }

    const { period, startDate, endDate, serverId, timezone } = query.data;
    const authUser = request.user;
    const dateRange = resolveDateRange(period, startDate, endDate);
    // Default to UTC for backwards compatibility
    const tz = timezone ?? 'UTC';

    // Validate server access if specific server requested
    if (serverId) {
      const error = validateServerAccess(authUser, serverId);
      if (error) {
        return reply.forbidden(error);
      }
    }

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const serverFilter = buildServerFilterFragment(serverId, authUser);

    // Build base WHERE with duration filter for validated plays
    const baseWhere = dateRange.start
      ? sql`WHERE started_at >= ${dateRange.start} AND duration_ms >= ${MIN_PLAY_DURATION_MS}`
      : sql`WHERE duration_ms >= ${MIN_PLAY_DURATION_MS}`;

    // Extract DOW from started_at in user's timezone for correct day bucketing
    const result = await db.execute(sql`
        SELECT
          EXTRACT(DOW FROM started_at AT TIME ZONE ${tz})::int as day,
          COUNT(DISTINCT COALESCE(reference_id, id))::int as count
        FROM sessions
        ${baseWhere}
        ${MEDIA_TYPE_SQL_FILTER}
        ${period === 'custom' ? sql`AND started_at < ${dateRange.end}` : sql``}
        ${serverFilter}
        GROUP BY 1
        ORDER BY 1
      `);

    const dayStats = result.rows as { day: number; count: number }[];

    // Ensure all 7 days are present (fill missing with 0)
    const dayMap = new Map(dayStats.map((d) => [d.day, d.count]));
    const data = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      name: DAY_NAMES[i],
      count: dayMap.get(i) ?? 0,
    }));

    return { data };
  });

  /**
   * GET /plays-by-hourofday - Plays grouped by hour of day (engagement-based)
   *
   * Returns validated plays (sessions >= 2 min) grouped by hour of day.
   * Queries sessions table directly with duration filter since engagement
   * view only has daily granularity.
   */
  app.get('/plays-by-hourofday', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.badRequest('Invalid query parameters');
    }

    const { period, startDate, endDate, serverId, timezone } = query.data;
    const authUser = request.user;
    const dateRange = resolveDateRange(period, startDate, endDate);
    // Default to UTC for backwards compatibility
    const tz = timezone ?? 'UTC';

    // Validate server access if specific server requested
    if (serverId) {
      const error = validateServerAccess(authUser, serverId);
      if (error) {
        return reply.forbidden(error);
      }
    }

    const serverFilter = buildServerFilterFragment(serverId, authUser);

    // For all-time queries, we need a base WHERE clause
    // Include duration filter for engagement-based counting
    const baseWhere = dateRange.start
      ? sql`WHERE started_at >= ${dateRange.start} AND duration_ms >= ${MIN_PLAY_DURATION_MS}`
      : sql`WHERE duration_ms >= ${MIN_PLAY_DURATION_MS}`;

    // Convert to user's timezone before extracting hour
    const result = await db.execute(sql`
        SELECT
          EXTRACT(HOUR FROM started_at AT TIME ZONE ${tz})::int as hour,
          COUNT(DISTINCT COALESCE(reference_id, id))::int as count
        FROM sessions
        ${baseWhere}
        ${MEDIA_TYPE_SQL_FILTER}
        ${period === 'custom' ? sql`AND started_at < ${dateRange.end}` : sql``}
        ${serverFilter}
        GROUP BY 1
        ORDER BY 1
      `);

    const hourStats = result.rows as { hour: number; count: number }[];

    // Ensure all 24 hours are present (fill missing with 0)
    const hourMap = new Map(hourStats.map((h) => [h.hour, h.count]));
    const data = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourMap.get(i) ?? 0,
    }));

    return { data };
  });
};
