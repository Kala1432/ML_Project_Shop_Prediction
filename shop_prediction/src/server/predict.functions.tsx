import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OVERPASS = "https://overpass-api.de/api/interpreter";

const InputSchema = z.object({
  place: z.string().min(2).max(120),
  shopType: z.string().min(2).max(40),
});

export type Prediction = {
  lat: number;
  lon: number;
  score: number;
  demand: number;
  competitors: number;
  rank: number;
};

export type PredictResult = {
  place: string;
  shopType: string;
  bbox: [number, number, number, number]; // s,w,n,e
  competitorCount: number;
  demandCount: number;
  predictions: Prediction[];
  error?: string;
};

// Demand proxy tags = signs of foot traffic / population
const DEMAND_QUERIES = [
  'node["amenity"="school"]',
  'node["amenity"="university"]',
  'node["amenity"="office"]',
  'node["office"]',
  'node["public_transport"="station"]',
  'node["railway"="station"]',
  'node["amenity"="hospital"]',
];

async function geocode(place: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
  const r = await fetch(url, { headers: { "User-Agent": "lovable-shop-predictor/1.0" } });
  if (!r.ok) throw new Error(`Geocoding failed (${r.status})`);
  const j = (await r.json()) as Array<{ lat: string; lon: string; boundingbox: string[]; display_name: string }>;
  if (!j.length) throw new Error("Place not found");
  const bb = j[0].boundingbox.map(Number); // [south, north, west, east]
  // clamp box to reasonable size (~25km)
  const s = bb[0], n = bb[1], w = bb[2], e = bb[3];
  const cLat = (s + n) / 2, cLon = (w + e) / 2;
  const maxHalf = 0.12;
  const halfLat = Math.min((n - s) / 2, maxHalf);
  const halfLon = Math.min((e - w) / 2, maxHalf);
  return {
    displayName: j[0].display_name,
    bbox: [cLat - halfLat, cLon - halfLon, cLat + halfLat, cLon + halfLon] as [number, number, number, number],
  };
}

async function overpass(query: string): Promise<Array<{ lat: number; lon: number }>> {
  const r = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "lovable-shop-predictor/1.0" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { elements: Array<{ type: string; lat?: number; lon?: number; center?: { lat: number; lon: number } }> };
  const pts: Array<{ lat: number; lon: number }> = [];
  for (const el of j.elements) {
    if (el.type === "node" && el.lat != null && el.lon != null) pts.push({ lat: el.lat, lon: el.lon });
    else if (el.center) pts.push({ lat: el.center.lat, lon: el.center.lon });
  }
  return pts;
}

function hav(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const predictShopLocations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<PredictResult> => {
    try {
      const { displayName, bbox } = await geocode(data.place);
      const [s, w, n, e] = bbox;

      const competitorQ = `[out:json][timeout:40];(node["amenity"="${data.shopType}"](${s},${w},${n},${e});way["amenity"="${data.shopType}"](${s},${w},${n},${e}););out center 400;`;
      const demandQ = `[out:json][timeout:40];(${DEMAND_QUERIES.map((q) => `${q}(${s},${w},${n},${e});`).join("")});out 400;`;

      const [competitors, demand] = await Promise.all([overpass(competitorQ), overpass(demandQ)]);

      const grid = 14;
      const radius = 0.7; // km decay
      const candidates: Prediction[] = [];
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const lat = s + ((n - s) * (i + 0.5)) / grid;
          const lon = w + ((e - w) * (j + 0.5)) / grid;
          let dScore = 0;
          for (const p of demand) dScore += Math.exp(-hav(lat, lon, p.lat, p.lon) / radius);
          let cScore = 0;
          for (const p of competitors) cScore += Math.exp(-hav(lat, lon, p.lat, p.lon) / radius);
          candidates.push({
            lat: +lat.toFixed(5),
            lon: +lon.toFixed(5),
            demand: +dScore.toFixed(2),
            competitors: +cScore.toFixed(2),
            score: +(dScore - 1.4 * cScore).toFixed(2),
            rank: 0,
          });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates.slice(0, 8).map((c, i) => ({ ...c, rank: i + 1 }));

      return {
        place: displayName,
        shopType: data.shopType,
        bbox,
        competitorCount: competitors.length,
        demandCount: demand.length,
        predictions: top,
      };
    } catch (err) {
      return {
        place: data.place,
        shopType: data.shopType,
        bbox: [0, 0, 0, 0],
        competitorCount: 0,
        demandCount: 0,
        predictions: [],
        error: err instanceof Error ? err.message : "Prediction failed",
      };
    }
  });
