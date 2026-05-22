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

import { Input } from "@/components/ui/input";
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

/* ================= CONSTANTS ================= */

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const FAMILY_OPTIONS = ["Finance", "HR", "Engineering", "Sales"];

const SUB_FAMILY_OPTIONS: Record<string, string[]> = {
  Engineering: ["Software", "Data", "Infrastructure", "Security"],
  Finance: ["FP&A", "Accounting", "Treasury", "Tax"],
  HR: ["Talent Acquisition", "People Operations", "Reward"],
  Sales: ["Enterprise", "SMB", "Partnerships"],
};

const LEVEL_OPTIONS = ["L1", "L2", "L3", "L4"];

const recentRolesKey = "recentRoles";

/* ================= HELPERS ================= */

function money(value: number | null | undefined) {
  if (typeof value !== "number") return "N/A";
  return currency.format(value);
}

function getPosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0;
  if (value <= p50)
    return ((value - p25) / (p50 - p25 || 1)) * 50;
  if (value <= p75)
    return 50 + ((value - p50) / (p75 - p50 || 1)) * 50;
  return 100;
}

/* ================= COMPONENT ================= */

export default function Home() {
  const [job_title, setJobTitle] = useState("");
  const [family, setFamily] = useState("");
  const [sub_family, setSubFamily] = useState("");
  const [level, setLevel] = useState("");
  const [salary, setSalary] = useState<number | "">("");

  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [recentRoles, setRecentRoles] = useState<any[]>([]);
  const [activeSalary, setActiveSalary] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const availableSubFamilies =
    SUB_FAMILY_OPTIONS[family] || [];

  /* ===== LOAD RECENT ===== */
  useEffect(() => {
    const stored = localStorage.getItem(recentRolesKey);
    if (stored) setRecentRoles(JSON.parse(stored));
  }, []);

  const saveRole = (role: any) => {
    const updated = [role, ...recentRoles].slice(0, 3);
    setRecentRoles(updated);
    localStorage.setItem(
      recentRolesKey,
      JSON.stringify(updated)
    );
  };

  /* ===== FETCH ===== */

  const fetchBenchmarks = async (override?: any) => {
    const selectedFamily = override?.family ?? family;
    const selectedSubFamily =
      override?.sub_family ?? sub_family;
    const selectedLevel = override?.level ?? level;
    const selectedSalary = override?.salary ?? salary;

    // ✅ IMPORTANT FIX: ensure state is set
    if (override?.level) setLevel(override.level);
    if (override?.family) setFamily(override.family);
    if (override?.sub_family) setSubFamily(override.sub_family);

    setActiveSalary(selectedSalary);
    setLoading(true);

    try {
      let query = supabase
        .from("market_benchmarks")
        .select("*");

      if (selectedFamily)
        query = query.eq("family", selectedFamily);

      if (selectedSubFamily)
        query = query.eq("sub_family", selectedSubFamily);

      const { data } = await query;

      setRows(data || []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchBenchmarks();
  };

  /* ✅ FIXED LOGIC */

  const displayRows = useMemo(() => {
    if (!level) return [];

    const currentRow = rows.find(
      (r) => r.level === level
    );

    const nextLevel =
      LEVEL_OPTIONS[
        LEVEL_OPTIONS.indexOf(level) + 1
      ];

    const nextRow = rows.find(
      (r) => r.level === nextLevel
    );

    return [currentRow, nextRow].filter(Boolean) as BenchmarkRow[];
  }, [rows, level]);

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="grid max-w-7xl mx-auto gap-6 lg:grid-cols-[380px_1fr]">

        {/* LEFT */}
        <aside className="space-y-4">

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">

              <Input
                placeholder="Job title"
                value={job_title}
                onChange={(e) =>
                  setJobTitle(e.target.value)
                }
              />

              <select
                value={family}
                onChange={(e) => {
                  setFamily(e.target.value);
                  setSubFamily("");
                }}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Family</option>
                {FAMILY_OPTIONS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>

              <select
                value={sub_family}
                onChange={(e) =>
                  setSubFamily(e.target.value)
                }
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Sub-family</option>
                {availableSubFamilies.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <select
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value)
                }
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Level</option>
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>

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
                {loading ? <Loader2 className="animate-spin" /> : <Search />}
                Search
              </Button>
            </form>
          </Card>

          {/* RECENT */}
          <Card>
            <h2 className="flex gap-2 items-center font-semibold">
              <Clock3 className="h-4 w-4" />
              Recent
            </h2>

            {recentRoles.map((r: any) => (
              <button
                key={r.timestamp}
                onClick={() => fetchBenchmarks(r)}
                className="w-full text-left p-3 border rounded mt-2 hover:bg-slate-100"
              >
                <div>{r.job_title || "Untitled"}</div>
                <div className="text-sm text-slate-500">
                  {r.family} • {r.sub_family} • {r.level}
                </div>
                <div className="text-emerald-600 text-sm">
                  {money(r.salary)}
                </div>
              </button>
            ))}
          </Card>
        </aside>

        {/* RIGHT */}
        <section>
          <Card>
            <h2 className="flex gap-2 items-center text-xl font-semibold">
              <BarChart3 /> Level Comparison
            </h2>

            <div className="space-y-6 mt-6">

              {displayRows.map((row) => {
                const position =
                  typeof activeSalary === "number"
                    ? getPosition(
                        activeSalary,
                        row.p25,
                        row.p50,
                        row.p75
                      )
                    : null;

                const isSelected = row.level === level;

                return (
                  <div key={row.level}>

                    <div className="flex justify-between mb-2">
                      <div className="font-medium">
                        {row.level} {isSelected && "(Selected)"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {row.family} • {row.sub_family}
                      </div>
                    </div>

                    <div className="relative h-3 bg-slate-200 rounded-full">

                      <div
                        className={`absolute left-0 w-1/2 h-full ${
                          isSelected
                            ? "bg-emerald-200"
                            : "bg-slate-300"
                        }`}
                      />

                      <div
                        className={`absolute right-0 w-1/2 h-full ${
                          isSelected
                            ? "bg-emerald-500"
                            : "bg-slate-500"
                        }`}
                      />

                      <div className="absolute left-1/2 top-1/2 w-1 h-4 bg-black -translate-x-1/2 -translate-y-1/2" />

                      {position !== null && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ left: `${position}%` }}
                        >
                          <div className="h-4 w-4 bg-black rounded-full border-2 border-white shadow" />
                          <div className="text-xs mt-1 text-center">
                            {money(activeSalary as number)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 mt-2">
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
      </div>
    </main>
  );
}