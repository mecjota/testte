function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split('/');
    return `${y}-${m}-${d}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeRecord(record) {
  return {
    tipo: (record.tipo || record.category || '').toString().toLowerCase(),
    valor: toNumber(record.valor || record.value || record.total || record.salario),
    data: normalizeDate(record.data || record.date || record.competencia),
    fornecedor: (record.fornecedor || record.supplier || '').toString().trim(),
    documento: (record.cnpj || record.cpf || record.documento || '').toString().replace(/[^\d]/g, ''),
    cargo: (record.cargo || '').toString().trim(),
    orgao: (record.orgao || record.órgão || '').toString().trim(),
    objeto: (record.objeto || record.descricao || record.description || '').toString().trim(),
    servico: (record.servico || record.serviço || record.tipoServico || '').toString().trim()
  };
}

function average(values) {
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

function stdDev(values, mean) {
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length || 1);
  return Math.sqrt(variance);
}

function monthDiff(a, b) {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24));
}

function classifyAlert(tipo, titulo, descricao, gravidade = 'médio') {
  return {
    tipo,
    titulo,
    descricao,
    classificacao: 'Indício estatístico',
    gravidade
  };
}

function analyze(records, options = {}) {
  const normalized = records.map(normalizeRecord).filter((r) => r.valor !== null || r.fornecedor || r.cargo);
  const alerts = [];

  const byService = {};
  for (const row of normalized) {
    const key = row.servico || row.objeto || row.tipo || 'não classificado';
    if (!byService[key]) byService[key] = [];
    if (row.valor !== null) byService[key].push(row.valor);
  }

  Object.entries(byService).forEach(([service, values]) => {
    if (values.length < 5) return;
    const mean = average(values);
    const sd = stdDev(values, mean);
    const outliers = values.filter((v) => sd > 0 && Math.abs((v - mean) / sd) >= 2.5);
    if (outliers.length) {
      alerts.push(
        classifyAlert(
          'Outlier',
          `Valores atípicos em ${service}`,
          `${outliers.length} registro(s) ficaram acima/abaixo de 2.5 desvios-padrão da média deste grupo.`
        )
      );
    }
  });

  const bySupplier = {};
  normalized.forEach((row) => {
    if (!row.fornecedor || !row.data) return;
    if (!bySupplier[row.fornecedor]) bySupplier[row.fornecedor] = [];
    bySupplier[row.fornecedor].push(row);
  });

  Object.entries(bySupplier).forEach(([supplier, rows]) => {
    if (rows.length < 3) return;
    const sorted = rows.sort((a, b) => new Date(a.data) - new Date(b.data));
    let rolling = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      if (monthDiff(sorted[i].data, sorted[i - 1].data) <= 90) rolling += 1;
      else rolling = 1;
      if (rolling >= (options.recurrenceThreshold || 3)) {
        alerts.push(
          classifyAlert(
            'Recorrência',
            `Recorrência de fornecedor: ${supplier}`,
            `${rolling} contratações em janela de até 90 dias. Verifique justificativas e competitividade.`
          )
        );
        break;
      }
    }
  });

  const limiteFracionamento = options.fragmentLimit || 100000;
  const byObject = {};
  normalized.forEach((row) => {
    if (!row.objeto || row.valor === null || !row.data) return;
    const key = `${row.objeto.slice(0, 40)}::${row.orgao}`;
    if (!byObject[key]) byObject[key] = [];
    byObject[key].push(row);
  });

  Object.entries(byObject).forEach(([key, rows]) => {
    const nearLimit = rows.filter((r) => r.valor > limiteFracionamento * 0.8 && r.valor < limiteFracionamento);
    if (nearLimit.length >= 3) {
      const sorted = nearLimit.sort((a, b) => new Date(a.data) - new Date(b.data));
      if (monthDiff(sorted[0].data, sorted[sorted.length - 1].data) <= 90) {
        alerts.push(
          classifyAlert(
            'Fracionamento',
            `Possível fracionamento em ${key.split('::')[0]}`,
            `${nearLimit.length} contratos similares e próximos ao limite (${limiteFracionamento}) em curto período.`
          )
        );
      }
    }
  });

  const salaryGroups = {};
  normalized.forEach((row) => {
    if (!row.cargo || !row.orgao || row.valor === null) return;
    const key = `${row.cargo}::${row.orgao}`;
    if (!salaryGroups[key]) salaryGroups[key] = [];
    salaryGroups[key].push(row.valor);
  });

  Object.entries(salaryGroups).forEach(([key, values]) => {
    if (values.length < 4) return;
    const mean = average(values);
    const high = values.filter((v) => v >= mean * 1.5).length;
    if (high > 0) {
      alerts.push(
        classifyAlert(
          'Salários',
          `Salários acima da média em ${key.replace('::', ' / ')}`,
          `${high} salário(s) acima de 150% da média do mesmo cargo/órgão.`
        )
      );
    }
  });

  const supplierTotals = Object.entries(
    normalized.reduce((acc, row) => {
      if (!row.fornecedor || row.valor === null) return acc;
      acc[row.fornecedor] = (acc[row.fornecedor] || 0) + row.valor;
      return acc;
    }, {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const salaryByRole = Object.entries(
    normalized.reduce((acc, row) => {
      if (!row.cargo || row.valor === null) return acc;
      if (!acc[row.cargo]) acc[row.cargo] = [];
      acc[row.cargo].push(row.valor);
      return acc;
    }, {})
  ).map(([cargo, values]) => ({ cargo, media: Number(average(values).toFixed(2)) }));

  const summary = alerts.length
    ? `Foram encontrados ${alerts.length} indícios estatísticos. Os dados sugerem padrões que merecem verificação documental e contextual.`
    : 'Não foram encontrados padrões estatísticos relevantes com os dados fornecidos.';

  return {
    normalized,
    alerts,
    charts: {
      supplierRanking: supplierTotals,
      salaryDistribution: salaryByRole
    },
    summary,
    disclaimer: 'Resultados são análises estatísticas de dados públicos; não constituem prova.'
  };
}

module.exports = { analyze, normalizeRecord };
