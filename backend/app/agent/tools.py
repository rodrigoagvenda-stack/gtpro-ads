from typing import Any
from app.services import meta_ads
from app.database import supabase

# Definição das tools para o Claude (tool use)
TOOLS = [
    {
        "name": "get_campaigns",
        "description": "Lista todas as campanhas da conta Meta com métricas básicas.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_preset": {
                    "type": "string",
                    "description": "Período das métricas: today, yesterday, last_7d, last_30d, this_month",
                    "default": "last_7d",
                }
            },
        },
    },
    {
        "name": "get_insights",
        "description": "Retorna métricas agregadas da conta (ROAS, CPL, CPA, gasto total) para um período.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_preset": {
                    "type": "string",
                    "description": "Período: today, yesterday, last_7d, last_30d, this_month, last_month",
                }
            },
            "required": ["date_preset"],
        },
    },
    {
        "name": "toggle_campaign",
        "description": "Ativa ou pausa uma campanha específica.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string", "description": "ID da campanha na Meta"},
                "status": {
                    "type": "string",
                    "enum": ["ACTIVE", "PAUSED"],
                    "description": "Novo status da campanha",
                },
            },
            "required": ["campaign_id", "status"],
        },
    },
    {
        "name": "update_budget",
        "description": "Atualiza o orçamento diário ou total de uma campanha.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string"},
                "daily_budget": {"type": "number", "description": "Orçamento diário em BRL"},
                "lifetime_budget": {"type": "number", "description": "Orçamento total em BRL"},
            },
            "required": ["campaign_id"],
        },
    },
    {
        "name": "create_alert",
        "description": "Registra um alerta no sistema para notificar o gestor.",
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["roas_baixo", "cpl_alto", "budget_esgotado", "campanha_rejeitada", "queda_performance"],
                },
                "message": {"type": "string", "description": "Mensagem descritiva do alerta"},
                "campaign_id": {"type": "string", "description": "ID da campanha relacionada (opcional)"},
            },
            "required": ["type", "message"],
        },
    },
]


async def execute_tool(name: str, inputs: dict, tenant_id: str) -> Any:
    if name == "get_campaigns":
        return await meta_ads.get_campaigns(tenant_id)

    elif name == "get_insights":
        return await meta_ads.get_insights(tenant_id, inputs.get("date_preset", "last_7d"))

    elif name == "toggle_campaign":
        return await meta_ads.toggle_campaign(
            tenant_id, inputs["campaign_id"], inputs["status"]
        )

    elif name == "update_budget":
        return await meta_ads.update_budget(
            tenant_id,
            inputs["campaign_id"],
            daily_budget=inputs.get("daily_budget"),
            lifetime_budget=inputs.get("lifetime_budget"),
        )

    elif name == "create_alert":
        result = (
            supabase.table("alerts")
            .insert({
                "tenant_id": tenant_id,
                "type": inputs["type"],
                "message": inputs["message"],
                "campaign_id": inputs.get("campaign_id"),
                "status": "active",
            })
            .execute()
        )
        return result.data

    raise ValueError(f"Tool desconhecida: {name}")
