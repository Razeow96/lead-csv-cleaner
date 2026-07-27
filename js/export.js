// export.js — build the output rows, summary, CSV and JSON strings.
// Pure functions only (string building). File downloads live in ui.js.

export function escapeCsvField(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function toJson(rows) {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

/**
 * Flatten scored results ({ lead, validation, score, bucket }) into flat
 * export rows. Unmapped source columns are carried through untouched.
 * Returns { columns, rows }.
 */
export function buildCleanedRows(results) {
  const extraKeys = [];
  for (const r of results) {
    for (const key of Object.keys(r.lead.extra || {})) {
      if (!extraKeys.includes(key)) extraKeys.push(key);
    }
  }
  const columns = ['name', 'email', 'company', 'domain', 'phone',
    ...extraKeys, 'email_valid', 'free_provider', 'score', 'bucket'];
  const rows = results.map((r) => {
    const row = {
      name: r.lead.name,
      email: r.lead.email,
      company: r.lead.company,
      domain: r.validation.domain || r.lead.domain,
      phone: r.lead.phone,
      email_valid: r.validation.emailValid,
      free_provider: r.validation.freeProvider,
      score: r.score,
      bucket: r.bucket,
    };
    for (const key of extraKeys) row[key] = r.lead.extra?.[key] ?? '';
    return row;
  });
  return { columns, rows };
}

/**
 * Everything that needs a human look, with the reason spelled out:
 * malformed rows, missing/invalid emails, disposable domains.
 * Nothing is ever silently dropped — it lands here instead.
 * Returns { columns, rows }.
 */
export function buildFlaggedRows(malformed, results) {
  const columns = ['source_row', 'reason', 'name', 'email', 'company', 'phone', 'raw'];
  const rows = [];
  for (const m of malformed) {
    rows.push({
      source_row: m.rowNumber,
      reason: `malformed row (${m.reason})`,
      name: '', email: '', company: '', phone: '',
      raw: m.raw,
    });
  }
  for (const r of results) {
    const reasons = [];
    if (!r.lead.email) reasons.push('missing email');
    else if (!r.validation.emailValid) reasons.push('invalid email syntax');
    if (r.validation.disposable) reasons.push('disposable email domain');
    if (reasons.length > 0) {
      rows.push({
        source_row: r.lead.rowNumber,
        reason: reasons.join('; '),
        name: r.lead.name,
        email: r.lead.email,
        company: r.lead.company,
        phone: r.lead.phone,
        raw: '',
      });
    }
  }
  return { columns, rows };
}

/**
 * Processing summary for the UI panel and the verify script.
 * All counts are derived from the same objects the exports use,
 * so the summary can never disagree with the downloads.
 */
export function buildSummary({ totalDataRows, malformed, emptyRemoved, duplicatesRemoved, results, flaggedRows }) {
  const buckets = { Hot: 0, Warm: 0, Cold: 0, Disqualified: 0 };
  for (const r of results) buckets[r.bucket] += 1;
  return {
    rowsIn: totalDataRows,
    cleaned: results.length,
    malformed: malformed.length,
    emptyRemoved,
    duplicatesRemoved,
    flagged: flaggedRows.length,
    buckets,
  };
}
