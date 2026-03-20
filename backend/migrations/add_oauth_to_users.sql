-- OAuth 소셜 로그인을 위한 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider TEXT,  -- 'google' | 'naver' | 'kakao'
  ADD COLUMN IF NOT EXISTS oauth_id TEXT;         -- 각 provider의 고유 user id

-- password_hash를 nullable로 변경 (소셜 로그인 유저는 비밀번호 없음)
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- oauth_provider + oauth_id 조합 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
