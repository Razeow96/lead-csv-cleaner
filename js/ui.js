// ui.js — all DOM access lives here (and in main.js). Everything else is pure.

let currentResults = [];
let sortState = { key: 'score', dir: 'desc' };

const $ = (id) => document.getElementById(id);

export function setStatus(message) {
  $('status').textContent = message;
}

export function showError(message) {
  const box = $('error-box');
  box.textContent = message;
  box.hidden = false;
}

export function clearError() {
  const box = $('error-box');
  box.textContent = '';
  box.hidden = true;
}

export function renderSummary(summary, fileName) {
  $('results').hidden = false;
  setStatus(`Processed ${fileName} — ${summary.rowsIn} rows in, ${summary.cleaned} cleaned, ${summary.flagged} flagged.`);

  const cards = [
    ['Rows in', summary.rowsIn],
    ['Cleaned', summary.cleaned],
    ['Duplicates removed', summary.duplicatesRemoved],
    ['Empty rows removed', summary.emptyRemoved],
    ['Malformed rows', summary.malformed],
    ['Flagged', summary.flagged],
  ];
  const grid = $('summary-grid');
  grid.textContent = '';
  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'card';
    const num = document.createElement('div');
    num.className = 'card-value';
    num.textContent = String(value);
    const cap = document.createElement('div');
    cap.className = 'card-label';
    cap.textContent = label;
    card.append(num, cap);
    grid.append(card);
  }

  const chips = $('bucket-chips');
  chips.textContent = '';
  for (const bucket of ['Hot', 'Warm', 'Cold', 'Disqualified']) {
    const chip = document.createElement('span');
    chip.className = `chip chip-${bucket.toLowerCase()}`;
    chip.textContent = `${bucket} ${summary.buckets[bucket]}`;
    chips.append(chip);
  }
}

const COLUMNS = [
  { key: 'score', label: 'Score', numeric: true },
  { key: 'bucket', label: 'Bucket' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'domain', label: 'Domain' },
  { key: 'phone', label: 'Phone' },
  { key: 'flags', label: 'Flags' },
];

function rowValue(result, key) {
  switch (key) {
    case 'score': return result.score;
    case 'bucket': return result.bucket;
    case 'domain': return result.validation.domain;
    case 'flags': return result.validation.flags.join(', ');
    default: return result.lead[key] ?? '';
  }
}

export function renderTable(results) {
  if (results) currentResults = results;
  const sorted = [...currentResults].sort((a, b) => {
    const av = rowValue(a, sortState.key);
    const bv = rowValue(b, sortState.key);
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    return sortState.dir === 'asc' ? cmp : -cmp;
  });
  const preview = sorted.slice(0, 100);

  const table = $('preview-table');
  table.textContent = '';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const col of COLUMNS) {
    const th = document.createElement('th');
    th.textContent = col.label + (sortState.key === col.key ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '');
    th.tabIndex = 0;
    th.addEventListener('click', () => {
      sortState = sortState.key === col.key
        ? { key: col.key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: col.numeric ? 'desc' : 'asc' };
      renderTable();
    });
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const result of preview) {
    const tr = document.createElement('tr');
    tr.className = `row-${result.bucket.toLowerCase()}`;
    for (const col of COLUMNS) {
      const td = document.createElement('td');
      td.textContent = String(rowValue(result, col.key));
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);

  $('table-note').textContent = currentResults.length > 100
    ? `Showing first 100 of ${currentResults.length} rows. Downloads always contain every row.`
    : `Showing all ${currentResults.length} rows.`;
}

export function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
