'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

type DataPoint = {
  date: string
  weight: number
}

type Props = {
  data: DataPoint[]
  baselineWeight?: number | null
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-800">{payload[0].value} kg</p>
    </div>
  )
}

export default function WeightChart({ data, baselineWeight }: Props) {
  if (data.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
        至少需要 2 条体重记录才能显示趋势图
      </div>
    )
  }

  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const padding = Math.max((maxW - minW) * 0.3, 0.2)
  const yMin = Math.floor((minW - padding) * 10) / 10
  const yMax = Math.ceil((maxW + padding) * 10) / 10

  const first = data[0].weight
  const last  = data[data.length - 1].weight
  const diff  = last - first
  const trend = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'stable'

  const trendLabel = {
    up:     { text: `↑ ${diff.toFixed(2)} kg`, color: 'text-amber-600' },
    down:   { text: `↓ ${Math.abs(diff).toFixed(2)} kg`, color: 'text-emerald-600' },
    stable: { text: '→ 保持稳定', color: 'text-gray-500' },
  }[trend]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">体重趋势 / Weight Trend</p>
        <span className={`text-xs font-medium ${trendLabel.color}`}>
          {trendLabel.text}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          {baselineWeight && (
            <ReferenceLine
              y={baselineWeight}
              stroke="#d1fae5"
              strokeDasharray="4 4"
              label={{ value: '档案体重', position: 'right', fontSize: 9, fill: '#6ee7b7' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#059669"
            strokeWidth={2}
            dot={{ fill: '#059669', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#059669' }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 text-right">
        共 {data.length} 条体重记录
      </p>
    </div>
  )
}
