const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Garante que o diretório de uploads existe
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'leads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, nome);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, PNG, WEBP, GIF).'));
    }
  },
});

// ── GET /api/leads/:id/imagens ──────────────────────────
router.get('/:id/imagens', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT li.*, u.nome AS enviado_por
       FROM lead_imagens li
       LEFT JOIN usuarios u ON u.id = li.uploaded_by
       WHERE li.lead_id = $1
       ORDER BY li.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar imagens.' });
  }
});

// ── POST /api/leads/:id/imagens ─────────────────────────
router.post('/:id/imagens', upload.single('imagem'), async (req, res) => {
  const { id } = req.params;
  const { descricao } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
  }

  const caminho = `/uploads/leads/${req.file.filename}`;

  try {
    const { rows } = await pool.query(
      `INSERT INTO lead_imagens (lead_id, nome_arquivo, caminho, mime_type, tamanho_bytes, descricao, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.file.originalname, caminho, req.file.mimetype, req.file.size, descricao || null, req.usuario?.id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // Remove arquivo se houve erro no banco
    fs.unlink(req.file.path, () => {});
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar imagem.' });
  }
});

// ── DELETE /api/leads/:id/imagens/:imagemId ─────────────
router.delete('/:id/imagens/:imagemId', async (req, res) => {
  const { id, imagemId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM lead_imagens WHERE id = $1 AND lead_id = $2',
      [imagemId, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Imagem não encontrada.' });

    const filePath = path.join(__dirname, '..', '..', rows[0].caminho);
    fs.unlink(filePath, () => {});

    await pool.query('DELETE FROM lead_imagens WHERE id = $1', [imagemId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover imagem.' });
  }
});

module.exports = router;
