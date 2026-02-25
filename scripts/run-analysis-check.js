const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { analyze } = require('../src/analysis');

const csv = fs.readFileSync(path.join(__dirname, '..', 'seeds', 'contratos_salarios_exemplo.csv'), 'utf8');
const records = parse(csv, { columns: true, skip_empty_lines: true });
const result = analyze(records);

if (!result.alerts.length) {
  throw new Error('Esperado ao menos um alerta no seed de exemplo.');
}

console.log(`OK: ${result.alerts.length} alertas gerados no seed de teste.`);
