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

const FAMILY_OPTIONS = ["Finance", "HR", "Engineering", "Sales"];

const SUB_FAMILY_OPTIONS: Record<string, string[]> = {
  Engineering: ["Software", "Data", "Infrastructure", "Security"],
  Finance: ["FP&A", "Accounting", "Treasury", "Tax"],
  HR: ["Talent Acquisition", "People Operations", "Reward"],
  Sales: ["Enterprise", "SMB", "Partnerships"],
};

const LEVEL_OPTIONS = ["L1", "L2", "L3", "L4"];

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
    return 25 + 25 * ((salary - p25) / (p50 - p25));
  if (salary <= p75)
    return 50 + 25 * ((salary - p50) / (p75 - p50));

  return Math.min(100, 75 + 25 * ((salary - p75) / p75));
}

function getMarkerPosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0;
  if (value <= p50)
    return ((value - p25) / (p50 - p25)) * 50;
  if (value <= p75)
    return 50 + ((value - p50) / (p75 - p50)) * 50;
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
    const selectedSubFamily = (
      override?.sub_family ?? sub_family ?? ""
    ).trim();
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

      setRows(data ?? []);
      if (!data || data.length === 0)
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

  const availableSubFamilies = SUB_FAMILY_OPTIONS[family] || [];

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
        {/* LEFT SIDE OMITTED — UNCHANGED */}

        <section>
          <Card>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5" />
              Results
            </h2>

            <div className="mt-6 space-y-4">
              {results.map((row, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  {/* BENCHMARK BAR WITH EXPLICIT QUARTILES */}
                  <div className="relative mt-6">
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-200" />
                      <div className="absolute right-0 top-0 h-full w-1/2 bg-emerald-400" />
                    </div>

                    {/* QUARTILE TICKS */}
                    {[
                      { left: "25%", label: "P25", title: "25th percentile" },
                      { left: "50%", label: "P50", title: "Median (50th percentile)" },
                      { left: "75%", label: "P75", title: "75th percentile" },
                    ].map((q) => (
                      <div
                        key={q.label}
                        className="absolute top-1/2 -translate-x-1/2"
                        style={{ left: q.left }}
                        title={q.title}
                      >
                        <div className="h-4 w-px bg-slate-600" />
                        <div className="mt-1 text-[10px] text-slate-500 text-center">
                          {q.label}
                        </div>
                      </div>
                    ))}

                    {/* USER MARKER */}
                    {typeof activeSalary === "number" && (
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
                        title="Your salary"
                      />
                    )}
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
``