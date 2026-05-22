require('dotenv').config();
const express = require('express');
const cors = require('cors');

const path = require('path');
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const leadImagensRoutes = require('./routes/leadImagens');
const depoimentosRoutes = require('./routes/depoimentos');
const simulacoesRoutes = require('./routes/simulacoes');
const whatsappClicksRoutes = require('./routes/whatsappClicks');
const leadsAbandonadosRoutes = require('./routes/leadsAbandonados');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: mobile, curl, Railway health checks)
    if (!origin) return callback(null, true);
    // Permite qualquer subdomínio do Vercel
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS: origem não permitida'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROTAS
// ============================================
// Serve imagens de instalações como arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/leads', leadImagensRoutes);
app.use('/api/depoimentos', depoimentosRoutes);
app.use('/api/simulacoes', simulacoesRoutes);
app.use('/api/whatsapp-clicks', whatsappClicksRoutes);
app.use('/api/leads-abandonados', leadsAbandonadosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ============================================
// INICIALIZAÇÃO
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Backend Solar CRM rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Banco: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'solar_crm'}`);
  console.log(`\n📋 Rotas disponíveis:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   GET  /api/leads`);
  console.log(`   POST /api/leads`);
  console.log(`   GET  /api/leads/:id`);
  console.log(`   PUT  /api/leads/:id`);
  console.log(`   PATCH /api/leads/:id/status`);
  console.log(`   DELETE /api/leads/:id`);
  console.log(`   POST /api/simulacoes`);
  console.log(`   GET  /api/simulacoes`);
  console.log(`   POST /api/whatsapp-clicks`);
  console.log(`   GET  /api/whatsapp-clicks`);
  console.log(`   POST /api/leads-abandonados`);
  console.log(`   GET  /api/leads-abandonados`);
  console.log(`   GET  /api/dashboard/kpis`);
  console.log(`   GET  /api/dashboard/leads-diarios`);
  console.log(`   GET  /api/dashboard/origem-leads`);
  console.log(`   GET  /api/dashboard/comparativo-origem`);
  console.log(`   GET  /api/dashboard/ultimos-leads`);
  console.log(`   GET  /api/dashboard/relatorios`);
  console.log(`   GET  /api/health\n`);
});

module.exports = app;
