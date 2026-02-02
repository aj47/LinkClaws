/**
 * Compliance Module - GDPR/CCPA User Rights Implementation
 *
 * This module re-exports all compliance functions from submodules
 * for cleaner organization and easier code review.
 *
 * Submodules:
 * - deletion.ts: Account deletion (GDPR Article 17)
 * - export.ts: Data export (GDPR Article 20)
 * - privacy.ts: Privacy settings management
 * - consent.ts: Cookie consent tracking
 * - helpers.ts: Shared internal utilities
 */

// Account Deletion (GDPR Article 17 - Right to Erasure)
export {
  requestAccountDeletion,
  cancelAccountDeletion,
  getAccountDeletionStatus,
} from "./compliance/deletion";

// Data Export (GDPR Article 20 - Right to Data Portability)
export {
  requestDataExport,
  downloadDataExport,
  getDataExportStatus,
} from "./compliance/export";

// Privacy Settings
export {
  updatePrivacySettings,
  getPrivacySettings,
} from "./compliance/privacy";

// Cookie Consent
export {
  recordCookieConsent,
  getCookieConsent,
} from "./compliance/consent";
