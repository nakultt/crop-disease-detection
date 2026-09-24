import "server-only";
import type { Document, Filter } from "mongodb";
import { COLLECTIONS, getDb } from "./db";
import { scanCountsByUser } from "./scans";

/**
 * Read models for the admin console. Only ever called after `requireAdmin()`.
 * Mutations (roles, bans, removal) go through Better Auth's admin endpoints,
 * which enforce the admin role themselves.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 14;

export interface DailyPoint {
  start: string;
  count: number;
}

export interface AdminOverview {
  users: {
    total: number;
    verified: number;
    admins: number;
    banned: number;
    newLast7Days: number;
  };
  scans: {
    total: number;
    last7Days: number;
    withPhotos: number;
    diseased: number;
  };
  signupsDaily: DailyPoint[];
  scansDaily: DailyPoint[];
  topConditions: { className: string; count: number }[];
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function fillDays(
  rows: { _id: Date; count: number }[],
  first: Date,
): DailyPoint[] {
  const counts = new Map(
    rows.map((row) => [new Date(row._id).getTime(), row.count]),
  );
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(first.getTime() + i * DAY_MS);
    return { start: day.toISOString(), count: counts.get(day.getTime()) ?? 0 };
  });
}

const perDay = (since: Date): Document[] => [
  { $match: { createdAt: { $gte: since } } },
  {
    $group: {
      _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "UTC" } },
      count: { $sum: 1 },
    },
  },
];

export async function adminOverview(
  now: Date = new Date(),
): Promise<AdminOverview> {
  const db = getDb();
  const users = db.collection(COLLECTIONS.user);
  const scans = db.collection(COLLECTIONS.scans);

  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const firstDay = new Date(startOfUtcDay(now).getTime() - (DAYS - 1) * DAY_MS);

  const [
    total,
    verified,
    admins,
    banned,
    newLast7Days,
    signupRows,
    scanTotals,
    scanRows,
    top,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ emailVerified: true }),
    users.countDocuments({ role: "admin" }),
    users.countDocuments({ banned: true }),
    users.countDocuments({ createdAt: { $gte: weekAgo } }),
    users.aggregate<{ _id: Date; count: number }>(perDay(firstDay)).toArray(),
    scans
      .aggregate<{
        total: number;
        last7: number;
        withPhotos: number;
        diseased: number;
      }>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            last7: {
              $sum: { $cond: [{ $gte: ["$createdAt", weekAgo] }, 1, 0] },
            },
            withPhotos: { $sum: { $cond: [{ $ne: ["$image", null] }, 1, 0] } },
            diseased: { $sum: { $cond: ["$disease.healthy", 0, 1] } },
          },
        },
      ])
      .toArray(),
    scans.aggregate<{ _id: Date; count: number }>(perDay(firstDay)).toArray(),
    scans
      .aggregate<{ _id: string; count: number }>([
        { $match: { "disease.healthy": false } },
        { $group: { _id: "$disease.className", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 },
      ])
      .toArray(),
  ]);

  const totals = scanTotals[0];
  return {
    users: { total, verified, admins, banned, newLast7Days },
    scans: {
      total: totals?.total ?? 0,
      last7Days: totals?.last7 ?? 0,
      withPhotos: totals?.withPhotos ?? 0,
      diseased: totals?.diseased ?? 0,
    },
    signupsDaily: fillDays(signupRows, firstDay),
    scansDaily: fillDays(scanRows, firstDay),
    topConditions: top.map((row) => ({ className: row._id, count: row.count })),
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  scans: number;
}

export interface AdminUserPage {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface UserDoc {
  _id: { toHexString(): string };
  name?: string;
  email: string;
  emailVerified?: boolean;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt?: Date;
}

export async function listUsersForAdmin(options: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminUserPage> {
  const pageSize = options.pageSize ?? 20;
  const q = options.q?.trim().slice(0, 100);
  const filter: Filter<UserDoc> = q
    ? {
        $or: [
          { email: new RegExp(escapeRegex(q), "i") },
          { name: new RegExp(escapeRegex(q), "i") },
        ],
      }
    : {};

  const users = getDb().collection<UserDoc>(COLLECTIONS.user);
  const total = await users.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const docs = await users
    .find(filter, {
      projection: {
        name: 1,
        email: 1,
        emailVerified: 1,
        role: 1,
        banned: 1,
        banReason: 1,
        createdAt: 1,
      },
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  const ids = docs.map((doc) => doc._id.toHexString());
  const counts = await scanCountsByUser(ids);

  return {
    users: docs.map((doc) => {
      const id = doc._id.toHexString();
      return {
        id,
        name: doc.name ?? "",
        email: doc.email,
        emailVerified: doc.emailVerified === true,
        role: doc.role ?? "user",
        banned: doc.banned === true,
        banReason: doc.banReason ?? null,
        createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
        scans: counts[id] ?? 0,
      };
    }),
    total,
    page,
    pageCount,
  };
}
