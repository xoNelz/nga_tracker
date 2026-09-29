#!/usr/bin/env python3
"""Build zoom-tier geography data for Naija Player Tracker (spec section 16).

Downloads Natural Earth 50m admin-0 countries and 50m populated places,
simplifies them, and writes region-scoped files under public/data/:

  public/data/regions/<continent>.geojson   50m country boundaries per continent
  public/data/country-index.json            iso3 -> continent id
  public/data/continents.json               continent id/name + label anchor
  public/data/cities.json                   major cities (capitals or pop > 1M)

Design notes (match the spec amendment):
- Zoom tiers stay on the globe; there is no flat-map transition.
- Region files keep the WorldData shape ({features[].properties.name/iso3,
  geometry}) so lib/globe/texture.ts and selection.ts work unchanged.
- Each feature gains a precomputed `label: [lon, lat]` anchor (largest-ring
  area centroid) for the HTML label overlay.
- Coordinates are quantized to 4 decimals (~11m) and simplified with
  Douglas-Peucker; region files target < 500KB each for lazy loading.

Run: python3 scripts/build-geo-tiers.py
Requires: Python 3.11+ stdlib only. Network access to raw.githubusercontent.com.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data")
REGIONS_DIR = os.path.join(OUT, "regions")

COUNTRIES_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_admin_0_countries.geojson"
)
CITIES_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_populated_places.geojson"
)

# Natural Earth CONTINENT attribute -> our continent ids.
CONTINENT_IDS = {
    "Africa": "africa",
    "Asia": "asia",
    "Europe": "europe",
    "North America": "north-america",
    "South America": "south-america",
    "Oceania": "oceania",
    "Antarctica": "antarctica",
}

# Fallback iso3 when the source uses the "-99" placeholder.
ISO3_FALLBACK_KEYS = ("ADM0_A3", "ISO_A3_EH", "GU_A3")


def fetch_json(url: str) -> dict:
    # curl is used over urllib: it reliably traverses the sandbox egress proxy.
    out = subprocess.run(
        ["curl", "-sS", "-L", "--max-time", "180", "-A",
         "naija-player-tracker/1.0", url],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def iso3_of(props: dict) -> str | None:
    for key in ("ISO_A3", *ISO3_FALLBACK_KEYS):
        value = props.get(key)
        if value and value != "-99":
            return value
    return None


def perp_distance(px, py, ax, ay, bx, by) -> float:
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(points: list, tolerance: float) -> list:
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        ax, ay = points[first]
        bx, by = points[last]
        worst, index = 0.0, -1
        for i in range(first + 1, last):
            d = perp_distance(points[i][0], points[i][1], ax, ay, bx, by)
            if d > worst:
                worst, index = d, i
        if worst > tolerance:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))
    return [p for p, k in zip(points, keep) if k]


def quantize(value: float) -> float:
    return round(value, 4)


def simplify_ring(ring: list, tolerance: float) -> list:
    closed = ring[0] == ring[-1]
    work = ring[:-1] if closed else ring
    # Work in a degree space scaled by cos(latitude) so tolerance is ~metric.
    lat0 = sum(p[1] for p in work) / len(work)
    scale = max(0.2, math.cos(math.radians(lat0)))
    scaled = [(p[0] * scale, p[1]) for p in work]
    kept = douglas_peucker(scaled, tolerance)
    out = [[quantize(p[0] / scale), quantize(p[1])] for p in kept]
    if closed and out:
        out.append(out[0][:])
    return out if len(out) >= 4 else [[quantize(p[0]), quantize(p[1])] for p in ring]


def ring_area(ring: list) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def ring_centroid(ring: list) -> tuple[float, float]:
    sx = sy = 0.0
    for x, y in ring:
        sx += x
        sy += y
    n = len(ring)
    return (sx / n, sy / n)


def polygons_of(geometry: dict) -> list:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    return []


def label_anchor(geometry: dict) -> list:
    best: tuple[float, tuple[float, float]] | None = None
    for polygon in polygons_of(geometry):
        for ring in polygon:
            area = ring_area(ring)
            if best is None or area > best[0]:
                best = (area, ring_centroid(ring))
    if best is None:
        return [0.0, 0.0]
    lon, lat = best[1]
    return [quantize(lon), quantize(max(-85.0, min(85.0, lat)))]


def main() -> int:
    os.makedirs(REGIONS_DIR, exist_ok=True)

    print("downloading 50m countries…", flush=True)
    countries = fetch_json(COUNTRIES_URL)
    print("downloading 50m populated places…", flush=True)
    places = fetch_json(CITIES_URL)

    by_continent: dict[str, list] = {cid: [] for cid in CONTINENT_IDS.values()}
    country_index: dict[str, str] = {}
    skipped = 0

    for feature in countries["features"]:
        props = feature.get("properties", {})
        name = props.get("NAME") or props.get("ADMIN")
        iso3 = iso3_of(props)
        continent = CONTINENT_IDS.get(props.get("CONTINENT", ""))
        if not name or not iso3 or not continent:
            skipped += 1
            continue
        anchor = label_anchor(feature["geometry"])
        out_feature = {
            "type": "Feature",
            "properties": {"name": name, "iso3": iso3, "label": anchor},
            "geometry": {"type": "MultiPolygon", "coordinates": []},
        }
        polys = []
        for polygon in polygons_of(feature["geometry"]):
            simp = [simplify_ring(ring, 0.02) for ring in polygon]
            simp = [r for r in simp if len(r) >= 4]
            if simp:
                polys.append(simp)
        if not polys:
            skipped += 1
            continue
        out_feature["geometry"]["coordinates"] = polys
        by_continent[continent].append(out_feature)
        country_index[iso3] = continent

    # The UK constituent chooser (destinations.ts) keys off GBR; keep the
    # sovereign feature but make sure the index is complete.
    for continent_id, features in by_continent.items():
        features.sort(key=lambda f: f["properties"]["name"])
        path = os.path.join(REGIONS_DIR, f"{continent_id}.geojson")
        with open(path, "w") as fh:
            json.dump({"type": "FeatureCollection", "features": features}, fh)
        size_kb = os.path.getsize(path) // 1024
        print(f"  {continent_id}: {len(features)} countries, {size_kb}KB", flush=True)

    continents = []
    for label, cid in CONTINENT_IDS.items():
        feats = by_continent[cid]
        if feats:
            lon = sum(f["properties"]["label"][0] for f in feats) / len(feats)
            lat = sum(f["properties"]["label"][1] for f in feats) / len(feats)
        else:
            lon, lat = 0.0, 0.0
        continents.append(
            {"continent_id": cid, "continent_name": label,
             "label": [quantize(lon), quantize(lat)]}
        )
    with open(os.path.join(OUT, "continents.json"), "w") as fh:
        json.dump(continents, fh)
    with open(os.path.join(OUT, "country-index.json"), "w") as fh:
        json.dump(country_index, fh, sort_keys=True)

    cities = []
    for feature in places["features"]:
        props = feature.get("properties", {})
        try:
            pop = float(props.get("POP_MAX") or 0)
        except (TypeError, ValueError):
            pop = 0
        is_capital = str(props.get("ADM0CAP")) == "1"
        if pop < 1_000_000 and not is_capital:
            continue
        coords = feature["geometry"]["coordinates"]
        cities.append({
            "name": props.get("NAMEASCII") or props.get("NAME"),
            "iso3": iso3_of(props),
            "lon": quantize(coords[0]),
            "lat": quantize(coords[1]),
            "capital": is_capital,
            "pop": int(pop),
        })
    cities.sort(key=lambda c: c["name"])
    with open(os.path.join(OUT, "cities.json"), "w") as fh:
        json.dump(cities, fh)
    print(f"cities: {len(cities)} (capitals or pop > 1M)", flush=True)
    print(f"skipped {skipped} country features (missing name/iso3/continent)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
