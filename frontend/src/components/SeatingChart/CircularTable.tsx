import React from 'react'

export interface Seat {
  position: number
  name: string
  religion: string
  is_facilitator?: boolean
}

export interface CircularTableProps {
  tableNumber: number
  seats: Seat[]
}

/**
 * Shortens a name if it's too long for display on the seating chart.
 * Names longer than 20 characters are shortened to "FirstName L." format.
 * 
 * @param name - Full name to potentially shorten
 * @returns Shortened name if needed, otherwise original name
 */
const shortenName = (name: string): string => {
  const MAX_LENGTH = 20
  
  if (name.length <= MAX_LENGTH) {
    return name
  }
  
  // Split on space to get first and last name
  const parts = name.trim().split(/\s+/)
  
  if (parts.length < 2) {
    // No space found, just truncate with ellipsis
    return name.substring(0, MAX_LENGTH - 3) + '...'
  }
  
  // Use first name + last name initial
  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const lastInitial = lastName.charAt(0).toUpperCase()
  
  return `${firstName} ${lastInitial}.`
}

/**
 * CircularTable component displays participants arranged around a circular table
 * using SVG. Names are positioned using polar coordinates for even distribution.
 */
const CircularTable: React.FC<CircularTableProps> = ({ tableNumber, seats }) => {
  // SVG geometry. The viewBox is fixed and every label box is clamped to stay
  // fully inside it, so labels never spill into an adjacent table in the grid.
  const svgSize = 500
  const centerX = svgSize / 2
  const centerY = svgSize / 2
  const circleRadius = 100 // Visual circle radius
  const labelRadius = 168 // Distance from center to label-box center
  const margin = 6
  const boxHeight = 30

  const totalSeats = seats.length
  const angleStep = (2 * Math.PI) / totalSeats

  // Approximate rendered width of a bold ~14px label, plus horizontal padding.
  const boxWidthFor = (text: string): number =>
    Math.min(210, Math.max(64, Math.round(text.length * 7.2) + 20))

  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value))

  return (
    <div
      className="flex flex-col items-center p-6 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow"
      data-testid="circular-table"
    >
      {/* Table number label */}
      <div className="mb-2 px-4 py-2 bg-gray-800 text-white text-xl font-bold rounded-full">
        Table {tableNumber}
      </div>

      {/* Facilitator subtitle */}
      {(() => {
        const facilitators = seats.filter((s) => s.is_facilitator)
        if (facilitators.length === 0) return null
        return (
          <div
            className="mb-2 text-xs text-gray-600 font-medium text-center"
            data-testid="facilitator-subtitle"
          >
            Facilitators: {facilitators.map((f) => shortenName(f.name)).join(' · ')}
          </div>
        )
      })()}

      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="circular-table-svg"
      >
        {/* Draw the table circle with gradient/depth */}
        <defs>
          <radialGradient id={`table-gradient-${tableNumber}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: '#f9fafb', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e5e7eb', stopOpacity: 1 }} />
          </radialGradient>
        </defs>
        <circle
          cx={centerX}
          cy={centerY}
          r={circleRadius}
          fill={`url(#table-gradient-${tableNumber})`}
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-800"
        />

        {/* Position each participant name around the circle */}
        {seats.map((seat) => {
          // Calculate angle: start at top (-90 degrees / -PI/2) and go clockwise
          const angle = seat.position * angleStep - Math.PI / 2

          // Position marker on the circle perimeter
          const markerX = centerX + circleRadius * Math.cos(angle)
          const markerY = centerY + circleRadius * Math.sin(angle)

          // Shorten name if needed
          const displayName = shortenName(seat.name)
          const boxWidth = boxWidthFor(displayName)

          // Desired label-box center, then clamp the box inside the viewBox.
          const desiredCenterX = centerX + labelRadius * Math.cos(angle)
          const desiredCenterY = centerY + labelRadius * Math.sin(angle)
          const boxX = clamp(
            desiredCenterX - boxWidth / 2,
            margin,
            svgSize - margin - boxWidth
          )
          const boxY = clamp(
            desiredCenterY - boxHeight / 2,
            margin,
            svgSize - margin - boxHeight
          )
          const textX = boxX + boxWidth / 2
          const textY = boxY + boxHeight / 2

          return (
            <g key={seat.position}>
              {/* Line connecting position marker to the label box */}
              <line
                x1={markerX}
                y1={markerY}
                x2={textX}
                y2={textY}
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-400"
              />

              {/* Position marker (small circle at seat location) */}
              <circle
                cx={markerX}
                cy={markerY}
                r="8"
                fill="currentColor"
                className="text-gray-800"
              />

              {/* Background rectangle for name text */}
              <rect
                x={boxX}
                y={boxY}
                width={boxWidth}
                height={boxHeight}
                fill="white"
                stroke="currentColor"
                strokeWidth={seat.is_facilitator ? 2.5 : 1}
                className={seat.is_facilitator ? 'text-gray-800' : 'text-gray-300'}
                rx="4"
              />

              {/* Name text */}
              <text
                x={textX}
                y={textY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-sm font-bold fill-current text-gray-900"
                style={{ whiteSpace: 'nowrap' }}
              >
                {displayName}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default CircularTable
