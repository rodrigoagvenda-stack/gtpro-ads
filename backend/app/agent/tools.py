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
    {
        "name": "upload_image",
        "description": "Faz upload de uma imagem a partir de uma URL para a biblioteca de mídia da Meta.",
        "input_schema": {
            "type": "object",
            "properties": {
                "image_url": {"type": "string", "description": "URL pública da imagem a ser enviada"},
            },
            "required": ["image_url"],
        },
    },
    {
        "name": "create_ad_creative",
        "description": "Cria um criativo de anúncio usando um image_hash já enviado.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nome do criativo"},
                "page_id": {"type": "string", "description": "ID da página do Facebook"},
                "image_hash": {"type": "string", "description": "Hash da imagem retornado pelo upload_image"},
                "primary_text": {"type": "string", "description": "Texto principal do anúncio"},
                "headline": {"type": "string", "description": "Título do anúncio"},
                "link": {"type": "string", "description": "URL de destino do anúncio"},
                "description": {"type": "string", "description": "Descrição (opcional)"},
                "cta": {
                    "type": "string",
                    "description": "Call to action",
                    "enum": ["LEARN_MORE", "SIGN_UP", "SHOP_NOW", "BOOK_NOW", "CONTACT_US", "SUBSCRIBE", "DOWNLOAD"],
                    "default": "LEARN_MORE",
                },
            },
            "required": ["name", "page_id", "image_hash", "primary_text", "headline", "link"],
        },
    },
    {
        "name": "create_ad",
        "description": "Cria um anúncio vinculando um criativo a um conjunto de anúncios.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nome do anúncio"},
                "adset_id": {"type": "string", "description": "ID do conjunto de anúncios"},
                "creative_id": {"type": "string", "description": "ID do criativo retornado pelo create_ad_creative"},
                "status": {"type": "string", "enum": ["PAUSED", "ACTIVE"], "default": "PAUSED"},
            },
            "required": ["name", "adset_id", "creative_id"],
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

    elif name == "upload_image":
        return await meta_ads.upload_image_from_url(tenant_id, inputs["image_url"])

    elif name == "create_ad_creative":
        return await meta_ads.create_ad_creative(
            tenant_id,
            name=inputs["name"],
            page_id=inputs["page_id"],
            image_hash=inputs["image_hash"],
            primary_text=inputs["primary_text"],
            headline=inputs["headline"],
            link=inputs["link"],
            description=inputs.get("description", ""),
            cta=inputs.get("cta", "LEARN_MORE"),
        )

    elif name == "create_ad":
        return await meta_ads.create_ad(
            tenant_id,
            name=inputs["name"],
            adset_id=inputs["adset_id"],
            creative_id=inputs["creative_id"],
            status=inputs.get("status", "PAUSED"),
        )

    raise ValueError(f"Tool desconhecida: {name}")
