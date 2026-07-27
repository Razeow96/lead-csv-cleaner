// qualify.js — rules-based lead score (0-100) and bucket.
// Pure functions only. Runs in both the browser and Node.
// The weights below are the single source of truth and are documented
// verbatim in README.md — if you change one, change the other.

export const WEIGHTS = {
  corporateEmailDomain: 40, // valid email on a non-free, non-disposable domain
  emailValid: 20,
  hasName: 15,
  hasCompany: 15,
  hasPhone: 10,
};

export const BUCKET_THRESHOLDS = {
  hot: 70,  // score >= 70
  warm: 40, // 40-69; below 40 is Cold
};

/**
 * Score one cleaned lead using its validation result.
 * A disposable email domain is an automatic 0 / "Disqualified".
 * Returns { score, bucket, reasons }.
 */
export function qualifyLead(lead, validation) {
  if (validation.disposable) {
    return { score: 0, bucket: 'Disqualified', reasons: ['disposable email domain'] };
  }

  let score = 0;
  const reasons = [];
  const corporate = validation.emailValid && Boolean(validation.domain) && !validation.freeProvider;

  if (corporate) { score += WEIGHTS.corporateEmailDomain; reasons.push(`corporate email domain +${WEIGHTS.corporateEmailDomain}`); }
  if (validation.emailValid) { score += WEIGHTS.emailValid; reasons.push(`valid email +${WEIGHTS.emailValid}`); }
  if (lead.name) { score += WEIGHTS.hasName; reasons.push(`has name +${WEIGHTS.hasName}`); }
  if (lead.company) { score += WEIGHTS.hasCompany; reasons.push(`has company +${WEIGHTS.hasCompany}`); }
  if (lead.phone) { score += WEIGHTS.hasPhone; reasons.push(`has phone +${WEIGHTS.hasPhone}`); }

  const bucket = score >= BUCKET_THRESHOLDS.hot ? 'Hot'
    : score >= BUCKET_THRESHOLDS.warm ? 'Warm'
      : 'Cold';

  return { score, bucket, reasons };
}
