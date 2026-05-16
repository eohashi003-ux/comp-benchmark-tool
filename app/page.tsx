"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, Loader2, Search } from "lucide-react";

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
  if (salary <= p50) return 25 + 25 * ((salary - p25) / (p50 - p25));
  if (salary <= p75) return 50 + 25 * ((salary - p50) / (p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

/**
 * FIX: this was missing in your version
 */
function getMarkerPosition(value: number, p25: number, p50: number, p75: number) {
  if (!p25 || !p50 || !p75) return 0;

  if (value <= p25) return 0;
  if (value <= p50) return ((value - p25) / (p50 - p25)) * 50;
  if (value <= p75) return 50 + ((value - p50) / (p75 - p50)) * 50;

  return 100;
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
    const selectedSalary = override?.salary ?? salary;

    setActiveSalary(selectedSalary);

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

      const safe = (data ?? []) as BenchmarkRow[];
      setRows(safe);

      if (!override && selectedFamily && selectedLevel) {
        saveRole({
          job_title,
          family: selectedFamily,
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
    const s = typeof activeSalary === "number" ? activeSalary : 0;

    return rows.map((row) => ({
      ...row,
      diffToMedian:
        typeof activeSalary === "number" ? s - row.p50 : null,
      percentile:
        typeof activeSalary === "number"
          ? estimatePercentile(s, row.p25, row.p50, row.p75)
          : null,
    }));
  }, [rows, activeSalary]);

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
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Search</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Job Title</Label>
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
                  onChange={(e) => setSalary(e.target.value ? Number(e.target.value) : "")}
                />
              </div>

              <Button type="submit" className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search />}
                Search
              </Button>
            </form>
          </Card>
        </aside>

        <section>
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5" />
              Results
            </h2>

            <div className="mt-6 space-y-4">
              {results.map((row, index) => (
                <div key={index} className="rounded-xl border bg-white p-5">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold">{row.family}</div>
                      <div className="text-sm text-slate-500">{row.level}</div>
                    </div>

                    <div className="text-right font-bold text-emerald-700">
                      {money(typeof activeSalary === "number" ? activeSalary : null)}
                    </div>
                  </div>

                  <div className="relative mt-6 h-2 rounded bg-slate-200">
                    <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-200" />
                    <div className="absolute right-0 top-0 h-full w-1/2 bg-emerald-400" />

                    <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 border-2 border-white" />

                    {typeof activeSalary === "number" && (
                      <div
                        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 border-4 border-white"
                        style={{
                          left: `${getMarkerPosition(activeSalary, row.p25, row.p50, row.p75)}%`,
                        }}
                      />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 text-center">
                    <div>
                      <div className="text-xs">P25</div>
                      <div>{money(row.p25)}</div>
                    </div>

                    <div>
                      <div className="text-xs">P50</div>
                      <div>{money(row.p50)}</div>
                    </div>

                    <div>
                      <div className="text-xs">P75</div>
                      <div>{money(row.p75)}</div>
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