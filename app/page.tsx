"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock3,
  Loader2,
  Search,
  Sparkles,
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
  job-title: string;
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

function normalise(value: string) {
  return value.trim().toLowerCase();
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? currency.format(value)
    : "N/A";
}

function estimatePercentile(salary: number, p25: number, p50: number, p75: number) {
  if (!p25 || !p50 || !p75) return null;
  if (salary <= p25) return Math.max(0, 25 * (salary / p25));
  if (salary <= p50) return 25 + 25 * ((salary - p25) / (p50 - p25));
  if (salary <= p75) return 50 + 25 * ((salary - p50) / (p50 - p75));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

function inferLevel(rows: BenchmarkRow[], salary: number) {
  if (!rows.length || !salary) return null;

  return [...rows].sort(
    (a, b) => Math.abs(salary - a.p50) - Math.abs(salary - b.p50)
  )[0]?.level ?? null;
}

export default function Home() {
  const [job_title, setjob_title] = useState("");
  const [family, setFamily] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState<number | "">("");
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
        (recent) =>
          `${recent.family}-${recent.level}-${recent.salary}` !==
          `${role.family}-${role.level}-${role.salary}`
      ),
    ].slice(0, 4);

    setRecentRoles(updated);
    localStorage.setItem(recentRolesKey, JSON.stringify(updated));
  };

  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = override?.family ?? family;
    const selectedLevel = override?.level ?? level;
    const selectedSalary = override?.salary ?? salary;

    setLoading(true);
    setError("");
    setSearched(true);

    let query = supabase
      .from("market_benchmarks")
      .select("id,family,level,p25,p50,p75")
      .order("family", { ascending: true })
      .order("level", { ascending: true })
      .limit(100);

    if (selectedFamily.trim()) {
      query = query.ilike("family", `%${selectedFamily.trim()}%`);
    }

    if (selectedLevel.trim()) {
      query = query.ilike("level", `%${selectedLevel.trim()}%`);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as BenchmarkRow[]);
    setLoading(false);

    if (!override && selectedFamily && selectedLevel) {
      saveRole({
        job_title,
        family: selectedFamily,
        level: selectedLevel,
        salary: selectedSalary,
        timestamp: Date.now(),
      });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchBenchmarks();
  };

  const results = useMemo<BenchmarkResult[]>(() => {
    const currentSalary = Number(salary);

    return rows.map((row) => {
      const percentile = currentSalary
        ? estimatePercentile(currentSalary, row.p25, row.p50, row.p75)
        : null;

      return {
        ...row,
        diffToMedian: currentSalary ? currentSalary - row.p50 : null,
        percentile,
      };
    });
  }, [rows, salary]);

  const bestMatch = results[0];

  return (
    <main className="min-h-screen bg-gray-50 text-slate-950">
      {/* HEADER */}
      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 bg-emerald-100 text-emerald-900">
              Market intelligence
            </Badge>
            <h1 className="text-3xl font-semibold">
              Market Benchmark Tool
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Compare roles against market data and estimate positioning.
            </p>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">

          {/* SEARCH */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Benchmark search</h2>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input value={job_title} onChange={(e) => setjob_title(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Family</Label>
                <Input value={family} onChange={(e) => setFamily(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Level</Label>
                <Input value={level} onChange={(e) => setLevel(e.target.value)} />
              </div>

              <div className="space-y-2">
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
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search />}
                Search
              </Button>
            </form>
          </Card>

          {/* RECENT */}
          <Card>
            <h2 className="text-lg font-semibold mb-3 flex gap-2 items-center">
              <Clock3 className="h-4 w-4" /> Recent
            </h2>

            {recentRoles.length ? (
              recentRoles.map((role) => (
                <button
                  key={role.timestamp}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50"
                  onClick={() => fetchBenchmarks(role)}
                >
                  <div className="font-medium">{role.job_title}</div>
                  <div className="text-sm text-slate-600">
                    {role.family} / {role.level}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent searches</p>
            )}
          </Card>
        </aside>

        {/* RESULTS */}
        <section>
          <Card>
            <h2 className="text-xl font-semibold flex gap-2 items-center">
              <BarChart3 className="h-5 w-5" /> Results
            </h2>

            {!results.length && (
              <p className="text-sm text-slate-500 mt-4">
                Run a search to see benchmarks
              </p>
            )}

            <div className="mt-4 space-y-3">
              {results.map((row, i) => (
                <ResultRow key={i} row={row} />
              ))}
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}

function ResultRow({ row }: { row: BenchmarkResult }) {
  return (
    <div className="border rounded-lg p-4 flex justify-between">
      <div>
        <div className="font-medium">{row.family}</div>
        <div className="text-sm text-slate-500">{row.level}</div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{money(row.p50)}</div>
        <div className="text-xs text-slate-500">median</div>
      </div>
    </div>
  );
}