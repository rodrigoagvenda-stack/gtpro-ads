from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, campaigns, insights, alerts, agent, gtpro_api, settings

app = FastAPI(
    title="GTPRO API",
    version="1.0.0",
    docs_url="/docs" if settings.environment != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gtpro.vendai.pro", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(insights.router)
app.include_router(alerts.router)
app.include_router(agent.router)
app.include_router(gtpro_api.router)
app.include_router(settings.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.environment}
