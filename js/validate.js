// validate.js — email syntax, disposable-domain and free-provider checks.
// Pure functions only. Runs in both the browser and Node.

import { DISPOSABLE_DOMAINS } from '../data/disposable-domains.js';
import { FREE_PROVIDERS } from '../data/free-providers.js';

/**
 * RFC-5322-ish, pragmatic email check: printable local part, at least one
 * dot in the domain, no spaces, no double @. Intentionally not a full RFC
 * grammar — full RFC allows addresses no real mail server accepts.
 */
export const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * Best-effort domain for a lead:
 *  1. the part after "@" when the email has exactly one "@" and a dotted domain
 *  2. otherwise the domain/website column, stripped of protocol, www. and paths
 */
export function extractDomain(lead) {
  const email = String(lead.email ?? '').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at > 0 && at === email.lastIndexOf('@')) {
    const domain = email.slice(at + 1);
    if (domain.includes('.')) return domain;
  }
  let raw = String(lead.domain ?? '').trim().toLowerCase();
  if (!raw) return '';
  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
  return raw.split(/[/?#]/)[0];
}

/**
 * Validate one cleaned lead.
 * Returns { emailValid, domain, disposable, freeProvider, flags }.
 * `flags` is human-readable and feeds the UI table + flagged export.
 */
export function validateLead(lead) {
  const emailValid = Boolean(lead.email) && EMAIL_RE.test(lead.email);
  const domain = extractDomain(lead);
  const disposable = Boolean(domain) && DISPOSABLE_DOMAINS.has(domain);
  const freeProvider = Boolean(domain) && FREE_PROVIDERS.has(domain);

  const flags = [];
  if (!lead.email) flags.push('missing email');
  else if (!emailValid) flags.push('invalid email');
  if (disposable) flags.push('disposable domain');
  if (freeProvider) flags.push('free provider');

  return { emailValid, domain, disposable, freeProvider, flags };
}
