#!/usr/bin/env python3
"""Fetches the Conexión Berlín game catalog from their public GCS index."""

import json
from pathlib import Path

import requests

CATALOG_URL = "https://storage.googleapis.com/pamir-public-db/index/ba-new.json"
OUTPUT_PATH = Path(__file__).parent.parent / "backend" / "games.json"


def extract_image_url(image_data: dict) -> str:
    try:
        return image_data["gatsbyImageData"]["images"]["fallback"]["src"]
    except (KeyError, TypeError):
        return ""


def normalize_game(raw: dict) -> dict:
    return {
        "id": raw.get("id", ""),
        "title": raw.get("title", ""),
        "slug": raw.get("slug", ""),
        "players_min": raw.get("minimumPlayers"),
        "players_max": raw.get("maximumPlayers"),
        "time_min": raw.get("minimumPlayingTime"),
        "time_max": raw.get("maximumPlayingTime"),
        "playing_time": raw.get("playingTime"),
        "expansion": raw.get("expansion", False),
        "available": raw.get("available", True),
        "only_for_sale": raw.get("onlyForSale", False),
        "keywords": raw.get("keywords"),
        "image_url": extract_image_url(raw.get("image", {})),
        "detail_url": f"https://www.conexionberlin.com/ba/juego/{raw.get('id', '')}/{raw.get('slug', '')}/",
    }


def main():
    print(f"Fetching catalog from {CATALOG_URL}")
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(CATALOG_URL, headers=headers, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    raw_games = data.get("items", [])
    print(f"Total games in catalog: {len(raw_games)}")

    games = [normalize_game(g) for g in raw_games]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(games)} games to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
