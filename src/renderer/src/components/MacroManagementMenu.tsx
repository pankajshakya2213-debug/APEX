import { useState, useEffect, useRef } from 'react'
import {
  RiBrainLine,
  RiArrowDropDownLine,
  RiMore2Fill,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiEditBoxLine
} from 'react-icons/ri'

interface MacroMenuProps {
  loadMacroToCanvas: (macro: any) => void
}

export default function MacroManagementMenu({ loadMacroToCanvas }: MacroMenuProps) {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [isMainOpen, setIsMainOpen] = useState(false)
  const [activeWorkflowActions, setActiveWorkflowActions] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadWorkflowsList = async () => {
    try {
      const res = await (window as any).electron.ipcRenderer.invoke('load-workflows')
      if (res.success) setWorkflows(res.workflows || [])
    } catch (e) {
    }
  }

  useEffect(() => {
    if (isMainOpen) loadWorkflowsList()
  }, [isMainOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMainOpen(false)
        setActiveWorkflowActions(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuRef])

  const handleEdit = (macro: any) => {
    loadMacroToCanvas(macro)
    setIsMainOpen(false)
  }

  const handleDelete = async (macroName: string) => {
    if (
      window.confirm(
        `Delete macro "${macroName}"? This cannot be undone.`
      )
    ) {
      await (window as any).electron.ipcRenderer.invoke('delete-workflow', { name: macroName })
      loadWorkflowsList()
      setActiveWorkflowActions(null)
    }
  }

  const handleDuplicate = async (macro: any) => {
    const newMacro = { ...macro, name: `${macro.name} Copy` }
    loadMacroToCanvas(newMacro)
    setIsMainOpen(false)
    alert(`Duplicated to canvas as '${newMacro.name}'. Change the name and save to finalize.`)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMainOpen(!isMainOpen)}
        className={`flex h-10 items-center gap-2 rounded-lg border bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition-colors cursor-pointer ${isMainOpen ? 'border-emerald-400/60' : 'border-white/10 hover:border-white/20'}`}
      >
        <RiBrainLine className="text-emerald-500" />
        Macros ({workflows.length})
        <RiArrowDropDownLine
          size={18}
          className={`text-zinc-600 transition-transform ${isMainOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isMainOpen && (
        <div className="absolute top-12 left-0 w-80 bg-[#111315] border border-white/10 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1 max-h-96 overflow-y-auto scrollbar-small animate-in fade-in duration-200">
          <h4 className="text-xs font-semibold text-zinc-400 p-2 border-b border-white/10 mb-2">
            Saved Macros
          </h4>

          {workflows.length === 0 && (
            <p className="text-xs text-zinc-600 p-4 text-center">
              No saved macros.
            </p>
          )}

          {workflows.map((macro: any) => (
            <div key={macro.name} className="relative group">
              <button
                onClick={() => handleEdit(macro)}
                className="w-full text-left flex flex-col gap-1 p-3 rounded-lg hover:bg-white/[0.04] group cursor-pointer border border-transparent hover:border-white/10"
              >
                <span className="text-sm font-medium text-zinc-100 group-hover:text-emerald-300">
                  {macro.name}
                </span>
                <span className="text-[10px] text-zinc-600">
                  Saved: {new Date(macro.updatedAt).toLocaleString()}
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveWorkflowActions(activeWorkflowActions === macro.name ? null : macro.name)
                }
                className="absolute top-3 right-3 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 group cursor-pointer z-10"
              >
                <RiMore2Fill size={16} />
              </button>

              {activeWorkflowActions === macro.name && (
                <div className="absolute top-8 right-2 w-32 bg-[#0c0e10] border border-white/10 rounded-lg shadow-xl z-20 p-1 flex flex-col animate-in scale-95 fade-in duration-100">
                  {[
                    { label: 'Edit', icon: <RiEditBoxLine />, action: () => handleEdit(macro) },
                    {
                      label: 'Duplicate',
                      icon: <RiFileCopyLine />,
                      action: () => handleDuplicate(macro)
                    },
                    {
                      label: 'Delete',
                      icon: <RiDeleteBinLine />,
                      className: 'text-red-300 hover:bg-red-500/10',
                      action: () => handleDelete(macro.name)
                    }
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={btn.action}
                      className={`flex items-center gap-2 p-2 rounded text-xs font-medium text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer ${btn.className}`}
                    >
                      {btn.icon} {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
