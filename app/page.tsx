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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  jobTitle: string;
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
  if (salary <= p75) return 50 + 25 * ((salary - p50) / (p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

function inferLevel(rows: BenchmarkRow[], salary: number) {
  if (!rows.length || !salary) return null;

  return [...rows].sort(
    (a, b) => Math.abs(salary - a.p50) - Math.abs(salary - b.p50)
  )[0]?.level ?? null;
}

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
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
        jobTitle,
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

  const suggestedLevel = useMemo(() => {
    const currentSalary = Number(salary);
    if (!currentSalary || !family || !rows.length) return null;

    const pool = rows.filter((row) =>
      normalise(row.family).includes(normalise(family))
    );

    return inferLevel(pool.length ? pool : rows, currentSalary);
  }, [family, rows, salary]);

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
  const averageMedian = results.length
    ? results.reduce((total, row) => total + row.p50, 0) / results.length
    : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
              Market intelligence
            </Badge>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Market Benchmark Tool
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Compare a role against market quartiles, estimate percentile
              position, and keep recent role checks close at hand.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Results" value={results.length.toString()} />
            <Metric label="Avg median" value={money(averageMedian)} />
            <Metric
              label="Best match"
              value={bestMatch ? `${bestMatch.family} ${bestMatch.level}` : "None"}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-xl">Benchmark search</CardTitle>
              <CardDescription>
                Use family and level to narrow the Supabase query.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label="Job title" htmlFor="jobTitle">
                  <Input
                    id="jobTitle"
                    placeholder="Software Engineer"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <Field label="Family" htmlFor="family">
                    <Input
                      id="family"
                      placeholder="Engineering"
                      value={family}
                      onChange={(event) => setFamily(event.target.value)}
                    />
                  </Field>

                  <Field label="Level" htmlFor="level">
                    <Input
                      id="level"
                      placeholder="L3"
                      value={level}
                      onChange={(event) => setLevel(event.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Salary" htmlFor="salary">
                  <Input
                    id="salary"
                    min={0}
                    placeholder="65000"
                    type="number"
                    value={salary}
                    onChange={(event) =>
                      setSalary(
                        event.target.value === "" ? "" : Number(event.target.value)
                      )
                    }
                  />
                </Field>

                <Button className="w-full gap-2" disabled={loading} type="submit">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Search benchmarks
                </Button>
              </form>
            </CardContent>
          </Card>

          {suggestedLevel && suggestedLevel !== level && (
            <Card className="rounded-md border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-emerald-700" />
                  <div>
                    <p className="text-sm font-medium text-emerald-950">
                      Suggested level: {suggestedLevel}
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      Based on the closest median salary in the current results.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={() => setLevel(suggestedLevel)}
                >
                  Apply suggestion
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-4 w-4" />
                Recent searches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentRoles.length ? (
                recentRoles.map((role) => (
                  <button
                    className="w-full rounded-md border bg-white p-3 text-left text-sm transition hover:border-slate-400"
                    key={role.timestamp}
                    type="button"
                    onClick={() => {
                      setJobTitle(role.jobTitle);
                      setFamily(role.family);
                      setLevel(role.level);
                      setSalary(role.salary);
                      fetchBenchmarks(role);
                    }}
                  >
                    <span className="block font-medium">
                      {role.jobTitle || "Untitled role"}
                    </span>
                    <span className="mt-1 block text-slate-600">
                      {role.family} / {role.level}
                      {role.salary ? ` / ${money(Number(role.salary))}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Recent searches appear after a family and level search.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="h-5 w-5" />
                Benchmark results
              </CardTitle>
              <CardDescription>
                Quartiles are shown as P25, P50, and P75. Salary comparisons use
                the entered salary when available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading benchmarks
                </div>
              )}

              {!loading && !results.length && (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed text-center">
                  <BarChart3 className="h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-medium">
                    {searched ? "No benchmarks found" : "Run a benchmark search"}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {searched
                      ? "Try broadening the family or level filters."
                      : "Enter a family, level, and optional salary to compare against the market."}
                  </p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="overflow-hidden rounded-md border">
                  <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_1fr_1fr_1.2fr] bg-slate-100 px-4 py-3 text-xs font-medium uppercase tracking-normal text-slate-600 md:grid">
                    <span>Family</span>
                    <span>Level</span>
                    <span>P25</span>
                    <span>P50</span>
                    <span>P75</span>
                    <span>Position</span>
                  </div>
                  <div className="divide-y bg-white">
                    {results.map((row, index) => (
                      <ResultRow
                        key={row.id ?? `${row.family}-${row.level}-${index}`}
                        row={row}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] rounded-md border bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ResultRow({ row }: { row: BenchmarkResult }) {
  const aboveMedian = row.diffToMedian !== null && row.diffToMedian >= 0;
  const percentileWidth = `${Math.max(0, Math.min(100, row.percentile ?? 0))}%`;

  return (
    <div className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.4fr_0.8fr_1fr_1fr_1fr_1.2fr] md:items-center">
      <span className="font-medium">
        <span className="mr-2 text-xs font-medium uppercase text-slate-500 md:hidden">
          Family
        </span>
        {row.family}
      </span>
      <span>
        <span className="mr-2 text-xs font-medium uppercase text-slate-500 md:hidden">
          Level
        </span>
        {row.level}
      </span>
      <span>
        <span className="mr-2 text-xs font-medium uppercase text-slate-500 md:hidden">
          P25
        </span>
        {money(row.p25)}
      </span>
      <span className="font-semibold">
        <span className="mr-2 text-xs font-medium uppercase text-slate-500 md:hidden">
          P50
        </span>
        {money(row.p50)}
      </span>
      <span>
        <span className="mr-2 text-xs font-medium uppercase text-slate-500 md:hidden">
          P75
        </span>
        {money(row.p75)}
      </span>
      <div>
        {row.diffToMedian !== null ? (
          <div className="space-y-2">
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                aboveMedian ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {aboveMedian ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {aboveMedian ? "+" : ""}
              {money(row.diffToMedian)} vs P50
            </div>
            {row.percentile !== null && (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: percentileWidth }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {Math.round(row.percentile)}th percentile
                </p>
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-500">Enter salary</span>
        )}
      </div>
    </div>
  );
}
