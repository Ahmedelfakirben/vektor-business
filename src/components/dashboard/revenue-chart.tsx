"use client"

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface RevenueChartProps {
  data: {
    date: string
    revenue: number
    profit: number
  }[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="col-span-full lg:col-span-4 border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight">Performance Commerciale</CardTitle>
        <CardDescription>Évolution des revenus et du profit sur les 30 derniers jours</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                stroke="currentColor"
                className="text-muted-foreground"
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => value.split('/')[0]}
              />
              <YAxis 
                stroke="currentColor" 
                className="text-muted-foreground"
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `${value} DH`}
              />
              <Tooltip 
                contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--card-foreground))"
                }}
                itemStyle={{ color: "hsl(var(--card-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenu"
                stroke="#f59e0b"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit Est."
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
