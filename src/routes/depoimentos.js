const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'depoimentos');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Apenas JPEG, PNG ou WEBP.'));
  },
}).fields([
  { name: 'foto',       maxCount: 1 },
  { name: 'fotos_obra', maxCount: 5 },
]);

function getFile(req, campo) {
  return req.files?.[campo]?.[0] ?? null;
}

function getFiles(req, campo) {
  return req.files?.[campo] ?? [];
}

function removerArquivo(caminho) {
  if (!caminho) return;
  fs.unlink(path.join(__dirname, '..', '..', caminho), () => {});
}

// ── GET /api/depoimentos  (público) ──────────────────────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM depoimentos WHERE ativo = true ORDER BY ordem ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar depoimentos.' });
  }
});

// ── GET /api/depoimentos/todos  (protegido — CRM) ────────
router.get('/todos', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM depoimentos ORDER BY ordem ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar depoimentos.' });
  }
});

// ── POST /api/depoimentos  (protegido) ───────────────────
router.post('/', authMiddleware, upload, async (req, res) => {
  const { nome, cargo, texto, economia, avaliacao, ordem } = req.body;

  if (!nome || !texto) {
    getFile(req, 'foto')?.path && removerArquivo(getFile(req, 'foto')?.filename);
    return res.status(400).json({ error: 'Nome e texto são obrigatórios.' });
  }

  const fotoFile       = getFile(req, 'foto');
  const fotosObraFiles = getFiles(req, 'fotos_obra');
  const foto       = fotoFile ? `/uploads/depoimentos/${fotoFile.filename}` : null;
  const fotos_obra = fotosObraFiles.map(f => `/uploads/depoimentos/${f.filename}`);

  try {
    const { rows } = await pool.query(
      `INSERT INTO depoimentos (nome, cargo, texto, economia, avaliacao, foto, fotos_obra, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nome, cargo || null, texto, economia || null, parseInt(avaliacao) || 5, foto, fotos_obra, parseInt(ordem) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    removerArquivo(foto);
    fotos_obra.forEach(removerArquivo);
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar depoimento.' });
  }
});

// ── PUT /api/depoimentos/:id  (protegido) ────────────────
router.put('/:id', authMiddleware, upload, async (req, res) => {
  const { id } = req.params;
  const { nome, cargo, texto, economia, avaliacao, ordem, ativo } = req.body;

  try {
    const { rows: atual } = await pool.query('SELECT * FROM depoimentos WHERE id = $1', [id]);
    if (!atual[0]) return res.status(404).json({ error: 'Não encontrado.' });

    const fotoFile       = getFile(req, 'foto');
    const fotosObraFiles = getFiles(req, 'fotos_obra');

    let foto       = atual[0].foto;
    let fotos_obra = atual[0].fotos_obra ?? [];

    if (fotoFile) {
      removerArquivo(foto);
      foto = `/uploads/depoimentos/${fotoFile.filename}`;
    }
    if (fotosObraFiles.length > 0) {
      // Adiciona novas fotos ao array existente (máx 5 no total)
      const novas = fotosObraFiles.map(f => `/uploads/depoimentos/${f.filename}`);
      fotos_obra = [...fotos_obra, ...novas].slice(0, 5);
    }

    // remover_fotos_obra: índices enviados pelo cliente para remover
    if (req.body.remover_fotos_obra) {
      const indices = JSON.parse(req.body.remover_fotos_obra);
      indices.sort((a, b) => b - a); // do maior para menor para não deslocar índices
      indices.forEach(i => {
        removerArquivo(fotos_obra[i]);
        fotos_obra.splice(i, 1);
      });
    }

    const { rows } = await pool.query(
      `UPDATE depoimentos SET
        nome       = COALESCE($1,  nome),
        cargo      = COALESCE($2,  cargo),
        texto      = COALESCE($3,  texto),
        economia   = COALESCE($4,  economia),
        avaliacao  = COALESCE($5,  avaliacao),
        foto       = $6,
        fotos_obra = $7,
        ordem      = COALESCE($8,  ordem),
        ativo      = COALESCE($9,  ativo),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        nome, cargo, texto, economia,
        avaliacao ? parseInt(avaliacao) : null,
        foto, fotos_obra,
        ordem ? parseInt(ordem) : null,
        ativo !== undefined ? ativo === 'true' : null,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

// ── DELETE /api/depoimentos/:id  (protegido) ─────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM depoimentos WHERE id=$1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    removerArquivo(rows[0].foto);
    removerArquivo(rows[0].foto_obra);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover.' });
  }
});

module.exports = router;
