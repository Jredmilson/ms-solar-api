const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/dashboard/kpis
 * Retorna KPIs principais para o Dashboard
 */
router.get('/kpis', async (req, res) => {
  try {
    const [leadsTotal, simulacoesTotal, whatsappTotal, leadsHoje] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM leads'),
      pool.query('SELECT COUNT(*) FROM simulacoes'),
      pool.query('SELECT COUNT(*) FROM whatsapp_clicks'),
      pool.query("SELECT COUNT(*) FROM leads WHERE DATE(created_at) = CURRENT_DATE"),
    ]);

    res.json({
      totalLeads: parseInt(leadsTotal.rows[0].count),
      totalSimulacoes: parseInt(simulacoesTotal.rows[0].count),
      totalWhatsappClicks: parseInt(whatsappTotal.rows[0].count),
      leadsHoje: parseInt(leadsHoje.rows[0].count),
    });
  } catch (err) {
    console.error('Erro ao buscar KPIs:', err);
    res.status(500).json({ error: 'Erro ao buscar KPIs.' });
  }
});

/**
 * GET /api/dashboard/leads-diarios
 * Retorna leads por dia nos últimos 7 dias
 */
router.get('/leads-diarios', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE(created_at), 'DD/MM') AS data,
        COUNT(*) AS leads
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);
    res.json(result.rows.map(r => ({ data: r.data, leads: parseInt(r.leads) })));
  } catch (err) {
    console.error('Erro ao buscar leads diários:', err);
    res.status(500).json({ error: 'Erro ao buscar leads diários.' });
  }
});

/**
 * GET /api/dashboard/origem-leads
 * Retorna distribuição de leads por origem
 */
router.get('/origem-leads', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT origem, COUNT(*) AS quantidade
      FROM leads
      GROUP BY origem
    `);

    const data = result.rows.map(r => ({
      name: r.origem === 'simulacao' ? 'Simulação' : 'WhatsApp',
      value: parseInt(r.quantidade),
      color: r.origem === 'simulacao' ? '#FDB813' : '#25D366',
    }));

    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar origem de leads:', err);
    res.status(500).json({ error: 'Erro ao buscar origem.' });
  }
});

/**
 * GET /api/dashboard/comparativo-origem
 * Retorna comparativo de origem para gráfico de barras
 */
router.get('/comparativo-origem', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        CASE WHEN origem = 'simulacao' THEN 'Simulações' ELSE 'WhatsApp' END AS tipo,
        COUNT(*) AS quantidade
      FROM leads
      GROUP BY origem
    `);
    res.json(result.rows.map(r => ({ tipo: r.tipo, quantidade: parseInt(r.quantidade) })));
  } catch (err) {
    console.error('Erro ao buscar comparativo:', err);
    res.status(500).json({ error: 'Erro ao buscar comparativo.' });
  }
});

/**
 * GET /api/dashboard/ultimos-leads
 * Retorna os últimos 5 leads captados
 */
router.get('/ultimos-leads', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leads ORDER BY created_at DESC LIMIT 5'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar últimos leads:', err);
    res.status(500).json({ error: 'Erro ao buscar últimos leads.' });
  }
});

/**
 * GET /api/dashboard/relatorios
 * Retorna dados consolidados para a tela de relatórios
 */
router.get('/relatorios', async (req, res) => {
  try {
    const [statusDist, origemDist, conversaoPorOrigem, leadsPorSemana] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) AS quantidade
        FROM leads GROUP BY status
      `),
      pool.query(`
        SELECT origem, COUNT(*) AS quantidade
        FROM leads GROUP BY origem
      `),
      pool.query(`
        SELECT
          origem,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'convertido') AS convertidos,
          ROUND(COUNT(*) FILTER (WHERE status = 'convertido') * 100.0 / NULLIF(COUNT(*), 0), 1) AS taxa
        FROM leads
        GROUP BY origem
      `),
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('week', created_at), 'DD/MM') AS semana,
          COUNT(*) AS leads
        FROM leads
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at) ASC
      `),
    ]);

    res.json({
      distribuicaoStatus: statusDist.rows,
      distribuicaoOrigem: origemDist.rows,
      conversaoPorOrigem: conversaoPorOrigem.rows,
      leadsPorSemana: leadsPorSemana.rows,
    });
  } catch (err) {
    console.error('Erro ao buscar relatórios:', err);
    res.status(500).json({ error: 'Erro ao buscar relatórios.' });
  }
});

module.exports = router;
