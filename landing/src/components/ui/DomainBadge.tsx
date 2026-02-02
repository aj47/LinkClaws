"use client";

interface DomainBadgeProps {
  emailDomain?: string;
  emailDomainVerified?: boolean;
  verified?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * DomainBadge - Displays verification status with domain information
 * 
 * Shows:
 * - "✓ @domain.com" for verified work email domains (e.g., "✓ @stripe.com")
 * - "✓ Email" for verified personal email (gmail, etc.)
 * - "✓ Verified" for legacy verified status without email domain
 * - Nothing if not verified at all
 */
export function DomainBadge({
  emailDomain,
  emailDomainVerified,
  verified,
  size = "sm",
  className = "",
}: DomainBadgeProps) {
  // No badge if not verified in any way
  if (!verified && !emailDomainVerified && !emailDomain) {
    return null;
  }

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  // Work email domain verified - show domain badge
  if (emailDomainVerified && emailDomain) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-emerald-100 text-emerald-800 ${sizes[size]} ${className}`}
        title={`Verified work email @${emailDomain}`}
      >
        ✓ @{emailDomain}
      </span>
    );
  }

  // Personal email verified (has domain but not work domain)
  if (emailDomain && !emailDomainVerified) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-blue-100 text-blue-800 ${sizes[size]} ${className}`}
        title="Personal email verified"
      >
        ✓ Email
      </span>
    );
  }

  // Legacy verified status (verified but no email domain info)
  if (verified) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-green-100 text-green-800 ${sizes[size]} ${className}`}
        title="Verified"
      >
        ✓ Verified
      </span>
    );
  }

  return null;
}

/**
 * Compact version for inline display (e.g., in post cards)
 * Only shows the domain portion without the full badge styling
 */
export function DomainBadgeInline({
  emailDomain,
  emailDomainVerified,
  verified,
  className = "",
}: Omit<DomainBadgeProps, "size">) {
  // Work email domain verified
  if (emailDomainVerified && emailDomain) {
    return (
      <span
        className={`text-emerald-600 text-xs font-medium ${className}`}
        title={`Verified work email @${emailDomain}`}
      >
        ✓@{emailDomain}
      </span>
    );
  }

  // Personal email verified
  if (emailDomain && !emailDomainVerified) {
    return (
      <span
        className={`text-blue-600 text-xs font-medium ${className}`}
        title="Personal email verified"
      >
        ✓Email
      </span>
    );
  }

  // Legacy verified
  if (verified) {
    return (
      <span
        className={`text-green-600 text-xs font-medium ${className}`}
        title="Verified"
      >
        ✓
      </span>
    );
  }

  return null;
}

