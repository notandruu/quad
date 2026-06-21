import asyncio
import os
import re
from uuid import uuid4

import requests
from dotenv import load_dotenv
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

load_dotenv()


AGENT_NAME = os.getenv("QUAD_FETCH_AGENT_NAME", "quad-trust-agent")
AGENT_PORT = int(os.getenv("QUAD_FETCH_AGENT_PORT", "8001"))
AGENT_SEED = os.getenv("QUAD_FETCH_AGENT_SEED", "quad-trust-agent-local-dev-seed")
QUAD_AGENT_RUN_URL = os.getenv("QUAD_AGENT_RUN_URL", "http://localhost:3000/api/agent/run")
QUAD_AGENT_RUN_SECRET = os.getenv("QUAD_AGENT_RUN_SECRET", "")
DEFAULT_TARGET_URL = os.getenv("QUAD_AGENT_DEFAULT_TARGET_URL", "http://localhost:3000/demo")

agent = Agent(
    name=AGENT_NAME,
    seed=AGENT_SEED,
    port=AGENT_PORT,
    mailbox=True,
)
protocol = Protocol(spec=chat_protocol_spec)


def extract_target_url(text: str) -> str:
    match = re.search(r"https?://[^\s)>\"]+", text)
    if match:
        return match.group(0).rstrip(".,")
    return DEFAULT_TARGET_URL


def build_quad_payload(text: str) -> dict:
    return {
        "workflow": "enterprise_proof",
        "targetUrl": extract_target_url(text),
        "limit": 4,
    }


def format_quad_summary(result: dict) -> str:
    summary = result.get("summary") or {}
    artifacts = summary.get("artifacts") or []
    approvals = summary.get("approvals") or []
    receipts = summary.get("receipts") or []
    strongest_receipt = receipts[0] if receipts else {}

    return "\n".join(
        [
            "quad completed the enterprise trust workflow.",
            "",
            f"run: {summary.get('runId', 'unknown')}",
            f"status: {summary.get('status', 'unknown')}",
            f"target: {summary.get('targetUrl', 'unknown')}",
            f"artifacts: {len(artifacts)}",
            f"approvals: {len(approvals)}",
            f"receipt: {strongest_receipt.get('status', 'none')}",
            "",
            f"next action: {summary.get('nextAction', 'open quad dashboard for details')}",
        ]
    )


def run_quad_backend(text: str) -> str:
    headers = {"content-type": "application/json"}
    if QUAD_AGENT_RUN_SECRET:
        headers["x-quad-agent-secret"] = QUAD_AGENT_RUN_SECRET

    response = requests.post(
        QUAD_AGENT_RUN_URL,
        json=build_quad_payload(text),
        headers=headers,
        timeout=180,
    )
    response.raise_for_status()
    return format_quad_summary(response.json())


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=msg.timestamp,
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    user_text = " ".join(
        item.text for item in msg.content if isinstance(item, TextContent)
    ).strip()

    if not user_text:
        answer = "send me a company website or trust page url and i will run quad on it."
    else:
        try:
            answer = await asyncio.to_thread(run_quad_backend, user_text)
        except Exception as exc:
            ctx.logger.exception("quad backend run failed")
            answer = f"quad could not complete the run: {exc}"

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=msg.timestamp,
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=answer),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(_ctx: Context, _sender: str, _msg: ChatAcknowledgement):
    return


agent.include(protocol, publish_manifest=True)


if __name__ == "__main__":
    agent.run()
