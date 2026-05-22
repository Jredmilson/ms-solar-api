const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/whatsapp-clicks
 * Registra um clique no botão WhatsApp (sem autenticação - chamado pelo site)
 */
router.post('/', async (req, res) => {
  const { origemPagina, dispositivo } = req.body;

  if (!origemPagina) {
    return res.status(400).json({ error: 'Origem da página é obrigatória.' });
  }

  const dispositivoValido = ['mobile', 'desktop'].includes(dispositivo) ? dispositivo : 'desktop';

  try {
    const result = await pool.query(
      `INSERT INTO whatsapp_clicks (origem_pagina, dispositivo) VALUES ($1, $2) RETURNING *`,
      [origemPagina, dispositivoValido]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao registrar clique WhatsApp:', err);
    res.status(500).json({ error: 'Erro ao registrar clique.' });
  }
});

/**
 * GET /api/whatsapp-clicks
 * Lista cliques no WhatsApp (requer autenticação - CRM)
 */
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM whatsapp_clicks');
    const result = await pool.query(
      'SELECT * FROM whatsapp_clicks ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erro ao listar cliques:', err);
    res.status(500).json({ error: 'Erro ao buscar cliques.' });
  }
});

module.exports = router;
