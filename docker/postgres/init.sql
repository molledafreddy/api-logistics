-- ═══════════════════════════════════════════
-- init.sql — Inicialización de PostgreSQL
-- Ejecutado automáticamente por Docker al crear la DB
-- ═══════════════════════════════════════════

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Configuración para búsqueda fuzzy
SET pg_trgm.similarity_threshold = 0.3;
