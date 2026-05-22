-- ============================================
-- SCHEMA DO CRM DE ENERGIA SOLAR
-- Execute este script no seu banco PostgreSQL
-- ============================================

-- Criar banco de dados (execute separadamente se necessário)
-- CREATE DATABASE solar_crm;

-- ============================================
-- TABELA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  cargo VARCHAR(80),
  avatar VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: leads
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  cidade VARCHAR(100),
  valor_conta NUMERIC(10, 2),
  tipo_imovel VARCHAR(30) CHECK (tipo_imovel IN ('residencial', 'comercial', 'industrial', 'rural')),
  origem VARCHAR(30) CHECK (origem IN ('simulacao', 'whatsapp')),
  status VARCHAR(30) DEFAULT 'novo' CHECK (status IN ('novo', 'contatado', 'convertido')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: simulacoes
-- ============================================
CREATE TABLE IF NOT EXISTS simulacoes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  nome VARCHAR(150) NOT NULL,
  whatsapp VARCHAR(20),
  valor_conta NUMERIC(10, 2) NOT NULL,
  cidade VARCHAR(100),
  tipo_imovel VARCHAR(30) DEFAULT 'residencial',
  economia_anual NUMERIC(12, 2),
  potencia_sistema NUMERIC(8, 2),
  paineis_solares INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: whatsapp_clicks
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_clicks (
  id SERIAL PRIMARY KEY,
  origem_pagina VARCHAR(100) NOT NULL,
  dispositivo VARCHAR(20) CHECK (dispositivo IN ('mobile', 'desktop')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: leads_abandonados
-- ============================================
CREATE TABLE IF NOT EXISTS leads_abandonados (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150),
  whatsapp VARCHAR(20),
  etapa_alcancada VARCHAR(100) NOT NULL,
  ultima_atividade TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: depoimentos
-- ============================================
CREATE TABLE IF NOT EXISTS depoimentos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  cargo VARCHAR(150),
  texto TEXT NOT NULL,
  economia VARCHAR(100),
  avaliacao SMALLINT DEFAULT 5 CHECK (avaliacao BETWEEN 1 AND 5),
  foto VARCHAR(500),
  foto_obra VARCHAR(500),
  ordem SMALLINT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABELA: lead_imagens
-- ============================================
CREATE TABLE IF NOT EXISTS lead_imagens (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  tamanho_bytes INTEGER,
  descricao VARCHAR(255),
  uploaded_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SEED: Usuários padrão (senhas hasheadas)
-- admin123 e marcos123
-- ============================================
-- Nota: As senhas abaixo são bcrypt do valor plaintext.
-- Use a rota POST /api/auth/seed para recriar via API.
INSERT INTO usuarios (nome, email, senha_hash, cargo) VALUES
  ('Admin', 'admin@solar.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Gerente'),
  ('Marcos', 'marcos@solar.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Consultor')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- SEED: Leads de exemplo
-- ============================================
INSERT INTO leads (nome, whatsapp, cidade, valor_conta, tipo_imovel, origem, status, notes, created_at) VALUES
  ('João Silva', '11987654321', 'São Paulo', 350.00, 'residencial', 'simulacao', 'novo', '', '2026-04-23 10:00:00'),
  ('Maria Santos', '21976543210', 'Rio de Janeiro', 580.00, 'comercial', 'whatsapp', 'contatado', 'Cliente interessado em instalação comercial', '2026-04-22 14:00:00'),
  ('Pedro Oliveira', '31965432109', 'Belo Horizonte', 420.00, 'residencial', 'simulacao', 'novo', '', '2026-04-23 11:00:00'),
  ('Ana Costa', '41954321098', 'Curitiba', 890.00, 'industrial', 'simulacao', 'convertido', 'Contrato fechado - 50kWp', '2026-04-20 09:00:00'),
  ('Carlos Mendes', '51943210987', 'Porto Alegre', 320.00, 'residencial', 'whatsapp', 'novo', '', '2026-04-23 08:00:00'),
  ('Fernanda Lima', '61932109876', 'Brasília', 650.00, 'comercial', 'simulacao', 'contatado', 'Aguardando aprovação do orçamento', '2026-04-21 16:00:00'),
  ('Roberto Souza', '71921098765', 'Salvador', 480.00, 'residencial', 'whatsapp', 'novo', '', '2026-04-22 13:00:00'),
  ('Juliana Alves', '81910987654', 'Recife', 720.00, 'rural', 'simulacao', 'contatado', 'Interessada em sistema para fazenda', '2026-04-19 10:00:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Simulações de exemplo
-- ============================================
INSERT INTO simulacoes (nome, whatsapp, valor_conta, cidade, economia_anual, potencia_sistema, paineis_solares, created_at) VALUES
  ('João Silva', '11987654321', 350.00, 'São Paulo', 3780.00, 3.5, 10, '2026-04-23 10:00:00'),
  ('Pedro Oliveira', '31965432109', 420.00, 'Belo Horizonte', 4536.00, 4.2, 12, '2026-04-23 11:00:00'),
  ('Ana Costa', '41954321098', 890.00, 'Curitiba', 9612.00, 8.9, 25, '2026-04-20 09:00:00'),
  ('Fernanda Lima', '61932109876', 650.00, 'Brasília', 7020.00, 6.5, 18, '2026-04-21 16:00:00'),
  ('Juliana Alves', '81910987654', 720.00, 'Recife', 7776.00, 7.2, 20, '2026-04-19 10:00:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Cliques no WhatsApp
-- ============================================
INSERT INTO whatsapp_clicks (origem_pagina, dispositivo, created_at) VALUES
  ('Hero Section', 'mobile', '2026-04-23 10:30:00'),
  ('Botão Flutuante', 'desktop', '2026-04-23 11:15:00'),
  ('Footer', 'mobile', '2026-04-23 14:20:00'),
  ('Hero Section', 'desktop', '2026-04-22 09:45:00'),
  ('Botão Flutuante', 'mobile', '2026-04-22 16:30:00'),
  ('Simulador', 'desktop', '2026-04-22 17:10:00'),
  ('Hero Section', 'mobile', '2026-04-21 10:00:00'),
  ('Botão Flutuante', 'desktop', '2026-04-21 13:25:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Leads Abandonados
-- ============================================
INSERT INTO leads_abandonados (nome, whatsapp, etapa_alcancada, ultima_atividade) VALUES
  ('Lucas Pereira', '11999887766', 'Valor da conta', '2026-04-22 15:30:00'),
  (NULL, '21988776655', 'Tipo de imóvel', '2026-04-21 18:45:00'),
  ('Mariana Rocha', NULL, 'Cidade', '2026-04-20 12:20:00'),
  ('Ricardo Dias', '41977665544', 'Nome', '2026-04-23 09:10:00')
ON CONFLICT DO NOTHING;
