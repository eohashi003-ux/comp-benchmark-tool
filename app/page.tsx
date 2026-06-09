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
  Engineering: [
    "Software",
    "Data",
    "Infrastructure",
    "Security",
  ],
  Finance: [
    "FP&A",
    "Accounting",
    "Treasury",
    "Tax",
  ],
  HR: [
    "Talent Acquisition",
    "People Operations",
    "Reward",
  ],
  Sales: [
    "Enterprise",
    "SMB",
    "Partnerships",
  ],
};

const LEVEL_OPTIONS = [
  "L1",
  "L2",
  "L3",
  "L4",
];

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

  if (salary <= p25) {
    return Math.max(0, 25 * (salary / p25));
  }

  if (salary <= p50) {
    return 25 + 25 * ((salary - p25) / (p50 - p25));
  }

  if (salary <= p75) {
    return 50 + 25 * ((salary - p50) / (p75 - p50));
  }

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

function getMarkerPosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0;

  if (value <= p50) {
    return ((value - p25) / (p50 - p25)) * 50;
  }

  if (value <= p75) {
    return 50 + ((value - p50) / (p75 - p50)) * 50;
  }

  return 100;
}

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
          `${r.family}-${r.sub_family}-${r.level}-${r.salary}` !==
          `${role.family}-${role.sub_family}-${role.level}-${role.salary}`
      ),
    ].slice(0, 3);

    setRecentRoles(updated);

    localStorage.setItem(
      recentRolesKey,
      JSON.stringify(updated)
    );
  };

  const fetchBenchmarks = async (
    override?: RoleQuery
  ) => {
    const selectedFamily = (
      override?.family ?? family
    ).trim();

    const selectedSubFamily = (
      override?.sub_family ?? sub_family ?? ""
    ).trim();

    const selectedLevel = (
      override?.level ?? level
    ).trim();

    const selectedSalary =
      override?.salary ?? salary;

    setActiveSalary(selectedSalary);

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select(
          "id,family,sub_family,level,p25,p50,p75"
        );

      if (selectedFamily) {
        query = query.eq(
          "family",
          selectedFamily
        );
      }

      // OPTIONAL SUB FAMILY FILTER
      if (selectedSubFamily) {
        query = query.eq(
          "sub_family",
          selectedSubFamily
        );
      }

      if (selectedLevel) {
        query = query.eq(
          "level",
          selectedLevel
        );
      }

      const { data, error } = await query.limit(1);

      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }

      const safeData = data ?? [];

      setRows(safeData);

      if (safeData.length === 0) {
        setError("No benchmark results found");
      }

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

  const handleSubmit = (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    fetchBenchmarks();
  };

  const results = useMemo<BenchmarkResult[]>(() => {
    const s =
      typeof activeSalary === "number"
        ? activeSalary
        : 0;

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

  const availableSubFamilies =
    SUB_FAMILY_OPTIONS[family] || [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {/* HEADER */}
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

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT */}
        <aside className="space-y-4">
          {/* SEARCH */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold">
              Search
            </h2>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    Select family
                  </option>

                  {FAMILY_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* SUB FAMILY */}
              <div>
                <Label>Sub Family</Label>

                <select
                  value={sub_family}
                  onChange={(e) =>
                    setSubFamily(e.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    All sub families
                  </option>

                  {availableSubFamilies.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <Label>Level</Label>

                <select
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    Select level
                  </option>

                  {LEVEL_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
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
                  <Search className="h-4 w-4" />
                )}

                Search
              </Button>
            </form>
          </Card>

          {/* RECENT SEARCHES */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
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
                    onClick={() =>
                      fetchBenchmarks(r)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                  >
                    <div className="font-medium text-slate-900">
                      {r.job_title || "Untitled"}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {r.family}
                      {r.sub_family
                        ? ` • ${r.sub_family}`
                        : ""}
                      {" • "}
                      {r.level}
                    </div>

                    <div className="mt-1 text-sm font-medium text-emerald-700">
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
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5" />
              Results
            </h2>

            {loading && (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading benchmark data...
              </div>
            )}

            {!loading &&
              searched &&
              results.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">
                  No results found
                </p>
              )}

            {error && (
              <p className="mt-4 text-sm text-rose-600">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-4">
              {results.map((row, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  {/* HEADER */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {row.family}
                      </h3>

                      <p className="text-sm text-slate-500">
                        {row.sub_family
                          ? `${row.sub_family} • `
                          : ""}
                        {row.level}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right">
                      <div className="text-xs uppercase tracking-wide text-emerald-700">
                        Your Salary
                      </div>

                      <div className="text-xl font-bold text-emerald-900">
                        {money(
                          typeof activeSalary === "number"
                            ? activeSalary
                            : null
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BENCHMARK BAR */}
                  <div className="relative mt-6">
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-200" />

                      <div className="absolute right-0 top-0 h-full w-1/2 bg-emerald-400" />
                    </div>

                    {/* P50 DOT */}
                    <div
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
                      style={{ left: "50%" }}
                    />

                    {/* USER DOT */}
                    {typeof activeSalary ===
                      "number" && (
                      <div
                        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-emerald-500 shadow-lg"
                        style={{
                          left: `${getMarkerPosition(
                            activeSalary,
                            row.p25,
                            row.p50,
                            row.p75
                          )}%`,
                        }}
                      />
                    )}
                  </div>

                  {/* LABELS UNDER BAR */}
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <div>
                      P25 • {money(row.p25)}
                    </div>

                    <div>
                      P50 • {money(row.p50)}
                    </div>

                    <div>
                      P75 • {money(row.p75)}
                    </div>
                  </div>

                  {/* BENCHMARK CARDS */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        P25
                      </div>

                      <div className="mt-1 text-lg font-semibold">
                        {money(row.p25)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-3 text-center ring-1 ring-slate-200">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        P50
                      </div>

                      <div className="mt-1 text-lg font-bold">
                        {money(row.p50)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        P75
                      </div>

                      <div className="mt-1 text-lg font-semibold">
                        {money(row.p75)}
                      </div>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Market Position
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {row.percentile
                          ? `~${Math.round(
                              row.percentile
                            )}th percentile`
                          : "Not available"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        vs Median
                      </div>

                      <div
                        className={`mt-1 text-sm font-semibold ${
                          (row.diffToMedian ?? 0) >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {(row.diffToMedian ?? 0) >= 0
                          ? "+"
                          : ""}
                        {money(
                          row.diffToMedian ?? 0
                        )}
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