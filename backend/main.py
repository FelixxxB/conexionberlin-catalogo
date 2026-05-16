#!/usr/bin/env python3
"""FastAPI backend for the Conexión Berlín game catalog dashboard."""

import json
import os
from pathlib import Path
from typing import Optional

from google import genai
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

GAMES_PATH = Path(__file__).parent / "games.json"

app = FastAPI(title="ConexionBerlin Catalog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_games() -> list[dict]:
    with open(GAMES_PATH, encoding="utf-8") as f:
        return json.load(f)


GAMES: list[dict] = load_games()


@app.get("/api/games")
def get_games(
    search: Optional[str] = Query(None),
    players: Optional[int] = Query(None, description="Filter by exact player count (must fit in range)"),
    players_min: Optional[int] = Query(None),
    players_max: Optional[int] = Query(None),
    time_max: Optional[int] = Query(None, description="Max playing time in minutes"),
    available_only: bool = Query(False),
    base_only: bool = Query(False, description="Exclude expansions"),
    sort: str = Query("title", description="title | players_min | playing_time"),
    limit: int = Query(48, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    results = GAMES

    if search:
        q = search.lower()
        results = [g for g in results if q in (g["title"] or "").lower()]

    if players is not None:
        results = [
            g for g in results
            if g["players_min"] is not None
            and g["players_max"] is not None
            and g["players_min"] <= players <= g["players_max"]
        ]

    if players_min is not None:
        results = [g for g in results if g["players_min"] is not None and g["players_min"] >= players_min]

    if players_max is not None:
        results = [g for g in results if g["players_max"] is not None and g["players_max"] <= players_max]

    if time_max is not None:
        results = [g for g in results if g["playing_time"] is not None and g["playing_time"] <= time_max]

    if available_only:
        results = [g for g in results if g["available"]]

    if base_only:
        results = [g for g in results if not g["expansion"]]

    # Sort
    if sort == "players_min":
        results = sorted(results, key=lambda g: (g["players_min"] or 999))
    elif sort == "playing_time":
        results = sorted(results, key=lambda g: (g["playing_time"] or 999))
    else:
        results = sorted(results, key=lambda g: g["title"].lower())

    total = len(results)
    page = results[offset : offset + limit]

    return {"total": total, "offset": offset, "limit": limit, "games": page}


@app.get("/api/stats")
def get_stats():
    total = len(GAMES)
    available = sum(1 for g in GAMES if g["available"])
    expansions = sum(1 for g in GAMES if g["expansion"])
    player_counts = [g["players_max"] for g in GAMES if g["players_max"] is not None]
    max_players = max(player_counts) if player_counts else 0
    return {
        "total": total,
        "available": available,
        "expansions": expansions,
        "base_games": total - expansions,
        "max_players_in_catalog": max_players,
    }


class AIQueryRequest(BaseModel):
    message: str
    filters_active: Optional[dict] = None


GAMES_BY_TITLE: dict[str, dict] = {g["title"].lower(): g for g in GAMES}


def find_games_by_titles(titles: list[str]) -> list[dict]:
    """Match AI-returned titles to catalog games (case-insensitive, partial ok)."""
    results = []
    seen_ids = set()
    for title in titles:
        key = title.lower().strip()
        # Exact match first
        game = GAMES_BY_TITLE.get(key)
        # Partial match fallback
        if not game:
            for catalog_key, g in GAMES_BY_TITLE.items():
                if key in catalog_key or catalog_key in key:
                    game = g
                    break
        if game and game["id"] not in seen_ids:
            results.append(game)
            seen_ids.add(game["id"])
    return results


@app.post("/api/ai/query")
def ai_query(req: AIQueryRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    # Build a concise game list for context (title + players + time)
    catalog_lines = []
    for g in GAMES:
        if not g["available"]:
            continue
        p = ""
        if g["players_min"] and g["players_max"]:
            p = f"{g['players_min']}-{g['players_max']}j"
        elif g["players_min"]:
            p = f"{g['players_min']}j+"
        t = f"{g['playing_time']}min" if g["playing_time"] else ""
        exp = " [exp]" if g["expansion"] else ""
        catalog_lines.append(f"- {g['title']} ({p}, {t}{exp})")

    catalog_text = "\n".join(catalog_lines[:500])

    system_prompt = f"""Eres un experto en juegos de mesa del café Conexión Berlín en Buenos Aires.
Ayudás a los clientes a encontrar juegos de mesa según sus preferencias.

El catálogo de juegos disponibles (formato: nombre, jugadores, tiempo, [exp]=expansión):
{catalog_text}

INSTRUCCIONES DE RESPUESTA:
Respondé SIEMPRE con un objeto JSON válido con esta estructura exacta:
{{
  "text": "Tu respuesta conversacional en español, amigable y concisa",
  "recommendations": ["Título exacto del juego 1", "Título exacto del juego 2", ...]
}}

- "text": tu respuesta en lenguaje natural, sin listar los juegos de nuevo (las tarjetas se muestran aparte)
- "recommendations": lista de títulos EXACTOS del catálogo (copiados tal cual aparecen arriba). Solo incluir si estás recomendando juegos. Lista vacía [] si no aplica.

Reglas:
- Sugerí 3-6 juegos que mejor se ajusten al pedido
- Solo recomendá juegos del catálogo
- Si el usuario hace pregunta general, respondé sin recomendaciones"""

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=req.message,
        config={
            "system_instruction": system_prompt,
            "max_output_tokens": 1024,
            "response_mime_type": "application/json",
        },
    )

    import json as _json
    try:
        parsed = _json.loads(response.text)
        text = parsed.get("text", response.text)
        titles = parsed.get("recommendations", [])
    except Exception:
        text = response.text
        titles = []

    matched_games = find_games_by_titles(titles)
    return {"response": text, "games": matched_games}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
