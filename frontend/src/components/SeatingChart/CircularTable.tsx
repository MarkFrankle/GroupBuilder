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
  // SVG dimensions - increased to prevent name truncation
  const svgSize = 500
  const centerX = svgSize / 2
  const centerY = svgSize / 2
  const radius = 180 // Radius for name positions (increased to push names further out)
  const circleRadius = 100 // Visual circle radius

  const totalSeats = seats.length
  const angleStep = (2 * Math.PI) / totalSeats

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
        const facilitators = seats.filter(s => s.is_facilitator)
        if (facilitators.length === 0) return null
        return (
          <div
            className="mb-2 text-xs text-amber-700 font-medium text-center"
            data-testid="facilitator-subtitle"
          >
            {facilitators.map(f => shortenName(f.name)).join(' · ')}
          </div>
        )
      })()}

      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="circular-table-svg overflow-visible"
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

          // Name position (further out from circle)
          const nameX = centerX + radius * Math.cos(angle)
          const nameY = centerY + radius * Math.sin(angle)

          // Determine text anchor based on position to avoid overlap with circle
          let textAnchor: 'start' | 'middle' | 'end' = 'middle'
          if (angle > -Math.PI / 4 && angle < Math.PI / 4) {
            // Right side
            textAnchor = 'start'
          } else if (angle > (3 * Math.PI) / 4 || angle < (-3 * Math.PI) / 4) {
            // Left side
            textAnchor = 'end'
          }

          // Shorten name if needed
          const displayName = shortenName(seat.name)

          return (
            <g key={seat.position}>
              {/* Line connecting position marker to name */}
              <line
                x1={markerX}
                y1={markerY}
                x2={nameX}
                y2={nameY}
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
                x={textAnchor === 'end' ? nameX - 130 : textAnchor === 'start' ? nameX - 5 : nameX - 65}
                y={nameY - 16}
                width="135"
                height="32"
                fill="white"
                stroke="currentColor"
                strokeWidth={seat.is_facilitator ? 2 : 1}
                className={seat.is_facilitator ? "text-amber-500" : "text-gray-300"}
                rx="4"
              />

              {/* Name text */}
              <text
                x={nameX}
                y={nameY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className={`text-sm font-bold fill-current ${seat.is_facilitator ? "text-amber-700" : "text-gray-900"}`}
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
