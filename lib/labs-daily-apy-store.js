/**
 * Daily APY history for Labs strategies: seed JSON + Google Sheet labs_daily_apy.
 */

const fs = require("fs");
const path = require("path");
const { mergeDailyRows } = require("./labs-looping-apy");

function googleApi() {
  return require("googleapis").google;
}

const SPREADSHEET_ID = "1ZrMaFUyrHmxldFG242OsKHLOWPxhI4H8vCxO-TvL9Zg";
const SHEET_TITLE = "labs_daily_apy";
const HEADERS = ["date", "strategyId", "apyPct", "fixedApy", "borrowApy", "leverage", "source"];
const SEED_PATH = path.join(__dirname, "..", "data", "labs-daily-apy.json");

function loadSeedFile() {
  try {
    const raw = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    const out = {};
    Object.keys(raw || {}).forEach(function (id) {
      out[id] = (raw[id] || []).map(function (r) {
        return Object.assign({ strategyId: id }, r);
      });
    });
    return out;
  } catch {
    return {};
  }
}

function getCredentials() {
  const p = path.join(__dirname, "..", "pusher-490008-bf7c384ba372.json");
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  const envJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CREDENTIALS_JSON;
  if (!envJson) return null;
  try {
    return JSON.parse(envJson);
  } catch {
    return null;
  }
}

function withTimeout(promise, ms, label) {
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error((label || "sheets") + " timeout"));
    }, ms);
    promise.then(
      function (v) {
        clearTimeout(timer);
        resolve(v);
      },
      function (e) {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function getWriteSheets() {
  const cred = getCredentials();
  if (!cred) return null;
  const google = googleApi();
  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureDailySheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some(function (s) {
    return s.properties && s.properties.title === SHEET_TITLE;
  });
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_TITLE } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_TITLE}'!A1:G1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

function parseSheetRows(values) {
  const rows = values || [];
  if (!rows.length) return {};
  let headerRow = 0;
  const blob = String((rows[0] || []).join(" ")).toLowerCase();
  if (!blob.includes("date") && !blob.includes("дата")) headerRow = 0;
  const headers = (rows[headerRow] || []).map(function (h) {
    return String(h || "").trim();
  });
  const idx = {};
  HEADERS.forEach(function (name) {
    idx[name] = headers.indexOf(name);
  });
  const out = {};
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const strategyId = String(idx.strategyId >= 0 ? r[idx.strategyId] : r[1] || "").trim();
    const date = String(idx.date >= 0 ? r[idx.date] : r[0] || "").trim();
    if (!strategyId || !date) continue;
    const row = {
      date,
      strategyId,
      apyPct: Number(idx.apyPct >= 0 ? r[idx.apyPct] : r[2]),
      fixedApy: Number(idx.fixedApy >= 0 ? r[idx.fixedApy] : r[3]),
      borrowApy: Number(idx.borrowApy >= 0 ? r[idx.borrowApy] : r[4]),
      leverage: Number(idx.leverage >= 0 ? r[idx.leverage] : r[5]),
      source: String(idx.source >= 0 ? r[idx.source] : r[6] || "").trim() || "sheet",
    };
    if (!out[strategyId]) out[strategyId] = [];
    out[strategyId].push(row);
  }
  return out;
}

function mergeByStrategy(a, b) {
  const ids = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
  const out = {};
  ids.forEach(function (id) {
    out[id] = mergeDailyRows(a[id] || [], b[id] || []);
  });
  return out;
}

async function loadDailyApyHistory() {
  const seed = loadSeedFile();
  try {
    const sheets = await withTimeout(getWriteSheets(), 8000, "sheets-auth");
    if (!sheets) return seed;
    await withTimeout(ensureDailySheet(sheets), 8000, "sheets-ensure");
    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_TITLE}'!A:G`,
      }),
      8000,
      "sheets-read",
    );
    return mergeByStrategy(seed, parseSheetRows(res.data.values || []));
  } catch (e) {
    console.warn("[labs-daily-apy] load sheet failed", e && e.message);
    return seed;
  }
}

function flattenHistory(history) {
  const rows = [];
  Object.keys(history || {}).forEach(function (id) {
    (history[id] || []).forEach(function (r) {
      rows.push([
        r.date,
        r.strategyId || id,
        r.apyPct,
        r.fixedApy,
        r.borrowApy,
        r.leverage,
        r.source || "",
      ]);
    });
  });
  rows.sort(function (a, b) {
    if (a[1] === b[1]) return String(a[0]).localeCompare(String(b[0]));
    return String(a[1]).localeCompare(String(b[1]));
  });
  return rows;
}

async function persistDailyApyHistory(history) {
  const sheets = await withTimeout(getWriteSheets(), 8000, "sheets-auth");
  if (!sheets) return false;
  await withTimeout(ensureDailySheet(sheets), 8000, "sheets-ensure");
  const values = [HEADERS].concat(flattenHistory(history));
  await withTimeout(
    sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_TITLE}'!A:G`,
    }),
    8000,
    "sheets-clear",
  );
  await withTimeout(
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_TITLE}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    }),
    8000,
    "sheets-write",
  );
  return true;
}

async function upsertDailySnapshot(strategyId, snapshot) {
  if (!strategyId || !snapshot || !snapshot.date) return loadDailyApyHistory();
  const history = await loadDailyApyHistory();
  const next = Object.assign({}, snapshot, { strategyId });
  history[strategyId] = mergeDailyRows(history[strategyId] || [], [next]);
  try {
    await persistDailyApyHistory(history);
  } catch (e) {
    console.warn("[labs-daily-apy] persist failed", e && e.message);
  }
  return history;
}

module.exports = {
  SHEET_TITLE,
  SPREADSHEET_ID,
  loadSeedFile,
  parseSheetRows,
  mergeByStrategy,
  loadDailyApyHistory,
  persistDailyApyHistory,
  upsertDailySnapshot,
};
