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
    ].slice(0, 3);

    setRecentRoles(updated);
    localStorage.setItem(recentRolesKey, JSON.stringify(updated));
  };

  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = (override?.family ?? family).trim();
    const selectedLevel = (override?.level ?? level).trim();

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("id,family,level,p25,p50,p75")
        .order("family")
        .order("level");

      if (selectedFamily) {
        query = query.ilike("family", `%${selectedFamily}%`);
      }

      if (selectedLevel) {
        query = query.ilike("level", `%${selectedLevel}%`);
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
    } catch {
      setError("Unexpected error fetching data");
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
    const s = Number(salary);

    return rows.map((row) => ({
      ...row,
      diffToMedian: salary ? s - row.p50 : null,
      percentile: salary
        ? estimatePercentile(s, row.p25, row.p50, row.p75)
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

            <div className="mt-4 space-y-4">
              {results.map((r, i) => (
                <ResultRow key={i} row={r} salary={salary} />
              ))}
            </div>

          </Card>
        </section>

      </section>
    </main>
  );
}

/* ===========================
   PREMIUM RESULT CARD
=========================== */

function ResultRow({
  row,
  salary,
}: {
  row: BenchmarkResult;
  salary: number | "";
}) {
  const s = typeof salary === "number" ? salary : null;

  const min = row.p25;
  const max = row.p75;
  const range = max - min;

  const clamp = (val: number) =>
    Math.min(100, Math.max(0, val));

  const getPos = (value: number | null) => {
    if (value === null) return null;
    return clamp(((value - min) / range) * 100);
  };

  const youPos = s ? getPos(s) : null;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">

      {/* HEADER */}
      <div className="flex justify-between">
        <div>
          <div className="text-sm text-slate-500">{row.family}</div>
          <div className="text-lg font-semibold">{row.level}</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-slate-500">Median</div>
          <div className="text-xl font-semibold">
            £{row.p50.toLocaleString()}
          </div>
        </div>
      </div>

      {/* BAR */}
      <div className="relative h-10">

        <div className="absolute top-4 left-0 right-0 h-2 bg-slate-100 rounded-full" />

        {/* YOU */}
        {youPos !== null && (
          <div
            className="absolute top-0"
            style={{
              left: `${youPos}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow" />
            <div className="text-[10px] text-blue-600 text-center">
              You
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex justify-between text-xs text-slate-500">
        <div>P25: £{row.p25.toLocaleString()}</div>
        <div>P75: £{row.p75.toLocaleString()}</div>
      </div>

    </div>
  );
}