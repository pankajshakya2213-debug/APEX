import { motion } from 'framer-motion'
import { useState, ReactNode } from 'react'

interface DraggableBlockProps {
  id: string
  initialPos: { x: number; y: number; w: number | string; h: number | string }
  onLayoutChange: (id: string, layout: { x: number; y: number; w: number; h: number }) => void
  children: ReactNode
  isLocked?: boolean
  constraintsRef?: React.RefObject<any>
}

export default function DraggableBlock({ id, initialPos, onLayoutChange, children, isLocked = false, constraintsRef }: DraggableBlockProps) {
  const [size, setSize] = useState({ w: initialPos.w, h: initialPos.h })
  const [isResizing, setIsResizing] = useState(false)

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = typeof size.w === 'number' ? size.w : (e.currentTarget.parentElement?.clientWidth || 300)
    const startHeight = typeof size.h === 'number' ? size.h : (e.currentTarget.parentElement?.clientHeight || 200)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX))
      const newHeight = Math.max(150, startHeight + (moveEvent.clientY - startY))
      setSize({ w: newWidth, h: newHeight })
    }

    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <motion.div
      drag={!isLocked && !isResizing}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef}
      onDragEnd={(_, info: any) => {
        // Use info.point for absolute screen coords or info.offset for relative
        // For local storage layout, info.point is best if tracking absolute pos in relative container
        onLayoutChange(id, { 
          x: info.point.x,
          y: info.point.y,
          w: parseFloat(String(size.w)),
          h: parseFloat(String(size.h))
        })
      }}
      initial={{ x: initialPos.x, y: initialPos.y }}
      animate={{ 
        x: initialPos.x, 
        y: initialPos.y, 
        width: size.w, 
        height: size.h 
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.5 }}
      style={{
        position: 'absolute',
        zIndex: isResizing || !isLocked ? 100 : 10,
      }}
      className="group cursor-grab active:cursor-grabbing"
    >
      <div className="w-full h-full relative overflow-hidden rounded-[28px]">
        {children}
        
        {/* Resize Handle */}
        {!isLocked && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-2 right-2 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-white/40 rounded-br-sm" />
          </div>
        )}

        {/* Drag Handle Overlay (Subtle) */}
        {!isLocked && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="w-12 h-1 bg-white/20 rounded-full" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
