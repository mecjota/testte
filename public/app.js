const views = {
  home: document.querySelector('#home'),
  analysis: document.querySelector('#analysis'),
  results: document.querySelector('#results')
};

const startBtn = document.querySelector('#startBtn');
const runBtn = document.querySelector('#runBtn');
const newBtn = document.querySelector('#newBtn');

const portalUrl = document.querySelector('#portalUrl');
const filesInput = document.querySelector('#files');
const status = document.querySelector('#status');

const summaryEl = document.querySelector('#summary');
const alertsEl = document.querySelector('#alerts');
const notesEl = document.querySelector('#notes');
const disclaimerEl = document.querySelector('#disclaimer');
const pdfLink = document.querySelector('#pdfLink');

let supplierChart;
let salaryChart;

function show(view) {
  Object.values(views).forEach((el) => el.classList.remove('active'));
  views[view].classList.add('active');
}

startBtn.addEventListener('click', () => show('analysis'));
newBtn.addEventListener('click', () => show('analysis'));

function checkedModules() {
  return [...document.querySelectorAll('fieldset input[type="checkbox"]')]
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
}

function renderCharts(charts) {
  if (supplierChart) supplierChart.destroy();
  if (salaryChart) salaryChart.destroy();

  supplierChart = new Chart(document.querySelector('#supplierChart'), {
    type: 'bar',
    data: {
      labels: charts.supplierRanking.map((item) => item.label),
      datasets: [{ label: 'Valor total (R$)', data: charts.supplierRanking.map((item) => item.value) }]
    }
  });

  salaryChart = new Chart(document.querySelector('#salaryChart'), {
    type: 'bar',
    data: {
      labels: charts.salaryDistribution.map((item) => item.cargo),
      datasets: [{ label: 'Média salarial (R$)', data: charts.salaryDistribution.map((item) => item.media) }]
    }
  });
}

function renderResult(data) {
  summaryEl.textContent = data.summary;
  disclaimerEl.textContent = data.disclaimer;
  alertsEl.innerHTML = data.alerts.length
    ? data.alerts
        .map(
          (a) =>
            `<li><strong>${a.classificacao} - ${a.titulo}</strong><br/><span>${a.descricao}</span></li>`
        )
        .join('')
    : '<li>Nenhum alerta estatístico relevante identificado.</li>';
  notesEl.innerHTML = (data.notes || []).map((n) => `<li>${n}</li>`).join('');
  renderCharts(data.charts);
  pdfLink.href = `/api/report/${data.analysisId}.pdf`;
  show('results');
}

runBtn.addEventListener('click', async () => {
  status.textContent = 'Processando análise...';
  const form = new FormData();
  if (portalUrl.value) form.append('portalUrl', portalUrl.value);
  form.append('selectedModules', JSON.stringify(checkedModules()));
  [...filesInput.files].forEach((file) => form.append('files', file));

  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: form });
    const json = await response.json();
    if (!response.ok) {
      status.textContent = json.error || 'Falha ao processar análise';
      return;
    }
    status.textContent = '';
    renderResult(json);
  } catch (error) {
    status.textContent = `Erro de rede: ${error.message}`;
  }
});
