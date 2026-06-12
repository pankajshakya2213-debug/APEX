import React, { useState, useCallback } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider
} from 'reactflow'
import { Tooltip } from 'react-tooltip'
import 'reactflow/dist/style.css'
import 'react-tooltip/dist/react-tooltip.css'
import ToolNode, { getIcon } from '../components/ToolNode'
import ParameterEditorDrawer from '../components/ParameterEditorDrawer'
import MacroManagementMenu from '../components/MacroManagementMenu'
import {
  RiSave3Line,
  RiLayoutColumnLine,
  RiLayoutColumnFill,
  RiAddLine,
  RiPlayFill
} from 'react-icons/ri'

import { getMacroSequence } from '@renderer/code/macro-executor'
import {
  clickOnCoordinate,
  scrollScreen,
  setVolume,
  takeScreenshot
} from '@renderer/functions/keybaord-manager'
import { closeApp, openApp, performWebSearch } from '@renderer/functions/apps-manager-api'
import {
  scheduleWhatsAppMessage,
  sendWhatsAppMessage
} from '@renderer/functions/whatsapp-manager-api'
import { runTerminal } from '@renderer/functions/coding-manager-api'
import { draftEmail, readEmails, sendEmail } from '@renderer/functions/gmail-manager-api'

const CATEGORIZED_TOOLS = {
  TRIGGERS: [
    { name: 'TRIGGER', description: 'Starts the workflow.', parameters: {} },
    {
      name: 'WAIT',
      description: 'Pauses execution.',
      parameters: {
        properties: { milliseconds: { type: 'NUMBER', description: 'Delay in ms (e.g. 2000)' } }
      }
    }
  ],
  SYSTEM: [
    {
      name: 'open_app',
      description: 'Launch desktop app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'close_app',
      description: 'Force close an app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'set_volume',
      description: 'Change system volume (0-100).',
      parameters: { properties: { level: { type: 'NUMBER' } } }
    }
  ],
  AUTOMATION: [
    {
      name: 'ghost_type',
      description: 'Type text via keyboard.',
      parameters: { properties: { text: { type: 'STRING' } } }
    },
    {
      name: 'press_shortcut',
      description: 'e.g. key: "c", modifiers: ["control"].',
      parameters: {
        properties: {
          key: { type: 'STRING' },
          modifiers: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    },
    {
      name: 'click_on_screen',
      description: 'Click on specific X, Y coordinates.',
      parameters: {
        properties: {
          x: { type: 'NUMBER', description: 'X Coordinate (e.g. 960)' },
          y: { type: 'NUMBER', description: 'Y Coordinate (e.g. 540)' }
        }
      }
    },
    {
      name: 'run_terminal',
      description: 'Execute CLI command.',
      parameters: { properties: { command: { type: 'STRING' }, path: { type: 'STRING' } } }
    }
  ],
  WEB_INTELLIGENCE: [
    {
      name: 'google_search',
      description: 'Open a URL or search.',
      parameters: { properties: { query: { type: 'STRING' } } }
    },
    {
      name: 'deep_research',
      description: 'AI Web scrape & Notion report.',
      parameters: { properties: { query: { type: 'STRING' } } }
    },
    {
      name: 'deploy_wormhole',
      description: 'Exposes local server port to the internet.',
      parameters: { properties: { port: { type: 'NUMBER', description: 'e.g. 3000' } } }
    },
    {
      name: 'close_wormhole',
      description: 'Closes the public wormhole.',
      parameters: {}
    }
  ],
  COMMUNICATION: [
    {
      name: 'send_email',
      description: 'Send an email instantly.',
      parameters: {
        properties: {
          to: { type: 'STRING' },
          subject: { type: 'STRING' },
          body: { type: 'STRING' }
        }
      }
    },
    {
      name: 'read_emails',
      description: 'Read latest unread emails.',
      parameters: { properties: { max_results: { type: 'NUMBER', description: 'Default is 5' } } }
    },
    {
      name: 'draft_email',
      description: 'Create an email draft.',
      parameters: {
        properties: {
          to: { type: 'STRING' },
          subject: { type: 'STRING' },
          body: { type: 'STRING' }
        }
      }
    }
  ],
  MOBILE_LINK: [
    {
      name: 'open_mobile_app',
      description: 'Requires Android package name.',
      parameters: { properties: { package_name: { type: 'STRING' } } }
    },
    {
      name: 'toggle_mobile_hardware',
      description: 'Toggle Wifi/Bluetooth.',
      parameters: { properties: { setting: { type: 'STRING' }, state: { type: 'BOOLEAN' } } }
    },
    {
      name: 'send_whatsapp',
      description: 'Send instant message.',
      parameters: {
        properties: {
          name: { type: 'STRING' },
          message: { type: 'STRING' },
          file_path: { type: 'STRING', description: 'Optional' }
        }
      }
    },
    {
      name: 'schedule_whatsapp',
      description: 'Schedule a WhatsApp message.',
      parameters: {
        properties: {
          name: { type: 'STRING' },
          message: { type: 'STRING' },
          delay_minutes: { type: 'NUMBER' },
          file_path: { type: 'STRING', description: 'Optional' }
        }
      }
    }
  ]
}

const ALL_TOOLS = Object.values(CATEGORIZED_TOOLS).flat()
const nodeTypes = { customTool: ToolNode }

function Editor() {
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [workflowName, setWorkflowName] = useState('New APEX Macro')
  const [description, setDescription] = useState('Custom Macro')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const openParameterEditor = useCallback((nodeId: string) => setSelectedNodeId(nodeId), [])

  const loadMacroToCanvas = (macro: any) => {
    setWorkflowName(macro.name)
    setDescription(macro.description)

    const rehydratedNodes = (macro.nodes || []).map((node: any) => ({
      ...node,
      data: {
        ...node.data,
        openParameterEditor
      }
    }))

    setNodes(rehydratedNodes)
    setEdges(macro.edges || [])
    setIsSaved(true)
  }

  const resetCanvas = () => {
    setWorkflowName('New APEX Macro')
    setDescription('Custom Macro')
    setNodes([])
    setEdges([])
    setIsSaved(false)
  }

  const updateNodeInputs = useCallback(
    (nodeId: string, updatedInputs: any, updatedComment: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, inputs: updatedInputs, comment: updatedComment }
            }
          }
          return node
        })
      )
    },
    []
  )

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'default',
            animated: true,
            className: 'neural-edge-prism',
            style: { 
              stroke: 'url(#aurora-prism-gradient)', 
              strokeWidth: 3 
            }
          },
          eds
        )
      ),
    []
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const toolName = event.dataTransfer.getData('application/reactflow')
      if (!toolName) return

      const toolSchema = ALL_TOOLS.find((t) => t.name === toolName)
      const position = { x: event.clientX - (isSidebarOpen ? 300 : 50), y: event.clientY - 100 }

      const newNode = {
        id: `${toolName}_${Date.now()}`,
        type: 'customTool',
        position,
        data: { tool: toolSchema, inputs: {}, comment: '', openParameterEditor }
      }
      setNodes((nds) => nds.concat(newNode))
    },
    [openParameterEditor, isSidebarOpen]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const saveWorkflow = async () => {
    const sanitizedNodes = nodes.map((node) => {
      const cleanData = { ...node.data }
      delete cleanData.openParameterEditor
      return { ...node, data: cleanData }
    })

    try {
      const res = await (window as any).electron.ipcRenderer.invoke('save-workflow', {
        name: workflowName,
        description: description,
        nodes: sanitizedNodes,
        edges
      })
      if (res.success) {
        setIsSaved(true)
      } else {
      }
    } catch (err) {
    }
  }

  const runMacroManually = async () => {
    await saveWorkflow()

    const macroRes = await getMacroSequence(workflowName)

    if (!macroRes.success) {
      alert(`❌ Execution Failed: ${macroRes.error}`)
      return
    }

    for (const step of macroRes.steps) {

      try {
        if (step.tool === 'TRIGGER' || step.tool === 'TRIGGER_VOICE') {
        } else if (step.tool === 'WAIT') {
          await new Promise((resolve) =>
            setTimeout(resolve, Number(step.args.milliseconds) || 1000)
          )
        } else if (step.tool === 'set_volume') {
          await setVolume(Number(step.args.level))
        } else if (step.tool === 'open_app') {
          await openApp(step.args.app_name)
        } else if (step.tool === 'close_app') {
          await closeApp(step.args.app_name)
        } else if (step.tool === 'send_whatsapp') {
          await sendWhatsAppMessage(step.args.name, step.args.message, step.args.file_path)
        } else if (step.tool === 'schedule_whatsapp') {
          await scheduleWhatsAppMessage(
            step.args.name,
            step.args.message,
            Number(step.args.delay_minutes),
            step.args.file_path
          )
        } else if (step.tool === 'google_search') {
          await performWebSearch(step.args.query)
        } else if (step.tool === 'run_terminal') {
          await runTerminal(step.args.command, step.args.path)
        } else if (step.tool === 'send_email') {
          await sendEmail(step.args.to, step.args.subject, step.args.body)
        } else if (step.tool === 'draft_email') {
          await draftEmail(step.args.to, step.args.subject, step.args.body)
        } else if (step.tool === 'read_emails') {
          await readEmails(Number(step.args.max_results) || 5)
        } else if (step.tool === 'deploy_wormhole') {
          await (window as any).electron.ipcRenderer.invoke(
            'deploy-wormhole',
            Number(step.args.port)
          )
        } else if (step.tool === 'close_wormhole') {
          await (window as any).electron.ipcRenderer.invoke('close-wormhole')
        } else if (step.tool === 'click_on_screen') {
          await clickOnCoordinate(Number(step.args.x), Number(step.args.y))
        } else if (step.tool === 'scroll_screen') {
          await scrollScreen(step.args.direction, Number(step.args.amount))
        }

        else if (step.tool === 'ghost_type') {
          await (window as any).electron.ipcRenderer.invoke('ghost-sequence', [
            { type: 'type', text: step.args.text }
          ])
        } else if (step.tool === 'press_shortcut') {
          let safeModifiers: string[] = []

          if (step.args.modifiers) {
            if (Array.isArray(step.args.modifiers)) {
              safeModifiers = step.args.modifiers
            } else if (typeof step.args.modifiers === 'string') {
              safeModifiers = step.args.modifiers
                .split(',')
                .map((m: string) => m.trim())
                .filter(Boolean)
            }
          }

          await (window as any).electron.ipcRenderer.invoke('ghost-sequence', [
            { type: 'press', key: step.args.key, modifiers: safeModifiers }
          ])
        } else if (step.tool === 'take_screenshot') {
          await takeScreenshot()
        } else {
        }
      } catch (stepError) {
        alert(`🔴 Macro Execution Halted! Failed at node: ${step.tool}`)
        break
      }
    }

  }

  return (
    <div className="flex h-full w-full bg-[#090b0c] relative overflow-hidden font-sans text-zinc-100">
      <div
        className={`fixed top-10 left-0 h-[calc(100vh-96px)] overflow-y-auto border-r border-white/10 bg-[#101214] p-4 flex flex-col gap-1 transition-all duration-300 ease-in-out z-40 library-scrollbar overflow-x-hidden ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-10 p-0'}`}
      >
        {isSidebarOpen && (
          <>
            <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
              <h2 className="text-xs font-semibold tracking-wide text-zinc-100">
                Module Library
              </h2>
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>

            {Object.entries(CATEGORIZED_TOOLS).map(([category, tools]) => (
              <div key={category} className="mb-6">
                <h3 className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase mb-3 flex items-center gap-2">
                  {category.replace(/_/g, ' ')}
                </h3>
                <div className="flex flex-col gap-2">
                  {tools.map((tool: any) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#151719] p-2.5 cursor-grab transition-colors hover:border-emerald-400/50 hover:bg-[#191d1f] active:scale-[0.99]"
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('application/reactflow', tool.name)
                      }
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/25">
                        {getIcon(tool.name, 16)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">
                          {tool.name.replace(/_/g, ' ')}
                        </span>
                        <span className="line-clamp-1 text-[10px] text-zinc-500">
                          {tool.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-1/2 left-0 -translate-y-1/2 border border-l-0 border-white/10 bg-[#111315] p-2.5 rounded-r-lg text-zinc-400 hover:text-emerald-300 z-50 transition-all ${isSidebarOpen ? 'translate-x-[18rem]' : 'translate-x-0'}`}
      >
        {isSidebarOpen ? <RiLayoutColumnFill size={22} /> : <RiLayoutColumnLine size={22} />}
      </button>

      <div
        className="grow flex flex-col relative bg-[#090b0c]"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div
          className={`absolute bottom-20 z-10 flex items-center gap-3 transition-all ${
            isSidebarOpen ? 'left-[19rem]' : 'left-5'
          }`}
        >
          <MacroManagementMenu loadMacroToCanvas={loadMacroToCanvas} />

          <div className="flex h-10 items-center gap-3 rounded-lg border border-white/10 bg-[#111315]/95 px-3 shadow-lg backdrop-blur">
            <span className="text-xs font-medium text-zinc-500">Name</span>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="h-8 w-72 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-stretch gap-2 rounded-xl border border-white/10 bg-[#111315]/95 p-2 shadow-lg backdrop-blur">
          <button
            onClick={resetCanvas}
            className="flex h-11 min-w-28 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300 active:scale-95"
            data-tooltip-id="global-tooltip"
            data-tooltip-content="New macro"
          >
            <RiAddLine size={18} /> New
          </button>
          <button
            onClick={runMacroManually}
            className="flex h-11 min-w-28 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 text-xs font-semibold text-zinc-100 transition-colors hover:border-emerald-400/50 hover:text-emerald-300 active:scale-95"
          >
            <RiPlayFill size={18} /> Run
          </button>

          <button
            onClick={saveWorkflow}
            className="flex h-11 min-w-28 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-xs font-semibold text-black transition-colors hover:bg-emerald-400 active:scale-95"
          >
            <RiSave3Line size={18} /> Save
          </button>
        </div>

        <div
          className={`pointer-events-none absolute top-5 z-10 text-xs text-zinc-600 transition-all ${
            isSidebarOpen ? 'left-[19rem]' : 'left-5'
          }`}
        >
          Drag modules from the library and connect them on the canvas.
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          className="bg-transparent"
        >
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <linearGradient id="aurora-prism-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>

          <Background color="#1f2933" gap={24} size={1} />
          <Controls className="react-flow__controls" />
        </ReactFlow>

        <Tooltip
          id="global-tooltip"
          place="top"
          style={{
            maxWidth: '250px',
            backgroundColor: '#09090b',
            color: '#10b981',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            zIndex: 100
          }}
        />

        {selectedNodeId && (
          <ParameterEditorDrawer
            nodeData={nodes.find((n) => n.id === selectedNodeId)}
            updateNodeInputs={updateNodeInputs}
            closeEditor={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

export default function WorkFlowEditorView() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  )
}
