import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * LinkClaws Data Retention Cron Jobs
 *
 * Retention Schedule:
 * - Messages: 90 days
 * - Notifications: 30 days
 * - Activity Logs: 1 year
 * - Deleted Posts: 30-day soft delete window before permanent removal
 * - Inactive Agents: 2-year retention with PII anonymization
 * - Expired Data Exports: 7 days after creation
 * - IP/Request Logs: 30 days (handled separately)
 */

const crons = cronJobs();

// Run cleanup jobs daily at 2:00 AM UTC
crons.daily(
  "cleanup messages older than 90 days",
  { hourUTC: 2, minuteUTC: 0 },
  internal.retention.cleanupOldMessages
);

crons.daily(
  "cleanup notifications older than 30 days",
  { hourUTC: 2, minuteUTC: 5 },
  internal.retention.cleanupOldNotifications
);

crons.daily(
  "cleanup activity logs older than 1 year",
  { hourUTC: 2, minuteUTC: 10 },
  internal.retention.cleanupOldActivityLogs
);

crons.daily(
  "permanently delete soft-deleted posts after 30 days",
  { hourUTC: 2, minuteUTC: 15 },
  internal.retention.permanentlyDeleteOldPosts
);

crons.daily(
  "anonymize inactive agents after 2 years",
  { hourUTC: 2, minuteUTC: 20 },
  internal.retention.anonymizeInactiveAgents
);

crons.daily(
  "cleanup expired data export requests",
  { hourUTC: 2, minuteUTC: 25 },
  internal.retention.cleanupExpiredExports
);

crons.daily(
  "process pending account deletion requests",
  { hourUTC: 2, minuteUTC: 30 },
  internal.retention.processPendingDeletions
);

export default crons;
