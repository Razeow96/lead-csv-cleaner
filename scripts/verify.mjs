// verify.mjs — real run of the pipeline against samples/leads-sample.csv.
// Imports the exact same ES modules the browser uses (they are pure, no DOM)
// and asserts the planted defects are caught. Run: node scripts/verify.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsvText, recordsToLeads } from '../js/parse-csv.js';
import { cleanLeads } from '../js/clean.js';
import { validateLead } from '../js/validate.js';
import { qualifyLead } from '../js/qualify.js';
import { buildFlaggedRows, buildSummary } from '../js/export.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, '..', 'samples', 'leads-sample.csv');
const text = readFileSync(csvPath, 'utf8');

// --- pipeline (same composition as js/main.js) --------------------------
const records = parseCsvText(text);
const { leads, malformed, totalDataRows } = recordsToLeads(records);
const { cleaned, emptyRemoved, duplicatesRemoved, duplicates } = cleanLeads(leads);
const results = cleaned.map((lead) => {
  const validation = validateLead(lead);
  const { score, bucket } = qualifyLead(lead, validation);
  return { lead, validation, score, bucket };
});
const flagged = buildFlaggedRows(malformed, results);
const summary = buildSummary({
  totalDataRows, malformed, emptyRemoved, duplicatesRemoved, results,
  flaggedRows: flagged.rows,
});

// --- report -------------------------------------------------------------
console.log('lead-csv-cleaner verify — real run on samples/leads-sample.csv');
console.log('');
console.log(`  rows in:            ${summary.rowsIn}`);
console.log(`  cleaned:            ${summary.cleaned}`);
console.log(`  duplicates removed: ${summary.duplicatesRemoved}`);
console.log(`  empty rows removed: ${summary.emptyRemoved}`);
console.log(`  malformed rows:     ${summary.malformed}`);
console.log(`  flagged rows:       ${summary.flagged}`);
console.log(`  buckets:            Hot ${summary.buckets.Hot} / Warm ${summary.buckets.Warm} / Cold ${summary.buckets.Cold} / Disqualified ${summary.buckets.Disqualified}`);
console.log('');
for (const d of duplicates) {
  console.log(`  duplicate removed:  row ${d.lead.rowNumber} (${d.lead.email || d.lead.name}) — ${d.reason}`);
}
for (const m of malformed) {
  console.log(`  malformed flagged:  row ${m.rowNumber} — ${m.reason}`);
}
console.log('');

// --- assertions ---------------------------------------------------------
let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  return ok;
}

check('25 data rows in', summary.rowsIn, 25);
check('1 malformed row flagged (9 fields vs 6)', malformed.length === 1 && malformed[0].reason, 'expected 6 fields, got 9');
check('1 empty row removed', summary.emptyRemoved, 1);
check('2 duplicates removed', summary.duplicatesRemoved, 2);
check('exact-email duplicate caught',
  duplicates.some((d) => d.reason.startsWith('exact email match')), true);
check('fuzzy name+domain duplicate caught',
  duplicates.some((d) => d.reason.startsWith('same name + domain')), true);
check('21 cleaned rows out', summary.cleaned, 21);
check('bucket counts', summary.buckets, { Hot: 13, Warm: 5, Cold: 1, Disqualified: 2 });
check('5 flagged rows (1 malformed + 2 invalid + 2 disposable)', summary.flagged, 5);

const alices = results.filter((r) => r.validation.domain === 'acme-widgets.example' && r.lead.name === 'Alice Tan');
check('Alice Tan survives exactly once', alices.length, 1);
check('Alice email lowercased', alices[0]?.lead.email, 'alice.tan@acme-widgets.example');
check('Alice name Title Cased from "  alice tan "', alices[0]?.lead.name, 'Alice Tan');
check('Alice scores 100 Hot', [alices[0]?.score, alices[0]?.bucket], [100, 'Hot']);

const emily = results.find((r) => r.lead.email === 'emily.wong@mailinator.com');
check('disposable row (mailinator.com) disqualified with score 0', [emily?.score, emily?.bucket], [0, 'Disqualified']);

const jack = results.find((r) => r.lead.email === 'jack.teo@umbrella-foods.example');
check('quoted comma fields parsed intact', jack?.lead.company, 'Umbrella Foods, Synthetic Bhd');

const gmail = results.find((r) => r.lead.email === 'david.chua88@gmail.com');
check('free-provider row gets no corporate points (45 Warm)', [gmail?.score, gmail?.bucket], [45, 'Warm']);

const invalid = results.find((r) => r.lead.name === 'Frank Lim');
check('invalid email detected for frank..lim@@not-an-email', invalid?.validation.emailValid, false);

console.log('');
if (failures > 0) {
  console.error(`verify FAILED — ${failures} check(s) did not pass.`);
  process.exit(1);
}
console.log('verify PASSED — all checks green.');
