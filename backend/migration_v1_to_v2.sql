-- ============================================================
-- 댕슐랭 Migration: v1 → v2
-- 기존 테이블 DROP 후 새 스키마로 재생성
-- ⚠ 데이터가 모두 삭제됩니다. seed.py로 재시딩 필요
-- ============================================================

-- 1. Drop old tables (역순 — FK 의존성)
DROP TABLE IF EXISTS recipe_nutrition CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipe_steps CASCADE;
DROP TABLE IF EXISTS recipe_diseases CASCADE;
DROP TABLE IF EXISTS disease_ingredients CASCADE;
DROP TABLE IF EXISTS breed_diseases CASCADE;
DROP TABLE IF EXISTS feeds CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS diseases CASCADE;
DROP TABLE IF EXISTS breeds CASCADE;

-- 2. Drop old indexes (테이블 DROP 시 자동 삭제되지만 명시적으로)
DROP INDEX IF EXISTS idx_breeds_breed_model;
DROP INDEX IF EXISTS idx_breeds_name_ko;
DROP INDEX IF EXISTS idx_breeds_size;
DROP INDEX IF EXISTS idx_breed_diseases_breed;
DROP INDEX IF EXISTS idx_breed_diseases_disease;
DROP INDEX IF EXISTS idx_disease_ingredients_disease;
DROP INDEX IF EXISTS idx_recipe_diseases_recipe;
DROP INDEX IF EXISTS idx_recipe_diseases_disease;
DROP INDEX IF EXISTS idx_recipe_ingredients_recipe;
DROP INDEX IF EXISTS idx_recipe_steps_recipe;

-- 3. Run schema.sql (새 테이블 생성)
-- → Supabase SQL Editor에서 schema.sql 내용을 이어서 실행

-- 4. Re-seed
-- → python -m backend.seed
