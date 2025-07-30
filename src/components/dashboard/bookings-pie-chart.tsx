
"use client"

import { Pie, PieChart, Cell } from "recharts"
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Booking } from "@/types"
import { useMemo } from "react"

const chartConfig = {
  bookings: {
    label: "Bookings",
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-2))",
  },
  confirmed: {
    label: "Upcoming",
    color: "hsl(var(--chart-1))",
  },
  awaiting_payment: {
    label: "Awaiting Payment",
    color: "hsl(var(--chart-3))"
  },
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-4))",
  },
  cancelled: {
    label: "Cancelled",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

interface BookingsPieChartProps {
    bookings: Booking[];
}


export function BookingsPieChart({ bookings }: BookingsPieChartProps) {
  const chartData = useMemo(() => {
    const statusCounts = {
        completed: 0,
        confirmed: 0, // This now strictly means upcoming and paid
        awaiting_payment: 0,
        pending: 0,
        cancelled: 0,
    };
    
    const now = new Date();

    bookings.forEach(booking => {
      // Past confirmed bookings are treated as completed for this chart.
      if (booking.status === 'confirmed' && booking.date.toDate() < now) {
        statusCounts.completed++;
      } else if (statusCounts.hasOwnProperty(booking.status)) {
         statusCounts[booking.status as keyof typeof statusCounts]++;
      }
    });

    const data = Object.entries(statusCounts).map(([status, count]) => ({
      status: chartConfig[status as keyof typeof chartConfig]?.label || status.replace('_', ' '),
      count: count,
      fill: chartConfig[status as keyof typeof chartConfig]?.color,
    }));
    
    return data.filter(d => d.count > 0);

  }, [bookings])


  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Overview</CardTitle>
        <CardDescription>A summary of all your bookings by status.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
         {chartData.length > 0 ? (
            <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[250px]"
            >
            <PieChart>
                <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                strokeWidth={5}
                >
                   {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                    content={<ChartLegendContent nameKey="status" />}
                    className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                />
            </PieChart>
            </ChartContainer>
         ) : (
            <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
                No bookings to display yet.
            </div>
         )}
      </CardContent>
    </Card>
  )
}
