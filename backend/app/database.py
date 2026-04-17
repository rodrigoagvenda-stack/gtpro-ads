from supabase import create_client, Client
from app.config import settings

# Client com service role — usado apenas no backend, nunca exposto
supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
)
