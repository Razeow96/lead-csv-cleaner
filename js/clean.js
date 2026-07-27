// clean.js — normalize values, strip empty rows, remove duplicates.
// Pure functions only. Runs in both the browser and Node.

import { extractDomain } from './validate.js';

export function collapseWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** "  aLiCe   o'brien-tan " -> "Alice O'Brien-Tan" */
export function titleCaseName(value) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Clean a list of leads:
 *  1. trim + collapse whitespace on every field
 *  2. emails and domains lowercased, names Title Cased
 *  3. rows with no values at all are removed (counted, never hidden)
 *  4. dedupe pass 1: exact match on normalized email
 *  5. dedupe pass 2 (fuzzy): same normalized name + same domain
 *
 * Returns { cleaned, emptyRemoved, duplicates, duplicatesRemoved }.
 * Every removed duplicate is kept in `duplicates` with its reason.
 */
export function cleanLeads(leads) {
  const normalized = leads.map((lead) => ({
    ...lead,
    name: titleCaseName(lead.name),
    email: collapseWhitespace(lead.email).toLowerCase(),
    company: collapseWhitespace(lead.company),
    domain: collapseWhitespace(lead.domain).toLowerCase(),
    phone: collapseWhitespace(lead.phone),
    extra: Object.fromEntries(
      Object.entries(lead.extra || {}).map(([k, v]) => [k, collapseWhitespace(v)]),
    ),
  }));

  const nonEmpty = [];
  let emptyRemoved = 0;
  for (const lead of normalized) {
    const hasValue = [lead.name, lead.email, lead.company, lead.domain, lead.phone,
      ...Object.values(lead.extra)].some((v) => v !== '');
    if (hasValue) nonEmpty.push(lead);
    else emptyRemoved += 1;
  }

  const seenEmail = new Map();      // email -> kept lead
  const seenNameDomain = new Map(); // "name|domain" -> kept lead
  const cleaned = [];
  const duplicates = [];

  for (const lead of nonEmpty) {
    if (lead.email && seenEmail.has(lead.email)) {
      duplicates.push({
        lead,
        reason: `exact email match with row ${seenEmail.get(lead.email).rowNumber}`,
      });
      continue;
    }
    const domain = extractDomain(lead);
    const fuzzyKey = lead.name && domain ? `${lead.name.toLowerCase()}|${domain}` : '';
    if (fuzzyKey && seenNameDomain.has(fuzzyKey)) {
      duplicates.push({
        lead,
        reason: `same name + domain as row ${seenNameDomain.get(fuzzyKey).rowNumber}`,
      });
      continue;
    }
    if (lead.email) seenEmail.set(lead.email, lead);
    if (fuzzyKey) seenNameDomain.set(fuzzyKey, lead);
    cleaned.push(lead);
  }

  return { cleaned, emptyRemoved, duplicates, duplicatesRemoved: duplicates.length };
}
