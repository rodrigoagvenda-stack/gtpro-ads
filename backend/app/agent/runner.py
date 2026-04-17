import anthropic
from app.agent.tools import TOOLS, execute_tool
from app.agent.prompts import SYSTEM_PROMPT, build_user_message
from app.database import supabase
from app.services.platform import get_anthropic_key


def _get_client():
    return anthropic.Anthropic(api_key=get_anthropic_key())


async def run_agent(
    tenant_id: str,
    message: str,
    tenant_config: dict,
) -> dict:
    user_message = build_user_message(message, tenant_config)
    messages = [{"role": "user", "content": user_message}]
    actions_taken = []

    # Agentic loop com tool use
    while True:
        response = _get_client().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Acumula a resposta no histórico
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            final_text = _extract_text(response.content)
            return {
                "message": final_text,
                "actions_taken": actions_taken,
            }

        if response.stop_reason == "tool_use":
            tool_results = []

            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input

                # Verifica modo supervisionado para ações de escrita
                is_write_action = tool_name in ("toggle_campaign", "update_budget")
                if is_write_action and tenant_config.get("modo_supervisionado"):
                    result = {"status": "pending_approval", "message": "Aguardando aprovação do gestor"}
                    _log_action(tenant_id, tool_name, tool_input, result, "pending_approval", "Modo supervisionado ativo")
                else:
                    try:
                        result = await execute_tool(tool_name, tool_input, tenant_id)
                        _log_action(tenant_id, tool_name, tool_input, result, "success", "")
                        if is_write_action:
                            actions_taken.append({"tool": tool_name, "input": tool_input, "result": result})
                    except Exception as e:
                        result = {"error": str(e)}
                        _log_action(tenant_id, tool_name, tool_input, result, "failed", str(e))

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result),
                })

            messages.append({"role": "user", "content": tool_results})


def _extract_text(content: list) -> str:
    for block in content:
        if hasattr(block, "type") and block.type == "text":
            return block.text
    return ""


def _log_action(tenant_id: str, action: str, params: dict, result: any, status: str, justification: str):
    supabase.table("agent_logs").insert({
        "tenant_id": tenant_id,
        "action": action,
        "params": params,
        "result": result if isinstance(result, dict) else {"raw": str(result)},
        "status": status,
        "justification": justification,
    }).execute()
