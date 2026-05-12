"""POST /v1/chat/completions — OpenAI-compatible, streaming.

Generates a canned, model-flavored response so the UI gets realistic chunked
output without us having to host an actual model. The cadence and chunk sizes
are picked to feel like real inference.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from store import store

router = APIRouter(prefix="/v1", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="system | user | assistant | tool")
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float | None = 0.7
    top_p: float | None = 1.0
    max_tokens: int | None = 512
    presence_penalty: float | None = 0.0
    frequency_penalty: float | None = 0.0
    stop: list[str] | str | None = None
    seed: int | None = None


# A pool of canned completions. We pick one based on the user's last message
# so candidates exploring the playground see varied, plausible output rather
# than the same string every time.
CANNED_RESPONSES = [
    (
        "Sure — here's the short version.\n\n"
        "1. The request lands at the gateway, which authenticates the API "
        "key and applies rate limits.\n"
        "2. It's routed to a model worker pool based on the requested model "
        "and current load.\n"
        "3. The worker streams tokens back through the gateway to you.\n\n"
        "Is there a specific part you want me to expand on?"
    ),
    (
        "Good question. There are a few angles worth pulling on:\n\n"
        "- **Latency**: token-by-token streaming hides cold-start cost behind "
        "the first useful token.\n"
        "- **Cost**: smaller models with prompt caching beat bigger models "
        "with longer prompts most of the time.\n"
        "- **Quality**: pick the smallest model that solves your task at the "
        "quality bar you care about — then hold that bar with evals.\n\n"
        "I'd start with the cheapest model and a tight system prompt."
    ),
    (
        "```python\n"
        "from openai import OpenAI\n\n"
        "client = OpenAI(\n"
        "    api_key=os.environ[\"PARASAIL_API_KEY\"],\n"
        "    base_url=\"https://api.parasail.io/v1\",\n"
        ")\n\n"
        "stream = client.chat.completions.create(\n"
        "    model=\"parasail-llama-3.1-70b-instruct\",\n"
        "    messages=[{\"role\": \"user\", \"content\": \"Hello!\"}],\n"
        "    stream=True,\n"
        ")\n\n"
        "for chunk in stream:\n"
        "    print(chunk.choices[0].delta.content or \"\", end=\"\")\n"
        "```\n\n"
        "That's the canonical streaming pattern. Drop the `stream=True` and "
        "the loop if you'd rather block on the full response."
    ),
    (
        "Honestly, it depends. The tradeoff between fine-tuning and a longer "
        "system prompt usually comes down to two things: how often the task "
        "shape changes, and how much you care about per-request latency. "
        "Fine-tuning wins when the task is stable and you're paying for "
        "every extra prompt token at scale. Otherwise a tight system prompt "
        "plus retrieval tends to be the better starting point."
    ),
]


def _pick_response(messages: list[ChatMessage]) -> str:
    last_user = next(
        (m.content for m in reversed(messages) if m.role == "user"), ""
    )
    # Deterministic pick from the user's last message so the same prompt
    # produces the same canned reply (helpful for screenshots).
    idx = sum(ord(c) for c in last_user) % len(CANNED_RESPONSES)
    return CANNED_RESPONSES[idx]


def _approx_tokens(s: str) -> int:
    # Rough heuristic — good enough for usage display, not for billing.
    return max(1, len(s) // 4)


def _validate_model(model_id: str) -> None:
    valid = {m["id"] for m in store.models()}
    valid |= {d["id"] for d in store.deployments() if d.get("status") == "running"}
    if model_id not in valid:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "type": "model_not_found",
                    "message": (
                        f"Model '{model_id}' was not found. "
                        "Call GET /v1/models to list available models."
                    ),
                }
            },
        )


@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    _validate_model(req.model)

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())
    response_text = _pick_response(req.messages)
    prompt_tokens = sum(_approx_tokens(m.content) for m in req.messages)

    if not req.stream:
        completion_tokens = _approx_tokens(response_text)
        return {
            "id": completion_id,
            "object": "chat.completion",
            "created": created,
            "model": req.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": response_text},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    return StreamingResponse(
        _stream(completion_id, created, req.model, response_text, prompt_tokens),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )


async def _stream(
    completion_id: str,
    created: int,
    model: str,
    text: str,
    prompt_tokens: int,
):
    # Send role-only initial chunk, then word-ish chunks at realistic cadence,
    # then a final chunk with usage and finish_reason. Matches OpenAI's SSE
    # format — `data: <json>\n\n`, terminated with `data: [DONE]\n\n`.
    def chunk(delta: dict[str, Any], finish_reason: str | None = None) -> str:
        return "data: " + json.dumps(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "delta": delta,
                        "finish_reason": finish_reason,
                    }
                ],
            }
        ) + "\n\n"

    yield chunk({"role": "assistant", "content": ""})

    # Time-to-first-token: small initial pause to feel like real inference.
    await asyncio.sleep(0.18)

    pieces = _tokenize_for_streaming(text)
    completion_tokens = 0
    for piece in pieces:
        yield chunk({"content": piece})
        completion_tokens += _approx_tokens(piece)
        # ~30–60 tok/s feel
        await asyncio.sleep(0.022)

    final = "data: " + json.dumps(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }
    ) + "\n\n"
    yield final
    yield "data: [DONE]\n\n"


def _tokenize_for_streaming(text: str) -> list[str]:
    # Split into word + trailing whitespace pairs, preserving newlines and
    # code fences naturally.
    out: list[str] = []
    buf = ""
    for ch in text:
        buf += ch
        if ch in (" ", "\n"):
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return out
