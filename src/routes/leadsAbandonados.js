const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/leads-abandonados
 * Registra uma etapa abandonada no simulador (sem autenticação - chamado pelo site)
 */
router.post('/', async (req, res) => {
  const { nome, whatsapp, etapaAlcancada } = req.body;

  if (!etapaAlcancada) {
    return res.status(400).json({ error: 'Etapa alcançada é obrigatória.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO leads_abandonados (nome, whatsapp, etapa_alcancada, ultima_atividade)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [nome || null, whatsapp || null, etapaAlcancada]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao registrar lead abandonado:', err);
    res.status(500).json({ error: 'Erro ao registrar abandono.' });
  }
});

/**
 * GET /api/leads-abandonados
 * Lista leads abandonados (requer autenticação - CRM)
 */
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM leads_abandonados');
    const result = await pool.query(
      'SELECT * FROM leads_abandonados ORDER BY ultima_atividade DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erro ao listar leads abandonados:', err);
    res.status(500).json({ error: 'Erro ao buscar leads abandonados.' });
  }
});

module.exports = router;
