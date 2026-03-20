-- ============================================================
-- users 테이블 추가 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    nickname      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    birth_date    DATE,
    address       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
