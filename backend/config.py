import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AI_SERVER_URL = os.getenv("AI_SERVICE_URL", os.getenv("AI_SERVER_URL", "http://localhost:8001"))
