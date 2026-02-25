const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

function mapHeaders(headers, row) {
  const get = (aliases) => {
    const idx = headers.findIndex((h) => aliases.some((a) => h.includes(a)));
    return idx >= 0 ? row[idx] : '';
  };
  return {
    tipo: get(['tipo', 'categoria']),
    valor: get(['valor', 'total', 'salário', 'salario']),
    data: get(['data', 'competência', 'competencia']),
    fornecedor: get(['fornecedor', 'credor', 'empresa']),
    cnpj: get(['cnpj', 'cpf', 'documento']),
    cargo: get(['cargo']),
    orgao: get(['órgão', 'orgao', 'secretaria']),
    objeto: get(['objeto', 'descrição', 'descricao']),
    servico: get(['serviço', 'servico'])
  };
}

async function canScrape(url) {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    const robotsRes = await axios.get(robotsUrl, { timeout: 8000, validateStatus: () => true });
    if (robotsRes.status >= 400) return true;
    const robots = robotsParser(robotsUrl, robotsRes.data);
    return robots.isAllowed(url, 'FiscalizaCidadaBot');
  } catch (error) {
    return false;
  }
}

async function scrapeTables(url) {
  const allowed = await canScrape(url);
  if (!allowed) {
    return { records: [], notes: ['Coleta automática bloqueada por robots.txt ou indisponível.'] };
  }

  const response = await axios.get(url, { timeout: 15000, maxContentLength: 5_000_000 });
  const $ = cheerio.load(response.data);
  const records = [];

  $('table').each((_, table) => {
    const headers = [];
    $(table)
      .find('tr')
      .first()
      .find('th,td')
      .each((__, th) => headers.push($(th).text().trim().toLowerCase()));

    $(table)
      .find('tr')
      .slice(1)
      .each((__, tr) => {
        const row = [];
        $(tr)
          .find('td')
          .each((___, td) => row.push($(td).text().trim()));
        if (row.length) records.push(mapHeaders(headers, row));
      });
  });

  return {
    records,
    notes: records.length ? ['Dados coletados de tabelas HTML públicas.'] : ['Nenhuma tabela compatível encontrada no portal.']
  };
}

function parseCsv(content) {
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  return rows;
}

function parseXlsx(filePath) {
  const workbook = XLSX.readFile(filePath);
  const first = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[first], { defval: '' });
}

function parseUploadedFiles(files = []) {
  const all = [];
  const notes = [];
  files.forEach((file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    try {
      if (ext === '.csv') {
        const content = fs.readFileSync(file.path, 'utf8');
        const rows = parseCsv(content);
        all.push(...rows);
      } else if (ext === '.xlsx' || ext === '.xls') {
        const rows = parseXlsx(file.path);
        all.push(...rows);
      } else {
        notes.push(`Arquivo ignorado (formato não suportado): ${file.originalname}`);
      }
    } catch (error) {
      notes.push(`Falha ao processar ${file.originalname}: ${error.message}`);
    }
  });
  if (all.length) notes.push('Dados carregados por upload de CSV/Excel.');
  return { records: all, notes };
}

module.exports = { scrapeTables, parseUploadedFiles };
