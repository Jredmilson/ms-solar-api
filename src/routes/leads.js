const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Todas as rotas de leads requerem autenticação
router.use(authMiddleware);

/**
 * GET /api/leads
 * Lista todos os leads com filtros opcionais
 * Query params: status, origem, search, page, limit
 */
router.get('/', async (req, res) => {
  const { status, origem, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];
  let idx = 1;

  if (status && status !== 'todos') {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (origem && origem !== 'todos') {
    conditions.push(`origem = $${idx++}`);
    params.push(origem);
  }
  if (search) {
    conditions.push(`(LOWER(nome) LIKE $${idx} OR LOWER(cidade) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leads ${where}`,
      params
    );

    const result = await pool.query(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erro ao listar leads:', err);
    res.status(500).json({ error: 'Erro ao buscar leads.' });
  }
});

/**
 * GET /api/leads/:id
 * Retorna um lead específico
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar lead:', err);
    res.status(500).json({ error: 'Erro ao buscar lead.' });
  }
});

/**
 * POST /api/leads
 * Cria um novo lead (usado pelo site público e pelo CRM)
 */
router.post('/', async (req, res) => {
  const { nome, whatsapp, cidade, valorConta, tipoImovel, origem, status, notes } = req.body;

  if (!nome || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO leads (nome, whatsapp, cidade, valor_conta, tipo_imovel, origem, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        nome,
        whatsapp,
        cidade || null,
        valorConta || null,
        tipoImovel || 'residencial',
        origem || 'whatsapp',
        status || 'novo',
        notes || '',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar lead:', err);
    res.status(500).json({ error: 'Erro ao criar lead.' });
  }
});

/**
 * PUT /api/leads/:id
 * Atualiza um lead existente
 */
router.put('/:id', async (req, res) => {
  const { nome, whatsapp, cidade, valorConta, tipoImovel, origem, status, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE leads
       SET nome = COALESCE($1, nome),
           whatsapp = COALESCE($2, whatsapp),
           cidade = COALESCE($3, cidade),
           valor_conta = COALESCE($4, valor_conta),
           tipo_imovel = COALESCE($5, tipo_imovel),
           origem = COALESCE($6, origem),
           status = COALESCE($7, status),
           notes = COALESCE($8, notes),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [nome, whatsapp, cidade, valorConta, tipoImovel, origem, status, notes, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar lead:', err);
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
});

/**
 * PATCH /api/leads/:id/status
 * Atualiza apenas o status do lead
 */
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['novo', 'contatado', 'convertido'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const result = await pool.query(
      `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

/**
 * DELETE /api/leads/:id
 * Remove um lead
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json({ message: 'Lead removido com sucesso.', id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao remover lead:', err);
    res.status(500).json({ error: 'Erro ao remover lead.' });
  }
});

module.exports = router;
