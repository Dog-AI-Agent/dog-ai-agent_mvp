-- ============================================================
-- dogs 테이블 추가 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS dogs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    birthday              DATE,
    breed_id              UUID REFERENCES breeds(id) ON DELETE SET NULL,
    favorite_ingredients  TEXT[] DEFAULT '{}',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON dogs(user_id);
