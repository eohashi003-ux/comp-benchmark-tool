function getMarkerPosition(
  value: number,
  p25: number,
  p50: number,
  p75: number
) {
  if (value <= p25) return 0;

  // P25 -> P50 maps to 0% -> 50%
  if (value <= p50) {
    return ((value - p25) / (p50 - p25)) * 50;
  }

  // P50 -> P75 maps to 50% -> 100%
  if (value <= p75) {
    return 50 + ((value - p50) / (p75 - p50)) * 50;
  }

  return 100;
}

function ResultCard({
  row,
  activeSalary,
}: {
  row: BenchmarkResult;
  activeSalary?: number | "";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* TOP */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {row.family}
          </h3>

          <p className="text-sm text-slate-500">
            {row.level}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Your Salary
          </div>

          <div className="text-xl font-bold text-emerald-900">
            {typeof activeSalary === "number"
              ? money(activeSalary)
              : "—"}
          </div>
        </div>
      </div>

      {/* VISUAL BAR */}
      <div className="relative mt-6">
        {/* BAR */}
        <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-200" />
          <div className="absolute right-0 top-0 h-full w-1/2 bg-emerald-400" />
        </div>

        {/* P50 DOT */}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
          style={{ left: "50%" }}
        />

        {/* YOUR SALARY DOT */}
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
          />
        )}
      </div>

      {/* BENCHMARK VALUES */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {/* P25 */}
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            P25
          </div>

          <div className="mt-1 text-lg font-semibold text-slate-900">
            {money(row.p25)}
          </div>
        </div>

        {/* P50 */}
        <div className="rounded-xl bg-slate-100 p-3 text-center ring-1 ring-slate-200">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            P50
          </div>

          <div className="mt-1 text-lg font-bold text-slate-900">
            {money(row.p50)}
          </div>
        </div>

        {/* P75 */}
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            P75
          </div>

          <div className="mt-1 text-lg font-semibold text-slate-900">
            {money(row.p75)}
          </div>
        </div>
      </div>

      {/* INSIGHTS */}
      <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Market Position
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-900">
            {row.percentile
              ? `~${Math.round(row.percentile)}th percentile`
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
            {(row.diffToMedian ?? 0) >= 0 ? "+" : ""}
            {money(row.diffToMedian ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}