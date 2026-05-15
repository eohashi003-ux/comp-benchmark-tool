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

type BenchmarkRow = {
  id?: string | number;
  family: string;
  level: string;
  p25: number;
  p50: number;
  p75: number;
  country?: string;
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

  if (salary <= p50)
    return 25 + 25 * ((salary - p25) / (p50 - p25));

  if (salary <= p75)
    return 50 + 25 * ((salary - p50) / (p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

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
          `${r.family}-${r.level}-${r.salary}` !==
          `${role.family}-${role.level}-${role.salary}`
      ),
    ].slice(0, 5);

    setRecentRoles(updated);
    localStorage.setItem(recentRolesKey, JSON.stringify(updated));
  };

  // ✅ FIXED + SAFE FETCH LOGIC
  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = (override?.family ?? family ?? "").trim();
    const selectedLevel = (override?.level ?? level ?? "").trim();
    const selectedSalary = override?.salary ?? salary;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("id,family,level,p25,p50,p75,country")
        .order("family", { ascending: true })
        .order("level", { ascending: true });

      // only apply filters if they exist
      if (selectedFamily) {
        query = query.ilike("family", `%${selectedFamily}%`);
      }

      if (selectedLevel) {
        query = query.ilike("level", `%${selectedLevel}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        return;
      }

      setRows((data ?? []) as BenchmarkRow[]);

      if (!override && selectedFamily && selectedLevel) {
        saveRole({
          job_title,
          family: selectedFamily,
          level: selectedLevel,
          salary: selectedSalary,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error");
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
    const currentSalary = Number(salary);

    return rows.map((row) => ({
      ...row,
      diffToMedian: currentSalary ? currentSalary - row.p50 : null,
      percentile: currentSalary
        ? estimatePercentile(currentSalary, row.p25, row.p50, row.p75)
        : null,
    }));
  }, [rows, salary]);

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
        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">

        {/* LEFT */}
        <aside className="space-y-4">

          <Card>
            <h2 className="text-lg font-semibold mb-4">
              Benchmark search
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <Label>Job title</Label>
                <Input value={job_title} onChange={(e) => setJobTitle(e.target.value)} />
              </div>

              <div>
                <Label>Family</Label>
                <Input value={family} onChange={(e) => setFamily(e.target.value)} />
              </div>

              <div>
                <Label>Level</Label>
                <Input value={level} onChange={(e) => setLevel(e.target.value)} />
              </div>

              <div>
                <Label>Salary</Label>
                <Input
                  type="number"
                  value={salary}
                  onChange={(e) =>
                    setSalary(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <Button type="submit" className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search />}
                Search
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Clock3 className="h-4 w-4" />
              Recent
            </h2>

            {recentRoles.length ? (
              recentRoles.map((r) => (
                <button
                  key={r.timestamp}
                  className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
                  onClick={() => fetchBenchmarks(r)}
                >
                  <div className="font-medium">{r.job_title}</div>
                  <div className="text-sm text-slate-600">
                    {r.family} / {r.level}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent searches</p>
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

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}

            {!loading && !results.length && (
              <p className="mt-4 text-sm text-slate-500">
                Run a search to see benchmarks
              </p>
            )}

            <div className="mt-4 space-y-3">
              {results.map((row, i) => (
                <div key={i} className="flex justify-between border rounded-lg p-4">
                  <div>
                    <div className="font-medium">{row.family}</div>
                    <div className="text-sm text-slate-500">{row.level}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">{money(row.p50)}</div>
                    <div className="text-xs text-slate-500">median</div>
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