-- 댕슐랭 (Daeng Michelin) Database Schema
-- Run in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Core Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS breeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breed_model TEXT UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_ko TEXT NOT NULL,
    size_category TEXT,
    synset TEXT,
    avg_weight_kg FLOAT,
    avg_life_span_years FLOAT,
    description TEXT,
    temperament TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT UNIQUE NOT NULL,
    name_ko TEXT,
    is_genetic BOOLEAN DEFAULT false,
    severity TEXT DEFAULT 'medium',
    description TEXT,
    symptoms TEXT[],
    affected_area TEXT,
    prevention_tips TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT UNIQUE NOT NULL,
    name_ko TEXT,
    category TEXT,
    effect_description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_en TEXT UNIQUE NOT NULL,
    title_ko TEXT,
    description TEXT,
    calories_per_serving FLOAT,
    cook_time_min INT,
    difficulty TEXT DEFAULT 'easy',
    servings INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Junction Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS breed_diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breed_id UUID REFERENCES breeds(id) ON DELETE CASCADE,
    disease_id UUID REFERENCES diseases(id) ON DELETE CASCADE,
    risk_level TEXT DEFAULT 'medium',
    UNIQUE(breed_id, disease_id)
);

CREATE TABLE IF NOT EXISTS disease_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID REFERENCES diseases(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    priority INT DEFAULT 0,
    UNIQUE(disease_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS recipe_diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    disease_id UUID REFERENCES diseases(id) ON DELETE CASCADE,
    UNIQUE(recipe_id, disease_id)
);

-- ============================================================
-- Recipe Detail Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    name TEXT NOT NULL,
    amount TEXT,
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    instruction TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_nutrition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    nutrient_name TEXT NOT NULL,
    amount FLOAT,
    unit TEXT
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_breeds_breed_model ON breeds(breed_model);
CREATE INDEX IF NOT EXISTS idx_breeds_name_ko ON breeds(name_ko);
CREATE INDEX IF NOT EXISTS idx_breeds_size ON breeds(size_category);
CREATE INDEX IF NOT EXISTS idx_breed_diseases_breed ON breed_diseases(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_diseases_disease ON breed_diseases(disease_id);
CREATE INDEX IF NOT EXISTS idx_disease_ingredients_disease ON disease_ingredients(disease_id);
CREATE INDEX IF NOT EXISTS idx_recipe_diseases_recipe ON recipe_diseases(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_diseases_disease ON recipe_diseases(disease_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id);
