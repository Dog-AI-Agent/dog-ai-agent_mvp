-- ============================================================
-- 댕슐랭 (Daeng Michelin) Database Schema v2
-- PRD 테이블 정의서 v2.1 + 프론트엔드 정합
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- [1] breeds — 품종 마스터 (PRD: breed_info 역할)
-- AI 모델 출력 라벨과 1:1 매칭. summary = LLM 사전 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS breeds (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breed_model           TEXT UNIQUE NOT NULL,          -- AI 모델 출력 라벨 (예: golden_retriever)
    name_en               TEXT NOT NULL,                 -- 품종명 (영문)
    name_ko               TEXT NOT NULL,                 -- 품종명 (한글)
    size_category         TEXT CHECK (size_category IN ('small', 'medium', 'large', 'giant')),
    avg_weight_kg         FLOAT,                         -- 평균 체중 (kg)
    avg_life_span_years   FLOAT,                         -- 평균 수명 (년)
    description           TEXT,                          -- 품종 설명
    temperament           TEXT,                          -- 성격 특성
    image_url             TEXT,                          -- 품종 대표 이미지 URL
    summary               TEXT,                          -- LLM 사전 생성 추천 요약 (2~3줄)
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- [2] diseases — 유전병
-- CIDD 데이터 소스, severity CHECK, 출처 정보 포함
-- ============================================================
CREATE TABLE IF NOT EXISTS diseases (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en           TEXT UNIQUE NOT NULL,              -- 유전병명 (영문)
    name_ko           TEXT,                              -- 유전병명 (한글)
    description       TEXT,                              -- 유전병 상세 설명
    severity          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (severity IN ('low', 'medium', 'high')),
    symptoms          TEXT[],                            -- 증상 목록 (배열)
    affected_area     TEXT,                              -- 영향 부위
    prevention_tips   TEXT,                              -- 예방/관리 팁
    source_name       TEXT,                              -- 데이터 출처명 (예: CIDD)
    source_url        TEXT,                              -- 데이터 출처 URL
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- [3] ingredients — 영양 성분
-- category로 성분 유형 분류
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en       TEXT UNIQUE NOT NULL,                  -- 성분명 (영문)
    name_ko       TEXT,                                  -- 성분명 (한글)
    category      TEXT,                                  -- 성분 유형 (vitamin, mineral, fatty_acid 등)
    description   TEXT,                                  -- 성분 설명
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- [4] foods — 음식/식재료
-- 강아지에게 급여 가능한 음식. 한국에서 구할 수 있는 재료 우선
-- ============================================================
CREATE TABLE IF NOT EXISTS foods (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en       TEXT UNIQUE NOT NULL,                  -- 음식명 (영문)
    name_ko       TEXT,                                  -- 음식명 (한글)
    category      TEXT,                                  -- 음식 유형 (protein, vegetable, grain, fruit, supplement 등)
    description   TEXT,                                  -- 음식 설명
    image_url     TEXT,                                  -- 음식 이미지 URL
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- [5] recipes — 집밥 레시피
-- 실제 조리법. foods를 재료로 사용
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                  TEXT NOT NULL,                -- 레시피 제목
    description            TEXT,                         -- 레시피 설명
    calories_per_serving   INT,                          -- 1회분 칼로리 (kcal)
    cook_time_min          INT,                          -- 조리 소요 시간 (분)
    difficulty             TEXT DEFAULT 'easy'
                           CHECK (difficulty IN ('easy', 'medium', 'hard')),
    servings               INT DEFAULT 1,               -- 인분 수
    image_url              TEXT,                         -- 레시피 이미지 URL
    source_name            TEXT,                         -- 레시피 출처명
    source_url             TEXT,                         -- 레시피 출처 URL
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- [6] breed_diseases — 품종 ↔ 유전병 (M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS breed_diseases (
    breed_id      UUID NOT NULL REFERENCES breeds(id) ON DELETE CASCADE,
    disease_id    UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    risk_level    TEXT NOT NULL DEFAULT 'medium'
                  CHECK (risk_level IN ('low', 'medium', 'high')),
    PRIMARY KEY (breed_id, disease_id)
);

-- ============================================================
-- [7] disease_ingredients — 유전병 ↔ 권장 영양소 (M:N)
-- effect_description, priority, 근거 출처 포함
-- ============================================================
CREATE TABLE IF NOT EXISTS disease_ingredients (
    disease_id           UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    ingredient_id        UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    effect_description   TEXT,                           -- 성분이 유전병에 미치는 효과 설명
    priority             INT DEFAULT 1,                  -- 추천 우선순위 (1=최우선)
    source_name          TEXT,                           -- 근거 출처명
    source_url           TEXT,                           -- 근거 출처 URL
    PRIMARY KEY (disease_id, ingredient_id)
);

-- ============================================================
-- [8] food_ingredients — 음식 ↔ 함유 성분 (M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS food_ingredients (
    food_id         UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (food_id, ingredient_id)
);

-- ============================================================
-- [9] recipe_foods — 레시피 ↔ 재료 (M:N)
-- amount, unit, sort_order로 재료 수량 및 순서 관리
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_foods (
    recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    food_id      UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    amount       TEXT,                                   -- 재료 수량 (예: "200g", "1컵")
    unit         TEXT,                                   -- 단위
    sort_order   INT DEFAULT 0,                          -- 표시 순서
    PRIMARY KEY (recipe_id, food_id)
);

-- ============================================================
-- [10] recipe_steps — 조리 단계
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_steps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number   INT NOT NULL,                          -- 조리 단계 번호
    description   TEXT NOT NULL,                         -- 조리 단계 설명
    UNIQUE (recipe_id, step_number)
);

-- ============================================================
-- [11] recipe_target_diseases — 레시피 ↔ 대상 유전병 (M:N)
-- S5에서 대상 유전병 태그 표시용
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_target_diseases (
    recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    disease_id   UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, disease_id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_breeds_breed_model ON breeds(breed_model);
CREATE INDEX IF NOT EXISTS idx_breeds_name_ko ON breeds(name_ko);
CREATE INDEX IF NOT EXISTS idx_breeds_size ON breeds(size_category);
CREATE INDEX IF NOT EXISTS idx_diseases_severity ON diseases(severity);
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
CREATE INDEX IF NOT EXISTS idx_breed_diseases_breed ON breed_diseases(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_diseases_disease ON breed_diseases(disease_id);
CREATE INDEX IF NOT EXISTS idx_disease_ingredients_disease ON disease_ingredients(disease_id);
CREATE INDEX IF NOT EXISTS idx_disease_ingredients_ingredient ON disease_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_food_ingredients_food ON food_ingredients(food_id);
CREATE INDEX IF NOT EXISTS idx_food_ingredients_ingredient ON food_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_foods_recipe ON recipe_foods(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_foods_food ON recipe_foods(food_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_target_diseases_recipe ON recipe_target_diseases(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_target_diseases_disease ON recipe_target_diseases(disease_id);
