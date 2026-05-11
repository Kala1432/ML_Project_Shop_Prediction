import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { predictShopLocations, type PredictResult } from "@/server/predict.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShopMapLazy as ShopMap } from "@/components/ShopMapLazy";
import {
  MapPin, TrendingUp, Loader2, Sparkles, Store, Target, Activity,
  ArrowRight, ExternalLink, Search, Compass,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ShopScout — AI Location Intelligence for New Stores" },
      {
        name: "description",
        content: "Predict the best locations to open a new shop in any city worldwide. Real OpenStreetMap data, demand vs competitor scoring, interactive map.",
      },
      { property: "og:title", content: "ShopScout — Where should you open your next shop?" },
      { property: "og:description", content: "Real-data location intelligence powered by OpenStreetMap." },
    ],
  }),
});

const SHOP_TYPES = [
  { value: "cafe", label: "Café", emoji: "☕" },
  { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { value: "fast_food", label: "Fast food", emoji: "🍔" },
  { value: "bar", label: "Bar", emoji: "🍸" },
  { value: "pharmacy", label: "Pharmacy", emoji: "💊" },
  { value: "bakery", label: "Bakery", emoji: "🥖" },
  { value: "supermarket", label: "Supermarket", emoji: "🛒" },
  { value: "clothes", label: "Clothing store", emoji: "👕" },
  { value: "books", label: "Bookstore", emoji: "📚" },
  { value: "gym", label: "Gym", emoji: "🏋️" },
];

type Suggestion = { display_name: string; lat: string; lon: string };

function Index() {
  const [place, setPlace] = useState("");
  const [shopType, setShopType] = useState("cafe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Autocomplete via Nominatim
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (place.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(place)}`,
          { headers: { Accept: "application/json" } }
        );
        if (r.ok) {
          const data = (await r.json()) as Suggestion[];
          setSuggestions(data);
        }
      } catch {
        /* ignore */
      }
    }, 300);
  }, [place]);

  async function runPredict(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setSelectedRank(null);
    setShowSugg(false);
    try {
      const r = await predictShopLocations({ data: { place: query, shopType } });
      setResult(r);
      setSelectedRank(r.predictions[0]?.rank ?? null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setResult({
        place: query, shopType, bbox: [0, 0, 0, 0],
        competitorCount: 0, demandCount: 0, predictions: [],
        error: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const shop = SHOP_TYPES.find((s) => s.value === shopType)!;

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-border/40 backdrop-blur-xl bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 max-w-7xl h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Compass className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">ShopScout</span>
            <Badge variant="outline" className="ml-2 text-[10px] border-primary/40 text-primary bg-primary/5">BETA</Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-smooth">How it works</a>
            <a href="#predictor" className="hover:text-foreground transition-smooth">Predictor</a>
            <a href="https://www.openstreetmap.org/about" target="_blank" rel="noreferrer" className="hover:text-foreground transition-smooth flex items-center gap-1">
              Data source <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-6 pt-16 pb-10 max-w-7xl">
          <Badge variant="outline" className="mb-6 border-primary/40 text-primary bg-primary/5 backdrop-blur">
            <Sparkles className="w-3 h-3 mr-1.5" /> Live data · 50+ million POIs worldwide
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Predict where to open<br />
            <span className="bg-gradient-to-br from-primary via-primary-glow to-accent bg-clip-text text-transparent">your next shop.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            ShopScout scans real demand signals — schools, offices, transit hubs —
            against existing competitor density to recommend the best
            neighborhoods for any kind of store, in any city worldwide.
          </p>

          {/* Search bar */}
          <Card id="predictor" className="mt-10 bg-gradient-card backdrop-blur-xl border-border/60 shadow-elegant p-4 md:p-5 max-w-4xl">
            <div className="grid md:grid-cols-[1fr_220px_auto] gap-3 items-stretch">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={place}
                  onChange={(e) => { setPlace(e.target.value); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  onKeyDown={(e) => { if (e.key === "Enter") runPredict(place); }}
                  placeholder="Search any city — e.g. Brooklyn, NY"
                  className="bg-input/60 border-border/60 h-12 pl-10 text-base"
                />
                {showSugg && suggestions.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-elegant z-20 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onMouseDown={(e) => { e.preventDefault(); setPlace(s.display_name); setSuggestions([]); runPredict(s.display_name); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 flex items-center gap-2 border-b border-border/40 last:border-0 transition-smooth"
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{s.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Select value={shopType} onValueChange={setShopType}>
                <SelectTrigger className="bg-input/60 border-border/60 h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHOP_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="mr-2">{s.emoji}</span>{s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => runPredict(place)}
                disabled={loading || !place.trim()}
                size="lg"
                className="bg-gradient-primary text-primary-foreground hover:opacity-95 transition-smooth shadow-glow h-12 px-7 font-semibold"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : <><Target className="w-4 h-4 mr-2" />Predict</>}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-xs text-muted-foreground self-center mr-1">Try:</span>
              {["Austin, TX", "Berlin, Germany", "Bangalore, India", "Lisbon, Portugal", "Tokyo, Japan"].map((c) => (
                <button
                  key={c}
                  onClick={() => { setPlace(c); runPredict(c); }}
                  className="text-xs px-3 py-1 rounded-full bg-secondary/60 hover:bg-secondary border border-border/40 hover:border-primary/40 transition-smooth"
                >
                  {c}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Results */}
      <section ref={resultsRef} className="container mx-auto px-6 max-w-7xl pb-16">
        {loading && (
          <Card className="bg-gradient-card border-border/40 p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <div className="font-medium">Scanning the city…</div>
            <p className="text-sm text-muted-foreground mt-1">Pulling competitor &amp; demand data from OpenStreetMap (10–30s)</p>
          </Card>
        )}

        {result && !loading && result.error && (
          <Card className="p-6 border-destructive/40 bg-destructive/10">
            <p className="text-destructive font-medium">⚠ {result.error}</p>
            <p className="text-sm text-muted-foreground mt-1">Try a more specific place name (e.g. "Brooklyn, NY") or another shop type.</p>
          </Card>
        )}

        {result && !loading && !result.error && (
          <>
            {/* Stats */}
            <div className="grid sm:grid-cols-4 gap-3 mb-6">
              <StatCard icon={<MapPin className="w-4 h-4" />} label="Area" value={result.place.split(",").slice(0, 2).join(",")} />
              <StatCard icon={<Store className="w-4 h-4" />} label={`Existing ${shop.label.toLowerCase()}s`} value={result.competitorCount.toString()} accent="warning" />
              <StatCard icon={<Activity className="w-4 h-4" />} label="Demand signals" value={result.demandCount.toString()} accent="success" />
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Top score" value={result.predictions[0]?.score.toFixed(1) ?? "—"} accent="primary" />
            </div>

            {/* Map + sidebar */}
            <div className="grid lg:grid-cols-[1fr_380px] gap-5 h-[640px]">
              <div className="h-full min-h-[400px]">
                <ShopMap
                  bbox={result.bbox}
                  predictions={result.predictions}
                  selectedRank={selectedRank}
                  onSelect={setSelectedRank}
                />
              </div>
              <Card className="bg-gradient-card border-border/40 p-0 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="font-bold flex items-center gap-2">
                    <span>{shop.emoji}</span> Top {result.predictions.length} {shop.label} spots
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Click a card or marker to focus</p>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border/30">
                  {result.predictions.map((p) => (
                    <button
                      key={p.rank}
                      onClick={() => setSelectedRank(p.rank)}
                      className={`w-full text-left p-4 transition-smooth hover:bg-accent/5 ${
                        selectedRank === p.rank ? "bg-primary/10 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-lg bg-gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center shadow-glow"
                            style={{ opacity: 0.55 + Math.min(0.45, p.score / 16) }}
                          >#{p.rank}</div>
                          <div>
                            <div className="font-mono text-xs">{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
                            <div className="text-[11px] text-muted-foreground">opportunity score</div>
                          </div>
                        </div>
                        <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 font-semibold">
                          {p.score.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <Bar label="Demand" value={p.demand} max={Math.max(...result.predictions.map(x => x.demand))} color="success" />
                        <Bar label="Comp." value={p.competitors} max={Math.max(...result.predictions.map(x => x.competitors), 1)} color="warning" />
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-glow transition-smooth"
                      >
                        Open in Google Maps <ArrowRight className="w-3 h-3" />
                      </a>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div id="how" className="mt-8">
            <h2 className="text-2xl font-bold mb-1">How ShopScout works</h2>
            <p className="text-sm text-muted-foreground mb-6">Three steps, real data, zero setup.</p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: <MapPin className="w-5 h-5" />, title: "Pick a city", text: "We geocode your query and scan a ~25 km bounding box around it." },
                { icon: <Activity className="w-5 h-5" />, title: "Pull live signals", text: "OpenStreetMap gives us competitors plus demand drivers (schools, offices, transit, hospitals)." },
                { icon: <Target className="w-5 h-5" />, title: "Score every block", text: "A heuristic with distance decay ranks each grid cell: demand minus weighted competitor density." },
              ].map((s, i) => (
                <Card key={i} className="bg-gradient-card border-border/40 p-6 hover:border-primary/40 transition-smooth">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
                    {s.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        Map tiles © <a className="hover:text-primary" href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a> ·
        Data © <a className="hover:text-primary" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"> OpenStreetMap contributors</a> ·
        Predictions are heuristic estimates — validate locally before investing.
      </footer>
    </main>
  );
}

function StatCard({ icon, label, value, accent = "primary" }: { icon: React.ReactNode; label: string; value: string; accent?: "primary" | "success" | "warning" }) {
  const tone = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary";
  return (
    <Card className="bg-gradient-card border-border/40 p-4">
      <div className={`flex items-center gap-1.5 ${tone} text-[10px] uppercase tracking-wider mb-1.5 font-semibold`}>
        {icon} {label}
      </div>
      <div className="text-lg font-bold truncate">{value}</div>
    </Card>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: "success" | "warning" }) {
  const pct = Math.min(100, (value / Math.max(max, 0.1)) * 100);
  const bg = color === "success" ? "bg-success" : "bg-warning";
  return (
    <div className="flex-1">
      <div className="flex justify-between text-muted-foreground mb-1">
        <span>{label}</span><span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-background/60 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
