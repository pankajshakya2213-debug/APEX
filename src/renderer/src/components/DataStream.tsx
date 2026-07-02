import { useEffect, useRef } from 'react'

interface DataStreamProps {
  status: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'
  color?: string
}

const DataStream = ({ status }: DataStreamProps) => {
  let color1 = '#ffffff'
  let color2 = '#ffffff'
  let dropShadow1 = 'rgba(255, 255, 255, 0.8)'
  let dropShadow2 = 'rgba(255, 255, 255, 0.8)'
  let targetSpeed = 1.0 // degrees per frame
  
  if (status === 'LISTENING') {
    // Red (Pinkish) and Cyan (Matches photo exactly)
    color1 = '#ff003c' // Pinkish Red
    color2 = '#00f0ff' // Cyan
    dropShadow1 = 'rgba(255, 0, 60, 0.8)'
    dropShadow2 = 'rgba(0, 240, 255, 0.8)'
    targetSpeed = 1.5
  } else if (status === 'SPEAKING') {
    // Purple and Gold
    color1 = '#a78bfa' // Purple
    color2 = '#ffd700' // Gold
    dropShadow1 = 'rgba(167, 139, 250, 0.8)'
    dropShadow2 = 'rgba(255, 215, 0, 0.8)'
    targetSpeed = 1.8
  } else if (status === 'THINKING') {
    color1 = '#a78bfa'
    color2 = '#4c1d95' // Darker purple
    dropShadow1 = 'rgba(167, 139, 250, 0.5)'
    dropShadow2 = 'rgba(76, 29, 149, 0.5)'
    targetSpeed = 2.5
  } else {
    color1 = 'rgba(255,255,255,0.1)'
    color2 = 'rgba(255,255,255,0.02)'
    dropShadow1 = 'transparent'
    dropShadow2 = 'transparent'
    targetSpeed = 0.5
  }

  // Exact pixel math for perfect alignment
  const strokeWidth = 12
  const dotSize = 18
  const offset = strokeWidth / 2 // 6px (center of the stroke)

  const containerRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(0)
  const currentSpeedRef = useRef(targetSpeed)
  const targetSpeedRef = useRef(targetSpeed)

  // Update target speed immediately when status changes
  useEffect(() => {
    targetSpeedRef.current = targetSpeed
  }, [targetSpeed])

  // Continuous animation loop for seamless dynamic speed changes
  useEffect(() => {
    let reqId: number
    const animate = () => {
      // Smoothly interpolate current speed towards target speed (acceleration/deceleration)
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * 0.05
      
      rotationRef.current = (rotationRef.current + currentSpeedRef.current) % 360
      
      if (containerRef.current) {
        containerRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      }
      
      reqId = requestAnimationFrame(animate)
    }
    
    reqId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(reqId)
  }, [])

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div 
        ref={containerRef}
        className="relative w-48 h-48" // 192px x 192px
      >
        {/* === TAIL 1 (Top Head, Color 1) === */}
        {/* Shorter tail (transparent up to 65%) so it doesn't overlap the other side */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, transparent 65%, ${color1} 100%)`,
            maskImage: `radial-gradient(closest-side, transparent calc(100% - ${strokeWidth}px - 1px), black calc(100% - ${strokeWidth}px))`,
            WebkitMaskImage: `radial-gradient(closest-side, transparent calc(100% - ${strokeWidth}px - 1px), black calc(100% - ${strokeWidth}px))`
          }}
        />
        {/* Glowing Head Top (Color 1) */}
        <div 
          className="absolute left-1/2 rounded-full"
          style={{
            top: `${offset}px`,
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: color1,
            boxShadow: `0 0 15px 4px ${dropShadow1}, 0 0 30px 8px ${dropShadow1}`,
            transform: 'translate(-50%, -50%)'
          }}
        />

        {/* === TAIL 2 (Bottom Head, Color 2) === */}
        <div 
          className="absolute inset-0 rounded-full rotate-180"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, transparent 65%, ${color2} 100%)`,
            maskImage: `radial-gradient(closest-side, transparent calc(100% - ${strokeWidth}px - 1px), black calc(100% - ${strokeWidth}px))`,
            WebkitMaskImage: `radial-gradient(closest-side, transparent calc(100% - ${strokeWidth}px - 1px), black calc(100% - ${strokeWidth}px))`
          }}
        />
        {/* Glowing Head Bottom (Color 2) */}
        <div 
          className="absolute left-1/2 rounded-full"
          style={{
            bottom: `${offset}px`,
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: color2,
            boxShadow: `0 0 15px 4px ${dropShadow2}, 0 0 30px 8px ${dropShadow2}`,
            transform: 'translate(-50%, 50%)'
          }}
        />
      </div>
    </div>
  )
}

export default DataStream
