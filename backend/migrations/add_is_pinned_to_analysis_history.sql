-- analysis_history 테이블에 is_pinned 컬럼 추가 (My Dog 기능)
ALTER TABLE analysis_history
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
