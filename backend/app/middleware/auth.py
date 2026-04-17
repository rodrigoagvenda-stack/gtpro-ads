from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings
from app.database import supabase

security = HTTPBearer()


async def get_current_tenant(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials

    # Tenta como JWT do Supabase Auth
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        tenant_id = payload.get("app_metadata", {}).get("tenant_id")
        user_id = payload.get("sub")
        if not tenant_id:
            raise HTTPException(status_code=403, detail="tenant_id ausente no token")
        return {"tenant_id": tenant_id, "user_id": user_id, "auth_type": "jwt"}
    except JWTError:
        pass

    # Tenta como API Key da GTPRO (para agentes externos como MAX)
    result = (
        supabase.table("api_keys")
        .select("tenant_id, scope, active")
        .eq("key_hash", _hash_key(token))
        .eq("active", True)
        .single()
        .execute()
    )
    if result.data:
        return {
            "tenant_id": result.data["tenant_id"],
            "scope": result.data["scope"],
            "auth_type": "api_key",
        }

    raise HTTPException(status_code=401, detail="Token inválido")


def require_write_scope(tenant: dict = Depends(get_current_tenant)) -> dict:
    if tenant.get("auth_type") == "api_key" and tenant.get("scope") == "read":
        raise HTTPException(status_code=403, detail="API Key sem permissão de escrita")
    return tenant


def _hash_key(key: str) -> str:
    import hashlib
    return hashlib.sha256(key.encode()).hexdigest()
