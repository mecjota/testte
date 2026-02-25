const Database = require('better-sqlite3');

const db = new Database('data/app.db');

db.exec(`
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  portal_url TEXT,
  selected_modules TEXT,
  notes TEXT,
  result_json TEXT NOT NULL
);
`);

function createAnalysis({ portalUrl, selectedModules, notes, result }) {
  const stmt = db.prepare(`
    INSERT INTO analyses (created_at, portal_url, selected_modules, notes, result_json)
    VALUES (@created_at, @portal_url, @selected_modules, @notes, @result_json)
  `);
  const info = stmt.run({
    created_at: new Date().toISOString(),
    portal_url: portalUrl || null,
    selected_modules: JSON.stringify(selectedModules || []),
    notes: JSON.stringify(notes || []),
    result_json: JSON.stringify(result)
  });
  return info.lastInsertRowid;
}

function getAnalysis(id) {
  const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    portalUrl: row.portal_url,
    selectedModules: JSON.parse(row.selected_modules || '[]'),
    notes: JSON.parse(row.notes || '[]'),
    result: JSON.parse(row.result_json)
  };
}

module.exports = { createAnalysis, getAnalysis };
