"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Clock3,
  Loader2,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import Card from "@/components/Card";
import Button from "@/components/Button";

import { supabase } from "@/lib/supabase";

/* ================= TYPES ================= */

type BenchmarkRow = {
  id?: string | number;
  family: string;
  sub_family?: string | null;
  level: string;
  p25: number;
  p50: number;
  p75: number;
};

type RoleQuery = {
  job_title: string;
  family: string;
  sub_family?: string;
  level: string;
  salary: number | "";
  timestamp: number;
};

type BenchmarkResult = BenchmarkRow & {
  diffToMedian: number | null;
  percentile: number | null;
};

/* ================= CONSTANTS ================= */

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const recentRolesKey = "recentRoles";

const FAMILY_OPTIONS = [
  "Finance",
  "HR",
  "Engineering",
  "Sales",
];

const SUB_FAMILY_OPTIONS: Record<string, string[]> = {
  Engineering: ["Software", "Data", "Infrastructure", "Security"],
  Finance: ["FP&A", "Accounting", "Treasury", "Tax"],
  HR: ["Talent Acquisition", "People Operations", "Reward"],
  Sales: ["Enterprise", "SMB", "Partnerships"],
};

const LEVEL_OPTIONS = ["L1", "L2", "L3", "L4"];

/* ================= HELPERS ================= */

function money(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }
  return currency.format(value);
}

function estimatePercentile(
  salary: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (!p25 || !p50 || !p75) return null;

  if (salary <= p25) return Math.max(0, 25 * (salary / p25));
  if (salary <= p50)
    return 25 + 25 * ((salary - p25) / Math.max(1, p50 - p25));
  if (salary <= p75)
    return 50 + 25 * ((salary - p50) / Math.max(1, p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

/* ===== NEW: Normalize value for curve ===== */

function normalizePosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0.1;
  if (value <= p50)
    return 0.1 + 0.4 * ((value - p25) / Math.max(1, p50 - p25));
  if (value <= p75)
    return 0.5 + 0.4 * ((value - p50) / Math.max(1, p75 - p50));
  return 0.9;
}

/* ===== NEW: Bell curve generator ===== */

function getBellCurvePath(width: number, height: number) {
  const points = 40;
  let path = "";

  for (let i = 0; i <= points; i++) {
    const t = i / points;

    // Gaussian-like curve centered at 0.5
    const x = t * width;
    const y =
      height *
      (1 -
        Math.exp(-Math.pow((t - 0.5) / 0.2, 2)));

    if (i === 0) {
      path += `M ${x} ${height}`;
    }

    path += ` L ${x} ${y}`;
  }

  path += ` L ${width} ${height} Z`;

  return path;
}

/* ================= COMPONENT ================= */

export default function Home() {
  const [job_title, setJobTitle] = useState("");
  const [family, setFamily] = useState("");
  const [sub_family, setSubFamily] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState<number | "">("");

  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [recentRoles, setRecentRoles] = useState<RoleQuery[]>([]);
  const [activeSalary, setActiveSalary] = useState<number | "">("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentRolesKey);
      if (stored) setRecentRoles(JSON.parse(stored));
    } catch {
      localStorage.removeItem(recentRolesKey);
    }
  }, []);

  const saveRole = (role: RoleQuery) => {
    const updated = [
      role,
      ...recentRoles.filter(
        (r) =>
          `${r.family}-${r.sub_family}-${r.level}-${r.salary}` !==
          `${role.family}-${role.sub_family}-${role.level}-${role.salary}`
      ),
    ].slice(0, 3);

    setRecentRoles(updated);
    localStorage.setItem(recentRolesKey, JSON.stringify(updated));
  };

  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = (override?.family ?? family).trim();
    const selectedSubFamily =
      (override?.sub_family ?? sub_family ?? "").trim();
    const selectedLevel = (override?.level ?? level).trim();
    const selectedSalary = override?.salary ?? salary;

    setActiveSalary(selectedSalary);
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("id,family,sub_family,level,p25,p50,p75");

      if (selectedFamily) query = query.eq("family", selectedFamily);
      if (selectedSubFamily)
        query = query.eq("sub_family", selectedSubFamily);
      if (selectedLevel) query = query.eq("level", selectedLevel);

      const { data, error } = await query.limit(1);

      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }

      const safeData = data ?? [];
      setRows(safeData);

      if (safeData.length === 0)
        setError("No benchmark results found");

      if (!override && selectedFamily && selectedLevel) {
        saveRole({
          job_title,
          family: selectedFamily,
          sub_family: selectedSubFamily,
          level: selectedLevel,
          salary: selectedSalary,
          timestamp: Date.now(),
        });
      }
    } catch {
      setError("Unexpected error loading data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchBenchmarks();
  };

  const results = useMemo<BenchmarkResult[]>(() => {
    const s =
      typeof activeSalary === "number" ? activeSalary : 0;

    return rows.map((row) => ({
      ...row,
      diffToMedian:
        typeof activeSalary === "number"
          ? s - row.p50
          : null,
      percentile:
        typeof activeSalary === "number"
          ? estimatePercentile(s, row.p25, row.p50, row.p75)
          : null,
    }));
  }, [rows, activeSalary]);

  const availableSubFamilies =
    SUB_FAMILY_OPTIONS[family] || [];

  /* ================= RENDER ================= */

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Badge className="mb-3 bg-emerald-100 text-emerald-900">
            Market Intelligence
          </Badge>

          <h1 className="text-3xl font-semibold">
            Market Benchmark Tool
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Compare salaries against market benchmarks.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT SIDE (UNCHANGED) */}
        <aside className="space-y-4">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">
              Search
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Job Title</Label>
                <Input
                  value={job_title}
                  onChange={(e) =>
                    setJobTitle(e.target.value)
                  }
                />
              </div>

              <div>
                <Label>Family</Label>
                <select
                  value={family}
                  onChange={(e) => {
                    setFamily(e.target.value);
                    setSubFamily("");
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select family</option>
                  {FAMILY_OPTIONS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Sub Family</Label>
                <select
                  value={sub_family}
                  onChange={(e) =>
                    setSubFamily(e.target.value)
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  {availableSubFamilies.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Level</Label>
                <select
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value)
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select level</option>
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Salary</Label>
                <Input
                  type="number"
                  value={salary}
                  onChange={(e) =>
                    setSalary(
                      e.target.value
                        ? Number(e.target.value)
                        : ""
                    )
                  }
                />
              </div>

              <Button className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </form>
          </Card>
        </aside>

        {/* RIGHT */}
        <section>
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5" />
              Results
            </h2>

            <div className="mt-6 space-y-6">
              {results.map((row, idx) => {
                const width = 300;
                const height = 80;

                const userX =
                  typeof activeSalary === "number"
                    ? normalizePosition(
                        activeSalary,
                        row.p25,
                        row.p50,
                        row.p75
                      ) * width
                    : null;

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border p-5"
                  >
                    <h3 className="font-semibold">
                      {row.family} {row.level}
                    </h3>

                    {/* BELL CURVE */}
                    <svg
                      width="100%"
                      height={height}
                      viewBox={`0 0 ${width} ${height}`}
                      className="mt-6"
                    >
                      <defs>
                        <linearGradient id="curveFade">
                          <stop
                            offset="0%"
                            stopColor="#a7f3d0"
                          />
                          <stop
                            offset="100%"
                            stopColor="#10b981"
                          />
                        </linearGradient>
                      </defs>

                      <path
                        d={getBellCurvePath(width, height)}
                        fill="url(#curveFade)"
                        opacity="0.6"
                      />

                      {/* Median Line */}
                      <line
                        x1={width / 2}
                        x2={width / 2}
                        y1={0}
                        y2={height}
                        stroke="#111"
                      />

                      {/* User marker */}
                      {userX !== null && (
                        <circle
                          cx={userX}
                          cy={height * 0.35}
                          r="6"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="2"
                        />
                      )}
                    </svg>

                    <div className="mt-3 text-sm text-slate-500 flex justify-between">
                      <span>P25 {money(row.p25)}</span>
                      <span>P50 {money(row.p50)}</span>
                      <span>P75 {money(row.p75)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}