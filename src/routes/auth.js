const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Autentica o usuário e retorna um token JWT
 */
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email]
    );

    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
      },
      process.env.JWT_SECRET || 'solar_crm_secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        avatar: usuario.avatar,
      },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, cargo, avatar FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

/**
 * POST /api/auth/seed
 * Cria usuários padrão com senhas hasheadas (use apenas em desenvolvimento)
 */
router.post('/seed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Não disponível em produção.' });
  }
  try {
    const adminHash = await bcrypt.hash('admin123', 10);
    const marcosHash = await bcrypt.hash('marcos123', 10);

    await pool.query(`
      INSERT INTO usuarios (nome, email, senha_hash, cargo) VALUES
        ('Admin', 'admin@solar.com', $1, 'Gerente'),
        ('Marcos', 'marcos@solar.com', $2, 'Consultor')
      ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash
    `, [adminHash, marcosHash]);

    res.json({ message: 'Usuários padrão criados/atualizados com sucesso.' });
  } catch (err) {
    console.error('Erro no seed:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
