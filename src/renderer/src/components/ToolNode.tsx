import { useState } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import {
  RiTerminalBoxLine,
  RiGlobalLine,
  RiPhoneLine,
  RiSettings4Line,
  RiDeleteBinLine,
  RiFlashlightLine,
  RiEditBoxLine,
  RiKeyboardLine,
  RiVolumeUpLine,
  RiMailLine,
  RiServerLine
} from 'react-icons/ri'
import 'react-tooltip/dist/react-tooltip.css'
import { ListStartIcon } from 'lucide-react'

export const getIcon = (name: string, size = 16) => {
  if (name.includes('mobile') || name.includes('whatsapp'))
    return <RiPhoneLine size={size} className="text-blue-400" />
  if (name.includes('terminal') || name.includes('code') || name.includes('app'))
    return <RiTerminalBoxLine size={size} className="text-emerald-400" />
  if (name.includes('web') || name.includes('search') || name.includes('research'))
    return <RiGlobalLine size={size} className="text-cyan-400" />
  if (name.includes('type') || name.includes('shortcut') || name.includes('sequence'))
    return <RiKeyboardLine size={size} className="text-yellow-400" />
  if (name.includes('volume')) return <RiVolumeUpLine size={size} className="text-pink-400" />
  if (name.includes('email')) return <RiMailLine size={size} className="text-orange-400" />
  if (name.includes('wormhole')) return <RiServerLine size={size} className="text-purple-400" />

  if (name === 'WAIT') return <RiFlashlightLine size={size} className="text-purple-400" />
  if (name === 'TRIGGER') return <ListStartIcon size={size} className="text-red-400" />
  return <RiSettings4Line size={size} className="text-zinc-400" />
}

export default function ToolNode({ data, id }: any) {
  const { tool, comment, openParameterEditor } = data
  const { setNodes, setEdges } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)

  const deleteNode = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id))
  }

  const isTrigger = tool.name === 'TRIGGER'
  const isWait = tool.name === 'WAIT'

  const getCategoryClass = (name: string) => {
    const n = name.toLowerCase()
    if (n === 'trigger' || n === 'wait') return 'macro-category-trigger'
    if (n.includes('open_app') || n.includes('close_app') || n.includes('set_volume')) return 'macro-category-system'
    if (n.includes('ghost_type') || n.includes('press_shortcut') || n.includes('click_on_screen') || n.includes('run_terminal')) return 'macro-category-automation'
    if (n.includes('google_search') || n.includes('deep_research') || n.includes('wormhole')) return 'macro-category-web'
    if (n.includes('email')) return 'macro-category-comms'
    if (n.includes('whatsapp')) return 'macro-category-mobile'
    return ''
  }

  return (
    <div
      className={`min-w-52 max-w-64 rounded-xl border border-white/10 bg-[#141719] font-sans text-zinc-100 shadow-lg group relative ${getCategoryClass(tool.name)}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isTrigger && !isWait && (
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -ml-1.5 z-50 hover:bg-white transition-colors"
        />
      )}
      {isWait && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="target-left"
            className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -ml-1.5 z-50 hover:bg-white transition-colors"
          />
          <Handle
            type="target"
            position={Position.Top}
            id="target-top"
            className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -mt-1.5 z-50 hover:bg-white transition-colors"
          />
        </>
      )}

      <div className="flex items-center justify-between p-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/25">
            {getIcon(tool.name, 20)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-100">
              {tool.name.replace(/_/g, ' ')}
            </span>
            {comment && (
              <span className="text-[10px] text-zinc-500 mt-1 line-clamp-1 max-w-[120px]">
                {comment}
              </span>
            )}
          </div>
        </div>

        <div
          className={`flex items-center gap-1 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
        >
          <button
            onClick={() => openParameterEditor(id)}
            className="text-zinc-400 hover:text-emerald-300 bg-white/[0.03] p-1.5 rounded-md border border-white/10 transition-colors active:scale-95"
            title="Edit Parameters"
          >
            <RiEditBoxLine size={14} />
          </button>
          <button
            onClick={deleteNode}
            className="text-zinc-400 hover:text-red-300 bg-white/[0.03] p-1.5 rounded-md border border-white/10 transition-colors active:scale-95"
            title="Delete Node"
          >
            <RiDeleteBinLine size={14} />
          </button>
        </div>
      </div>

      {isTrigger && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -mb-1.5 z-50"
        />
      )}
      {isWait && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="source-right"
            className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -mr-1.5 z-50"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom"
            className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -mb-1.5 z-50"
          />
        </>
      )}
      {!isTrigger && !isWait && (
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#141719] -mr-1.5 z-50"
        />
      )}
    </div>
  )
}
