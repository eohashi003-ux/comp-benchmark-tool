"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

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

/* ---------------- TYPES ---------------- */

type BenchmarkRow = {
  id?: string | number;
  family: string;
  level: string;
  p25: number;
  p50: number;
  p75: number;
};

type RoleQuery = {
  job_title: string;
  family: string;
  level: string;
  salary: number | "";
  timestamp: number;
};

type BenchmarkResult = BenchmarkRow & {
  diffToMedian: number | null;
  percentile: number | null;
};

/* ---------------- DROPDOWNS (DB ALIGNED) ---------------- */

const FAMILIES = ["Finance", "HR", "Engineering", "Sales"];
const LEVELS = ["L1", "L2", "L3", "L4"];

/* ---------------- HELPERS ---------------- */

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const recentRolesKey = "recentRoles";

function money(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
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
  if (salary <= p50) return 25 + 25 * ((salary - p25) / (p50 - p25));
  if (salary <= p75) return 50 + 25 * ((salary - p50) / (p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

/* ---------------- COMPONENT ---------------- */

export default function Home() {
  const [job_title, setJobTitle] = useState("");
  const [family, setFamily] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState<number | "">("");

  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [recentRoles, setRecentRoles] = useState<RoleQuery[]>([]);

  /* -------- recent load -------- */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentRolesKey);
      if (stored) setRecentRoles(JSON.parse(stored));
    } catch {
      localStorage.removeItem(recentRolesKey);
    }
  }, []);

  /* -------- save recent -------- */
  const saveRole = (role: RoleQuery) => {
    const updated = [
      role,
      ...recentRoles.filter(
        (r) =>
          `${r.family}-${r.level}-${r.salary}` !==
          `${role.family}-${role.level}-${role.salary}`
      ),
    ].slice(0, 3);

    setRecentRoles(updated);
    localStorage.setItem(recentRolesKey, JSON.stringify(updated));
  };

  /* -------- fetch -------- */
  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = (override?.family ?? family).trim();
    const selectedLevel = (override?.level ?? level).trim();

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("id,family,level,p25,p50,p75");

      /* SAFE EXACT MATCHES (recommended for DB schema) */
      if (selectedFamily) {
        query = query.eq("family", selectedFamily);
      }

      if (selectedLevel) {
        query = query.eq("level", selectedLevel);
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }

      const safe = data ?? [];
      setRows(safe);

      if (!override && selectedFamily && selectedLevel) {
        saveRole({
          job_title,
          family: selectedFamily,
          level: selectedLevel,
          salary,
          timestamp: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchBenchmarks();
  };

  /* -------- derived -------- */
  const results = useMemo<BenchmarkResult[]>(() => {
    const s = Number(salary);

    return rows.map((row) => ({
      ...row,
      diffToMedian: salary ? s - row.p50 : null,
      percentile: salary
        ? estimatePercentile(s, row.p25, row.p50, row.p75)
        : null,
    }));
  }, [rows, salary]);

  /* ---------------- UI ---------------- */

  return (
    <main className="min-h-screen bg-gray-50 text-slate-950">

      {/* HEADER */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Badge className="mb-3 bg-emerald-100 text-emerald-900">
            Market intelligence
          </Badge>

          <h1 className="text-3xl font-semibold">
            Market Benchmark Tool
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Compare roles against market salary data.
          </p>
        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">

        {/* LEFT */}
        <aside className="space-y-4">

          <Card>
            <h2 className="mb-4 font-semibold">Search</h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <Label>Job title</Label>
                <Input
                  value={job_title}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              {/* FAMILY DROPDOWN */}
              <div>
                <Label>Family</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                >
                  <option value="">All families</option>
                  {FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* LEVEL DROPDOWN */}
              <div>
                <Label>Level</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="">All levels</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Salary</Label>
                <Input
                  type="number"
                  value={salary}
                  onChange={(e) =>
                    setSalary(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>

              <Button type="submit" className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search />
                )}
                Search
              </Button>
            </form>
          </Card>

          {/* RECENT */}
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" /> Recent
            </h2>

            {recentRoles.length === 0 ? (
              <p className="text-sm text-slate-500">
                No recent searches
              </p>
            ) : (
              recentRoles.map((r) => (
                <button
                  key={r.timestamp}
                  className="w-full rounded border p-2 text-left hover:bg-gray-50"
                  onClick={() => {
                    setJobTitle(r.job_title);
                    setFamily(r.family);
                    setLevel(r.level);
                    setSalary(r.salary);
                    fetchBenchmarks(r);
                  }}
                >
                  <div className="font-medium">{r.job_title}</div>
                  <div className="text-xs text-slate-500">
                    {r.family} / {r.level} / {money(r.salary)}
                  </div>
                </button>
              ))
            )}
          </Card>
        </aside>

        {/* RIGHT */}
        <section>
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5" />
              Results
            </h2>

            {loading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </p>
            )}

            {!loading && searched && results.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">
                No results found
              </p>
            )}

            <div className="mt-4 space-y-3">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex justify-between rounded border p-3"
                >
                  <div>
                    <div className="font-medium">{r.family}</div>
                    <div className="text-xs text-slate-500">
                      {r.level}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center min-w-[260px]">

                    <div>
                      <div className="text-xs text-slate-500">P25</div>
                      <div className="font-medium">{money(r.p25)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">P50</div>
                      <div className="font-semibold">{money(r.p50)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">P75</div>
                      <div className="font-medium">{money(r.p75)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-emerald-600">You</div>
                      <div className="font-semibold text-emerald-700">
                        {money(salary)}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

      </section>
    </main>
  );
}