#!/usr/bin/env python3
"""Fetches the Conexión Berlín game catalog — catalog index + per-game page-data."""

import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

CATALOG_URL = "https://storage.googleapis.com/pamir-public-db/index/ba-new.json"
PAGE_DATA_URL = "https://www.conexionberlin.com/page-data/ba/juego/{id}/{slug}/page-data.json"
OUTPUT_PATH = Path(__file__).parent.parent / "backend" / "games.json"
HEADERS = {"User-Agent": "Mozilla/5.0"}
WORKERS = 20


def fetch_page_data(game_id: str, slug: str) -> dict | None:
    url = PAGE_DATA_URL.format(id=game_id, slug=slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json()["result"]["data"]["game"]
    except Exception:
        pass
    return None


def parse_description(raw_json_str: str) -> str | None:
    try:
        doc = json.loads(raw_json_str)
        texts = []

        def extract(node):
            if node.get("nodeType") == "text":
                v = node.get("value", "").strip()
                if v:
                    texts.append(v)
            for child in node.get("content", []):
                extract(child)

        extract(doc)
        return " ".join(texts) or None
    except Exception:
        return None


def parse_rank(rank_str: str) -> int | None:
    """Convert rank string like '02000' to 0-4 slider position."""
    if not rank_str:
        return None
    try:
        digits = [int(c) for c in rank_str]
        m = max(digits)
        return digits.index(m) if m > 0 else None
    except Exception:
        return None


def extract_image_url(image_data: dict) -> str | None:
    try:
        return image_data["gatsbyImageData"]["images"]["fallback"]["src"]
    except (KeyError, TypeError):
        return None


def normalize_game(catalog: dict, page: dict | None) -> dict:
    p = page or {}
    tags = [t["name"] for t in (p.get("gameTags") or [])]
    authors = [a["name"] for a in (p.get("authors") or [])]
    locations = [l["locationId"] for l in (p.get("locations") or [])]

    desc_raw = (p.get("description") or {}).get("raw")
    description = parse_description(desc_raw) if desc_raw else None
    short_description = (p.get("shortDescription") or {}).get("shortDescription")

    return {
        "id": catalog.get("id", ""),
        "title": catalog.get("title", ""),
        "slug": catalog.get("slug", ""),
        "players_min": catalog.get("minimumPlayers"),
        "players_max": catalog.get("maximumPlayers"),
        "time_min": catalog.get("minimumPlayingTime"),
        "time_max": catalog.get("maximumPlayingTime"),
        "playing_time": catalog.get("playingTime"),
        "expansion": catalog.get("expansion", False),
        "available": catalog.get("available", True),
        "only_for_sale": catalog.get("onlyForSale", False),
        "keywords": catalog.get("keywords"),
        "image_url": extract_image_url(catalog.get("image", {})),
        "detail_url": f"https://www.conexionberlin.com/ba/juego/{catalog.get('id', '')}/{catalog.get('slug', '')}/",
        "authors": authors,
        "year": p.get("year"),
        "tags": tags,
        "short_description": short_description,
        "description": description,
        "bgg_weight": p.get("bggWeight"),
        "language_dependence": p.get("languageDependence"),
        "locations": locations,
        "family_advanced": parse_rank((p.get("familyAdvanced") or {}).get("rank")),
        "luck_strategy": parse_rank((p.get("luckStrategy") or {}).get("rank")),
        "quiet_interactive": parse_rank((p.get("quietInteractive") or {}).get("rank")),
        "anyone_friends": parse_rank((p.get("toPlayWithAnyoneOnlyFriends") or {}).get("rank")),
    }


def main():
    print(f"Fetching catalog from GCS...")
    resp = requests.get(CATALOG_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    catalog_items = resp.json().get("items", [])
    print(f"  {len(catalog_items)} games in catalog")

    print(f"Fetching per-game page data ({WORKERS} workers)...")
    page_data: dict[str, dict] = {}
    done = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(fetch_page_data, g["id"], g["slug"]): g["id"]
            for g in catalog_items
        }
        for fut in as_completed(futures):
            game_id = futures[fut]
            result = fut.result()
            if result:
                page_data[game_id] = result
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{len(catalog_items)} fetched ({len(page_data)} with page data)")

    print(f"  Done: {len(page_data)}/{len(catalog_items)} had page data")

    games = [normalize_game(g, page_data.get(g["id"])) for g in catalog_items]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(games, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(games)} games → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
