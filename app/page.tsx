"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, Loader2, Search } from "lucide-react";

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
};

/* ---------------- CONSTANTS ---------------- */

const recentRolesKey = "recentRoles";

/* ---------------- HELPERS ---------------- */

const money = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
};

/* ---------------- BENCHMARK BAR ---------------- */

function BenchmarkBar({
  p25,
  p50,
  p75,
  you,
}: {
  p25: number;
  p50: number;
  p75: number;
  you: number;
}) {
  const min = p25;
  const max = p75;

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const pct = (v: number) => ((clamp(v) - min) / (max - min)) * 100;

  const youPos = pct(you);
  const p50Pos = pct(p50);

  return (
    <div className="mt-4">
      {/* BAR */}
      <div className="relative h-3 w-full rounded-full bg-slate-200 overflow-visible">

        {/* RANGE */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300" />

        {/* P50 DOT */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${p50Pos}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-white bg-slate-700 shadow-md" />
        </div>

        {/* YOU DOT */}
        <div
          className="absolute top-1/2 -translate-y-1/2 z-10"
          style={{ left: `${youPos}%` }}
        >
          <div className="h-5 w-5 rounded-full border-2 border-white bg-emerald-500 shadow-lg" />
        </div>
      </div>

      {/* LABELS */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            P25
          </div>
          <div className="font-medium text-slate-800">
            {money(p25)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
            You
          </div>
          <div className="font-semibold text-emerald-600">
            {money(you)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            P50
          </div>
          <div className="font-medium text-slate-800">
            {money(p50)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            P75
          </div>
          <div className="font-medium text-slate-800">
            {money(p75)}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ---------------- COMPONENT ---------------- */

export default function Home() {
  const [job_title, setJobTitle] = useState("");
  const [family, setFamily] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState<number | "">("");

  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const [recentRoles, setRecentRoles] = useState<RoleQuery[]>([]);

  /* ---------------- RECENT SEARCHES ---------------- */

  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentRolesKey);

      if (stored) {
        setRecentRoles(JSON.parse(stored));
      }
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

    localStorage.setItem(
      recentRolesKey,
      JSON.stringify(updated)
    );
  };

  /* ---------------- FETCH ---------------- */

  const fetchBenchmarks = async (override?: RoleQuery) => {
    const selectedFamily = (override?.family ?? family).trim();
    const selectedLevel = (override?.level ?? level).trim();
    const selectedSalary = override?.salary ?? salary;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("id,family,level,p25,p50,p75");

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

      /* IMPORTANT */
      /* Preserve exact search salary snapshot */

      if (!override && selectedFamily && selectedLevel) {
        saveRole({
          job_title,
          family: selectedFamily,
          level: selectedLevel,
          salary: selectedSalary,
          timestamp: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchBenchmarks();
  };

  /* ---------------- RESULTS ---------------- */

  const results = useMemo<BenchmarkResult[]>(() => {
    const s = Number(salary);

    return rows.map((r) => ({
      ...r,
      diffToMedian: salary ? s - r.p50 : null,
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

        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">

        {/* LEFT */}
        <aside className="space-y-4">

          {/* SEARCH */}
          <Card>
            <h2 className="mb-4 font-semibold">
              Search
            </h2>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              <div>
                <Label>Job title</Label>

                <Input
                  value={job_title}
                  onChange={(e) =>
                    setJobTitle(e.target.value)
                  }
                />
              </div>

              {/* FAMILY */}
              <div>
                <Label>Family</Label>

                <select
                  className="w-full rounded border p-2"
                  value={family}
                  onChange={(e) =>
                    setFamily(e.target.value)
                  }
                >
                  <option value="">
                    Select family
                  </option>

                  <option value="Finance">
                    Finance
                  </option>

                  <option value="HR">
                    HR
                  </option>

                  <option value="Engineering">
                    Engineering
                  </option>

                  <option value="Sales">
                    Sales
                  </option>
                </select>
              </div>

              {/* LEVEL */}
              <div>
                <Label>Level</Label>

                <select
                  className="w-full rounded border p-2"
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value)
                  }
                >
                  <option value="">
                    Select level
                  </option>

                  <option value="L1">
                    L1
                  </option>

                  <option value="L2">
                    L2
                  </option>

                  <option value="L3">
                    L3
                  </option>

                  <option value="L4">
                    L4
                  </option>
                </select>
              </div>

              {/* SALARY */}
              <div>
                <Label>Your salary</Label>

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

              <Button
                type="submit"
                className="w-full"
              >
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
              <Clock3 className="h-4 w-4" />
              Recent
            </h2>

            {recentRoles.length === 0 ? (
              <p className="text-sm text-slate-500">
                No recent searches
              </p>
            ) : (
              recentRoles.map((r) => (
                <button
                  key={r.timestamp}
                  className="w-full rounded border p-3 text-left hover:bg-gray-50"
                  onClick={() => {
                    setJobTitle(r.job_title);
                    setFamily(r.family);
                    setLevel(r.level);
                    setSalary(r.salary);

                    fetchBenchmarks(r);
                  }}
                >

                  <div className="font-medium">
                    {r.job_title}
                  </div>

                  <div className="text-xs text-slate-500">
                    {r.family} / {r.level}
                  </div>

                  <div className="mt-1 text-xs text-emerald-600">
                    You: {money(Number(r.salary))}
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

            {/* LOADING */}
            {loading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </p>
            )}

            {/* EMPTY */}
            {!loading &&
              searched &&
              results.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  No results found
                </p>
              )}

            {/* RESULTS */}
            <div className="mt-4 space-y-4">

              {results.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-white p-5 shadow-sm"
                >

                  <div className="flex items-start justify-between">

                    <div>
                      <div className="font-semibold text-slate-900">
                        {r.family}
                      </div>

                      <div className="text-sm text-slate-500">
                        {r.level}
                      </div>
                    </div>

                  </div>

                  {/* VISUAL BAR */}
                  <BenchmarkBar
                    p25={r.p25}
                    p50={r.p50}
                    p75={r.p75}
                    you={Number(salary)}
                  />

                </div>
              ))}

            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}