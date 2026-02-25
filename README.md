# Fiscaliza Cidadã (MVP)

Aplicativo web responsivo para fiscalização cidadã com base em análise estatística de dados públicos de Portais da Transparência.

## Funcionalidades
- Home com apresentação do projeto.
- Página de análise com URL do portal, seleção de módulos e fallback por upload de CSV/Excel.
- Página de resultados com alertas estatísticos, gráficos e exportação de PDF.
- Histórico de análises em banco SQLite.
- Avisos legais e disclaimer automático.

## Regras e ética implementadas
- Respeito a `robots.txt` antes de scraping.
- Coleta somente de tabelas públicas HTML (quando permitido).
- Fallback de upload manual para dados públicos.
- Rate limit na API e tratamento básico de erros/logs.
- Mensagens sem acusações: apenas “Indício estatístico”.

## Stack
- Front-end: HTML/CSS/JS + Chart.js.
- Back-end: Node.js + Express.
- Banco: SQLite (`better-sqlite3`).
- Relatórios: PDFKit.

## Como rodar localmente
```bash
npm install
npm start
```
Acesse `http://localhost:3000`.

## Teste rápido com seed
```bash
npm test
```

## Deploy (MVP)
### Opção 1: Docker
1. Crie o `Dockerfile` abaixo:
```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```
2. Build e run:
```bash
docker build -t fiscaliza-cidada .
docker run -p 3000:3000 fiscaliza-cidada
```

### Opção 2: VM/Servidor Linux
```bash
git clone <repo>
cd testte
npm install
PORT=3000 npm start
```
Use Nginx/Caddy como reverse proxy para HTTPS.

## Seeds de dados
Arquivo de exemplo: `seeds/contratos_salarios_exemplo.csv`.

## Aviso legal
Resultados são análises estatísticas de dados públicos; não constituem prova.
