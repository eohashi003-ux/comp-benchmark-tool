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

/* ================= HELPERS ================= */

function money(value: number | null | undefined) {
  if (typeof value !== "number") return "N/A";
  return currency.format(value);
}

function estimatePercentile(
  salary: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (salary <= p25) return 25 * (salary / p25);
  if (salary <= p50)
    return 25 + 25 * ((salary - p25) / (p50 - p25 || 1));
  if (salary <= p75)
    return 50 + 25 * ((salary - p50) / (p75 - p50 || 1));
  return 75 + 25 * ((salary - p75) / p75);
}

/* Normalize to 0 → 1 */

function normalizePosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0.1;
  if (value <= p50)
    return 0.1 + 0.4 * ((value - p25) / (p50 - p25 || 1));
  if (value <= p75)
    return 0.5 + 0.4 * ((value - p50) / (p75 - p50 || 1));
  return 0.9;
}

/* Bell curve path */

function getBellCurvePath(width: number, height: number) {
  const points = 40;
  let path = "";

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const x = t * width;

    const y =
      height *
      (1 - Math.exp(-Math.pow((t - 0.5) / 0.2, 2)));

    if (i === 0) path += `M ${x} ${height}`;
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

  /* ===== LOAD RECENT ===== */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentRolesKey);
      if (stored) setRecentRoles(JSON.parse(stored));
    } catch {
      localStorage.removeItem(recentRolesKey);
    }
  }, []);

  /* ===== SAVE RECENT ===== */
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

  /* ===== FETCH ===== */
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

      if (safeData.length === 0) {
        setError("No benchmark results found");
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

  /* ===== COMPUTED ===== */

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
          ? estimatePercentile(
              s,
              row.p25,
              row.p50,
              row.p75
            )
          : null,
    }));
  }, [rows, activeSalary]);

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">

        {/* LEFT PANEL */}
        <aside className="space-y-4">

          {/* SEARCH */}
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">

              <Input
                placeholder="Job title"
                value={job_title}
                onChange={(e) =>
                  setJobTitle(e.target.value)
                }
              />

              <Input
                placeholder="Family"
                value={family}
                onChange={(e) =>
                  setFamily(e.target.value)
                }
              />

              <Input
                placeholder="Level"
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value)
                }
              />

              <Input
                type="number"
                placeholder="Salary"
                value={salary}
                onChange={(e) =>
                  setSalary(
                    e.target.value
                      ? Number(e.target.value)
                      : ""
                  )
                }
              />

              <Button className="w-full">
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Search />
                )}
                Search
              </Button>
            </form>
          </Card>

          {/* ✅ RECENT SEARCHES FIXED */}
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clock3 className="h-4 w-4" />
              Recent Searches
            </h2>

            {recentRoles.length === 0 ? (
              <p className="text-sm text-slate-500">
                No recent searches
              </p>
            ) : (
              <div className="space-y-2">
                {recentRoles.map((r) => (
                  <button
                    key={r.timestamp}
                    onClick={() => fetchBenchmarks(r)}
                    className="w-full rounded-xl border p-3 text-left hover:bg-slate-100"
                  >
                    <div className="font-medium">
                      {r.job_title || "Untitled"}
                    </div>

                    <div className="text-sm text-slate-500">
                      {r.family} • {r.level}
                    </div>

                    <div className="text-sm font-medium text-emerald-700">
                      {money(
                        typeof r.salary === "number"
                          ? r.salary
                          : null
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </aside>

        {/* RIGHT */}
        <section>
          <Card>
            <h2 className="text-xl font-semibold flex gap-2">
              <BarChart3 /> Results
            </h2>

            <div className="mt-6 space-y-6">
              {results.map((row, idx) => {
                const width = 320;
                const height = 90;

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
                  <div key={idx} className="border p-5 rounded-xl">

                    {/* BELL CURVE */}
                    <svg
                      viewBox={`0 0 ${width} ${height}`}
                      className="w-full mt-6"
                    >
                      <path
                        d={getBellCurvePath(width, height)}
                        fill="#10b98133"
                      />

                      {/* MEDIAN LINE */}
                      <line
                        x1={width / 2}
                        x2={width / 2}
                        y1={0}
                        y2={height}
                        stroke="#111"
                      />

                      {/* ✅ USER SALARY LABEL + DOT */}
                      {userX !== null && (
                        <>
                          <circle
                            cx={userX}
                            cy={height * 0.35}
                            r="6"
                            fill="#10b981"
                            stroke="white"
                            strokeWidth="2"
                          />

                          <text
                            x={userX}
                            y={height * 0.2}
                            textAnchor="middle"
                            className="text-xs fill-slate-700 font-medium"
                          >
                            {money(activeSalary as number)}
                          </text>
                        </>
                      )}
                    </svg>

                    {/* LABELS */}
                    <div className="flex justify-between text-sm text-slate-500 mt-2">
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