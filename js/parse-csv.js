// parse-csv.js — turn raw CSV text into lead objects.
// Pure functions only. No DOM access, so this module runs in both the
// browser and Node (scripts/verify.mjs).

/**
 * Column aliases, matched case-insensitively after stripping every
 * non-alphanumeric character ("E-mail Address" -> "emailaddress").
 */
const HEADER_ALIASES = {
  name: ['name', 'fullname', 'contactname', 'contact', 'leadname', 'person'],
  email: ['email', 'emailaddress', 'mail', 'workemail', 'businessemail'],
  company: ['company', 'companyname', 'organization', 'organisation', 'org', 'employer', 'business'],
  domain: ['domain', 'companydomain', 'website', 'site', 'url', 'web'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'cell', 'contactnumber'],
};

export function normalizeHeader(header) {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * RFC 4180-style CSV parser: handles quoted fields, embedded commas,
 * escaped quotes ("") and newlines inside quotes. Accepts \n, \r\n and \r
 * line endings. Returns an array of records (each a string[]).
 */
export function parseCsvText(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => { record.push(field); field = ''; };
  const pushRecord = () => { pushField(); records.push(record); record = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i += 1; continue;                          // closing quote
      }
      field += c; i += 1; continue;                                  // anything, incl. , and \n
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { pushField(); i += 1; continue; }
    if (c === '\r') { if (text[i + 1] === '\n') i += 1; pushRecord(); i += 1; continue; }
    if (c === '\n') { pushRecord(); i += 1; continue; }
    field += c; i += 1;
  }
  // final record without trailing newline
  if (field !== '' || record.length > 0) pushRecord();
  return records;
}

/**
 * Map raw records to lead objects using the header row.
 * Rows whose field count does not match the header are NEVER silently
 * dropped: they are reported in `malformed` and end up in the flagged export.
 *
 * Returns { headerRow, leads, malformed, totalDataRows }.
 * Each lead: { rowNumber, name, email, company, domain, phone, extra }.
 */
export function recordsToLeads(records) {
  if (!records || records.length === 0) {
    return { headerRow: [], leads: [], malformed: [], totalDataRows: 0 };
  }
  const headerRow = records[0].map((h) => String(h).trim());
  const normalized = headerRow.map(normalizeHeader);

  const columnMap = {}; // canonical field -> column index
  for (const [fieldName, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) columnMap[fieldName] = idx;
  }
  // Fall back to "First Name" + "Last Name" when there is no single name column.
  const firstNameIdx = normalized.indexOf('firstname');
  const lastNameIdx = normalized.indexOf('lastname');
  const useSplitName = columnMap.name === undefined && (firstNameIdx !== -1 || lastNameIdx !== -1);

  const mappedIndexes = new Set(Object.values(columnMap));
  if (useSplitName) {
    if (firstNameIdx !== -1) mappedIndexes.add(firstNameIdx);
    if (lastNameIdx !== -1) mappedIndexes.add(lastNameIdx);
  }

  const leads = [];
  const malformed = [];

  records.slice(1).forEach((record, i) => {
    const rowNumber = i + 2; // 1-based, header is row 1
    if (record.length !== headerRow.length) {
      malformed.push({
        rowNumber,
        reason: `expected ${headerRow.length} fields, got ${record.length}`,
        raw: record.join(','),
      });
      return;
    }
    const get = (idx) => (idx === undefined ? '' : String(record[idx] ?? ''));
    const lead = {
      rowNumber,
      name: useSplitName
        ? [get(firstNameIdx === -1 ? undefined : firstNameIdx), get(lastNameIdx === -1 ? undefined : lastNameIdx)].join(' ').trim()
        : get(columnMap.name),
      email: get(columnMap.email),
      company: get(columnMap.company),
      domain: get(columnMap.domain),
      phone: get(columnMap.phone),
      extra: {},
    };
    headerRow.forEach((header, idx) => {
      if (!mappedIndexes.has(idx)) lead.extra[header] = String(record[idx] ?? '');
    });
    leads.push(lead);
  });

  return { headerRow, leads, malformed, totalDataRows: records.length - 1 };
}
