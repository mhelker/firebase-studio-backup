
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Booking } from "@/types"
import { useMemo } from "react"
import { format } from "date-fns"

const chartConfig = {
  earnings: {
    label: "Earnings",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

interface EarningsChartProps {
    bookings: Booking[];
}

export function EarningsChart({ bookings }: EarningsChartProps) {
  const chartData = useMemo(() => {
    const monthlyEarnings: { [key: string]: number } = {}
    
    bookings
      .filter(b => b.status === 'completed' && b.performerPayout && b.date && typeof b.date.toDate === 'function')
      .forEach(booking => {
        const month = format(booking.date.toDate(), "MMM yyyy")
        if (!monthlyEarnings[month]) {
          monthlyEarnings[month] = 0
        }
        monthlyEarnings[month] += booking.performerPayout!;
      })

    const data = Object.entries(monthlyEarnings).map(([month, total]) => ({
      month,
      earnings: total,
    }))

    data.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
    
    return data.slice(-6);

  }, [bookings])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Earnings</CardTitle>
        <CardDescription>Your earnings from completed gigs over the last 6 months.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.substring(0, 3)}
                />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => `$${value}`}
                />
                <ChartTooltip
  cursor={false}
  content={
    <ChartTooltipContent
      labelFormatter={(label, payload) => {
        const val = Number(payload?.[0]?.value ?? 0);
        return `${label}: $${val.toFixed(2)}`;
      }}
    />
  }
/>
                <Bar
                    dataKey="earnings"
                    fill="var(--color-earnings)"
                    radius={4}
                />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
            No earnings data available for the last 6 months.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
