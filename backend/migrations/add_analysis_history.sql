-- 분석 히스토리 테이블
CREATE TABLE IF NOT EXISTS analysis_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    breed_id     UUID REFERENCES breeds(id) ON DELETE SET NULL,
    breed_name_ko TEXT NOT NULL,
    breed_name_en TEXT,
    confidence   FLOAT,
    is_mixed_breed BOOLEAN DEFAULT FALSE,
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
