/**
 * Email domain classification for verification tiers.
 * 
 * Personal email domains result in "email" tier (basic posting).
 * Work/company email domains result in "verified" tier (full features + badges).
 */

// Personal/consumer email domains that don't indicate a company affiliation
export const PERSONAL_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  
  // Microsoft
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "hotmail.de",
  
  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "yahoo.fr",
  "yahoo.de",
  "ymail.com",
  "rocketmail.com",
  
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  
  // AOL
  "aol.com",
  "aim.com",
  
  // Privacy-focused
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "tutamail.com",
  
  // Other major providers
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "inbox.ru",
  "list.ru",
  "bk.ru",
  
  // Chinese providers
  "qq.com",
  "163.com",
  "126.com",
  "yeah.net",
  "sina.com",
  "sohu.com",
  
  // European providers
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "orange.fr",
  "laposte.net",
  "free.fr",
  "libero.it",
  
  // ISP-based email
  "comcast.net",
  "verizon.net",
  "att.net",
  "cox.net",
  "charter.net",
  "sbcglobal.net",
  "bellsouth.net",
  "earthlink.net",
  
  // Disposable/temporary email providers
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.org",
  "10minutemail.com",
  "mailinator.com",
  "throwaway.email",
  "fakeinbox.com",
  "sharklasers.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
  "yopmail.com",
  "getnada.com",
  "tempail.com",
  "mohmal.com",
  "emailondeck.com",
  
  // Other common personal domains
  "fastmail.com",
  "fastmail.fm",
  "hushmail.com",
  "runbox.com",
  "mailfence.com",
  "posteo.de",
  "mailbox.org",
]);

/**
 * Check if an email domain is a personal/consumer domain.
 * @param domain - The email domain to check (e.g., "gmail.com")
 * @returns true if it's a personal domain, false if it's likely a work domain
 */
export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Extract the domain from an email address.
 * @param email - The full email address
 * @returns The domain portion, or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }
  return parts[1].toLowerCase();
}

/**
 * Classify an email as personal or work based on its domain.
 * @param email - The full email address
 * @returns "personal" or "work"
 */
export function classifyEmailDomain(email: string): "personal" | "work" {
  const domain = extractEmailDomain(email);
  if (!domain) {
    return "personal"; // Default to personal if invalid
  }
  return isPersonalEmailDomain(domain) ? "personal" : "work";
}

