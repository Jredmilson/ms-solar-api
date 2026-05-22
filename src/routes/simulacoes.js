const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/simulacoes/pvgis  (rota legada — redireciona para NASA POWER)
 * Mantida para compatibilidade com builds antigos do frontend
 */
router.get('/pvgis', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat e lon são obrigatórios.' });

  const params = new URLSearchParams({
    parameters: 'ALLSKY_SFC_SW_DWN',
    community:  'RE',
    longitude:  parseFloat(lon).toFixed(4),
    latitude:   parseFloat(lat).toFixed(4),
    format:     'JSON',
  });

  try {
    const nasaRes = await fetch(
      `https://power.larc.nasa.gov/api/temporal/climatology/point?${params}`,
      { headers: { 'User-Agent': 'SolarCRM/1.0' } }
    );
    if (!nasaRes.ok) return res.status(502).json({ error: 'NASA POWER indisponível.' });
    const data = await nasaRes.json();
    res.json(data);
  } catch (err) {
    console.error('Erro legacy pvgis→nasa:', err);
    res.status(502).json({ error: 'Erro ao consultar NASA POWER.' });
  }
});

/**
 * GET /api/simulacoes/nasa-power
 * Proxy server-side para a NASA POWER API — dados climatológicos de 22 anos
 * Parâmetro ALLSKY_SFC_SW_DWN = irradiância global horizontal em kWh/m²/dia
 */
router.get('/nasa-power', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat e lon são obrigatórios.' });
  }

  const params = new URLSearchParams({
    parameters: 'ALLSKY_SFC_SW_DWN',
    community:  'RE',
    longitude:  parseFloat(lon).toFixed(4),
    latitude:   parseFloat(lat).toFixed(4),
    format:     'JSON',
  });

  try {
    const nasaRes = await fetch(
      `https://power.larc.nasa.gov/api/temporal/climatology/point?${params}`,
      { headers: { 'User-Agent': 'SolarCRM/1.0' } }
    );
    if (!nasaRes.ok) {
      return res.status(502).json({ error: 'NASA POWER indisponível.' });
    }
    const data = await nasaRes.json();
    res.json(data);
  } catch (err) {
    console.error('Erro ao consultar NASA POWER:', err);
    res.status(502).json({ error: 'Erro ao consultar NASA POWER.' });
  }
});

/**
 * POST /api/simulacoes
 * Registra uma simulação feita no site público (sem autenticação)
 * Também cria automaticamente o lead associado
 */
router.post('/', async (req, res) => {
  const {
    nome, whatsapp, valorConta, cidade, tipoImovel,
    // Campos do cálculo real (enviados pelo frontend após cálculo com PVGIS)
    economiaAnualReal, potenciaSistemaReal, paineisSolaresReal
  } = req.body;

  if (!nome || !valorConta) {
    return res.status(400).json({ error: 'Nome e valor da conta são obrigatórios.' });
  }

  // Usa valores reais do frontend se disponíveis, senão faz estimativa simples
  const economiaAnual = economiaAnualReal || (parseFloat(valorConta) * 0.95 * 12);
  const potenciaSistema = potenciaSistemaReal || (parseFloat(valorConta) / 100);
  const paineisSolares = paineisSolaresReal || Math.ceil(potenciaSistema / 0.40);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Criar ou atualizar o lead
    const leadResult = await client.query(
      `INSERT INTO leads (nome, whatsapp, cidade, valor_conta, tipo_imovel, origem, status)
       VALUES ($1, $2, $3, $4, $5, 'simulacao', 'novo')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [nome, whatsapp || null, cidade || null, valorConta, tipoImovel || 'residencial']
    );

    const leadId = leadResult.rows[0]?.id || null;

    // 2. Registrar a simulação
    const simResult = await client.query(
      `INSERT INTO simulacoes (lead_id, nome, whatsapp, valor_conta, cidade, tipo_imovel, economia_anual, potencia_sistema, paineis_solares)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [leadId, nome, whatsapp || null, valorConta, cidade || null, tipoImovel || 'residencial',
       economiaAnual.toFixed(2), potenciaSistema.toFixed(2), paineisSolares]
    );

    await client.query('COMMIT');

    res.status(201).json({
      simulacao: simResult.rows[0],
      resultado: {
        economiaAnual: parseFloat(economiaAnual.toFixed(2)),
        economiasMensal: parseFloat((economiaAnual / 12).toFixed(2)),
        potenciaSistema: parseFloat(potenciaSistema.toFixed(2)),
        paineisSolares,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar simulação:', err);
    res.status(500).json({ error: 'Erro ao registrar simulação.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/simulacoes
 * Lista simulações (requer autenticação - CRM)
 */
router.get('/', authMiddleware, async (req, res) => {
  const { search, date, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(LOWER(nome) LIKE $${idx} OR LOWER(cidade) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }
  if (date) {
    conditions.push(`DATE(created_at) = $${idx++}`);
    params.push(date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM simulacoes ${where}`, params);
    const result = await pool.query(
      `SELECT * FROM simulacoes ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erro ao listar simulações:', err);
    res.status(500).json({ error: 'Erro ao buscar simulações.' });
  }
});

module.exports = router;
