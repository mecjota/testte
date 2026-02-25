const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const PDFDocument = require('pdfkit');
const { scrapeTables, parseUploadedFiles } = require('./src/data-ingestion');
const { analyze } = require('./src/analysis');
const { createAnalysis, getAnalysis } = require('./src/db');

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });

const upload = multer({ dest: 'uploads/' });

app.use(express.json({ limit: '2mb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', upload.array('files', 5), async (req, res) => {
  const { portalUrl, selectedModules } = req.body;
  const modules = typeof selectedModules === 'string' ? JSON.parse(selectedModules) : selectedModules || [];

  try {
    let sourceRecords = [];
    const notes = [];

    if (portalUrl) {
      const scraped = await scrapeTables(portalUrl);
      sourceRecords = scraped.records;
      notes.push(...scraped.notes);
    }

    if (!sourceRecords.length && req.files?.length) {
      const uploaded = parseUploadedFiles(req.files);
      sourceRecords = uploaded.records;
      notes.push(...uploaded.notes);
    }

    if (!sourceRecords.length) {
      return res.status(400).json({
        error: 'Não foi possível obter dados automaticamente. Faça upload de CSV/Excel público para continuar.',
        notes
      });
    }

    const result = analyze(sourceRecords);
    const id = createAnalysis({ portalUrl, selectedModules: modules, notes, result });

    return res.json({ analysisId: id, notes, ...result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Erro na análise', error);
    return res.status(500).json({ error: 'Erro interno ao processar a análise.' });
  } finally {
    (req.files || []).forEach((file) => fs.unlink(file.path, () => {}));
  }
});

app.get('/api/analysis/:id', (req, res) => {
  const data = getAnalysis(req.params.id);
  if (!data) return res.status(404).json({ error: 'Análise não encontrada.' });
  return res.json(data);
});

app.get('/api/report/:id.pdf', (req, res) => {
  const data = getAnalysis(req.params.id);
  if (!data) return res.status(404).send('Análise não encontrada.');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=relatorio-analise-${data.id}.pdf`);

  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(18).text('Relatório de Fiscalização Cidadã (MVP)');
  doc.moveDown();
  doc.fontSize(12).text(`Análise #${data.id} - ${new Date(data.createdAt).toLocaleString('pt-BR')}`);
  doc.text(`Portal: ${data.portalUrl || 'Upload manual'}`);
  doc.moveDown();
  doc.text('Resumo em linguagem simples:');
  doc.text(data.result.summary);
  doc.moveDown();
  doc.text('Alertas estatísticos:');
  data.result.alerts.forEach((alert, idx) => {
    doc.text(`${idx + 1}. [${alert.classificacao}] ${alert.titulo}`);
    doc.text(`   ${alert.descricao}`);
  });
  doc.moveDown();
  doc.text(data.result.disclaimer);
  doc.end();
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor iniciado em http://localhost:${port}`);
});
