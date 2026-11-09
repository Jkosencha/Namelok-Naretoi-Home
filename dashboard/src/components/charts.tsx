import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const compact = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n))

// One measure over time (donations per month)
// `fill` lets the chart grow to the height of its card (e.g. next to a taller calendar)
export function MonthBars({ data, format, height = 260, fill }: { data: { label: string; full: string; value: number }[]; format: (n: number) => string; height?: number; fill?: boolean }) {
  const config = { value: { label: "Donations", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className={fill ? "aspect-auto h-full min-h-[260px] w-full" : "w-full"} style={fill ? undefined : { height }}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={42} tickFormatter={compact} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.full} formatter={(v) => <span className="font-semibold tabular-nums">{format(Number(v))}</span>} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ChartContainer>
  )
}

// Parts of a whole, with a legend that shows every number
export function Donut({ data, centerLabel }: { data: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const config = Object.fromEntries(data.map((d) => [d.label, { label: d.label, color: d.color }])) satisfies ChartConfig
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <ChartContainer config={config} className="aspect-square size-40 shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
          <Pie data={data.filter((d) => d.value)} dataKey="value" nameKey="label" innerRadius={52} outerRadius={74} paddingAngle={2} strokeWidth={0}>
            {data.filter((d) => d.value).map((d) => <Cell key={d.label} fill={d.color} />)}
            <Label content={({ viewBox }) => viewBox && "cx" in viewBox ? (
              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">{total}</tspan>
                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">{centerLabel}</tspan>
              </text>) : null} />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="grid min-w-48 flex-1 gap-0">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
