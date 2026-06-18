interface DataPoint {
  scored_at: string
  total: number
}

interface Props {
  data: DataPoint[]
  color?: string
  height?: number
  width?: number
}

export default function RiskSparkline({ data, color = '#8b5cf6', height = 32, width = 80 }: Props) {
  if (data.length < 2) return null

  const sorted = [...data].sort((a, b) => a.scored_at.localeCompare(b.scored_at))
  const values = sorted.map((d) => d.total)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height * 0.85 - height * 0.075
    return `${x},${y}`
  })

  const latest = values[values.length - 1]
  const previous = values[values.length - 2]
  const trend = latest > previous ? '↑' : latest < previous ? '↓' : '→'
  const trendColor = latest > previous ? '#ef4444' : latest < previous ? '#10b981' : '#9ca3af'

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {/* End dot */}
        <circle
          cx={width}
          cy={height - ((latest - min) / range) * height * 0.85 - height * 0.075}
          r="2"
          fill={color}
        />
      </svg>
      <span className="text-xs font-medium" style={{ color: trendColor }}>{trend}</span>
    </div>
  )
}
