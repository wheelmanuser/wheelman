"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthlyDatum = {
  month: number;
  label: string;
  value: number;
};

type Props = {
  monthlyByYear: Record<number, MonthlyDatum[]>;
  years: number[];
  defaultYear: number;
};

export function MonthlySpendChart({ monthlyByYear, years, defaultYear }: Props) {
  const [year, setYear] = useState(defaultYear);
  const current = new Date();
  const currentMonth = current.getMonth() + 1;

  const data = useMemo(() => monthlyByYear[year] ?? [], [monthlyByYear, year]);

  return (
    <section className="rounded-xl border border-wm-border bg-wm-s1 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-wm-text">Monthly Spend</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-wm-border bg-wm-s2 px-2 py-1 text-sm text-wm-text"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3050" vertical={false} />
            <XAxis dataKey="label" stroke="#8B92B0" tickLine={false} axisLine={false} />
            <YAxis stroke="#8B92B0" tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(label) => `${label}`}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Spend"]}
              contentStyle={{
                background: "#12151F",
                border: "1px solid #2A3050",
                color: "#F0F2FA",
              }}
              labelStyle={{ color: "#F0F2FA" }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={`${year}-${d.month}`}
                  fill={d.month === currentMonth && year === current.getFullYear() ? "#C8A45A" : "#3B82F6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
