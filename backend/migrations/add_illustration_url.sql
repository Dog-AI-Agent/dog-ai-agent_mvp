-- 분석 히스토리에 일러스트 URL 컬럼 추가
ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS illustration_url TEXT;
