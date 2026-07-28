// main.js — wires the UI to the pipeline. All processing stays in this
// browser tab: the CSV is read with FileReader and never uploaded anywhere.

import { parseCsvText, recordsToLeads } from './parse-csv.js';
import { cleanLeads } from './clean.js';
import { validateLead } from './validate.js';
import { qualifyLead } from './qualify.js';
import { buildCleanedRows, buildFlaggedRows, buildSummary, toCsv, toJson } from './export.js';
import * as ui from './ui.js';

let lastRun = null; // { summary, results, malformed, baseName }

/** parse -> clean -> validate -> qualify -> summarize. Pure, no DOM. */
function runPipeline(text) {
  const records = parseCsvText(text);
  if (records.length < 2) {
    throw new Error('That CSV needs a header row and at least one data row.');
  }
  const { leads, malformed, totalDataRows } = recordsToLeads(records);
  const { cleaned, emptyRemoved, duplicatesRemoved } = cleanLeads(leads);
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
  return { summary, results, malformed, flagged };
}

function process(text, fileName) {
  ui.clearError();
  try {
    const run = runPipeline(text);
    lastRun = { ...run, baseName: fileName.replace(/\.csv$/i, '') || 'leads' };
    ui.renderSummary(run.summary, fileName);
    ui.renderTable(run.results);
  } catch (err) {
    ui.showError(`Could not process "${fileName}": ${err.message}`);
    ui.setStatus('Ready. Drop a CSV to begin.');
  }
}

function handleFile(file) {
  if (!file) return;
  if (!/\.(csv|txt)$/i.test(file.name)) {
    ui.showError(`"${file.name}" does not look like a CSV file. Expected a .csv (or .txt) file.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => process(String(reader.result), file.name);
  reader.onerror = () => ui.showError(`Could not read "${file.name}": ${reader.error}`);
  reader.readAsText(file);
}

function wireEvents() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files[0]);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

  document.getElementById('load-sample').addEventListener('click', async () => {
    try {
      const res = await fetch('samples/leads-sample.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      process(await res.text(), 'leads-sample.csv');
    } catch (err) {
      ui.showError(`Could not load the sample (${err.message}). If you opened index.html straight from disk, serve the folder with a local server instead. The README quickstart has the commands.`);
    }
  });

  document.getElementById('download-cleaned-csv').addEventListener('click', () => {
    const { columns, rows } = buildCleanedRows(lastRun.results);
    ui.downloadFile(`${lastRun.baseName}-cleaned.csv`, toCsv(rows, columns), 'text/csv');
  });
  document.getElementById('download-cleaned-json').addEventListener('click', () => {
    const { rows } = buildCleanedRows(lastRun.results);
    ui.downloadFile(`${lastRun.baseName}-cleaned.json`, toJson(rows), 'application/json');
  });
  document.getElementById('download-flagged-csv').addEventListener('click', () => {
    ui.downloadFile(`${lastRun.baseName}-flagged.csv`, toCsv(lastRun.flagged.rows, lastRun.flagged.columns), 'text/csv');
  });

  window.addEventListener('error', (e) => {
    ui.showError(`Unexpected error: ${e.message}`);
  });
}

wireEvents();
ui.setStatus('Ready. Drop a CSV to begin.');
document.body.dataset.appReady = 'true'; // headless smoke checks look for this
