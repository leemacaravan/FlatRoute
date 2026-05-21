import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import './ElevationChart.css'

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function gradeColor(pct) {
  const abs = Math.abs(pct)
  if (abs >= 12) return '#dc2626'
  if (abs >= 8) return '#ea580c'
  if (abs >= 4) return '#ca8a04'
  return '#2d6a4f'
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="elev-tooltip">
      <span className="elev-tooltip__elev">{Math.round(d.elev)} m</span>
      <span className="elev-tooltip__dist">{formatDist(d.dist)}</span>
      <span className="elev-tooltip__grade" style={{ color: gradeColor(d.grade) }}>
        {d.grade >= 0 ? '+' : ''}{d.grade.toFixed(1)}%
      </span>
    </div>
  )
}

export default function ElevationChart({ data, onHover }) {
  if (!data || data.length === 0) return null

  function handleMouseMove(state) {
    if (state?.isTooltipActive && state.activePayload?.length) {
      const pt = state.activePayload[0].payload
      onHover?.({ lon: pt.lon, lat: pt.lat })
    }
  }

  function handleMouseLeave() {
    onHover?.(null)
  }

  return (
    <div className="elev-chart">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart
          data={data}
          margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dist"
            tickFormatter={formatDist}
            tick={{ fontSize: 10, fill: '#888' }}
            tickLine={false}
            axisLine={false}
            minTickGap={60}
          />
          <YAxis
            dataKey="elev"
            tick={{ fontSize: 10, fill: '#888' }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => `${Math.round(v)}m`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2563eb', strokeWidth: 1.5 }} />
          <Area
            type="monotone"
            dataKey="elev"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#elevFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
