import { useState, useEffect, Suspense, lazy } from 'react'
import {
  RiWifiLine,
  RiShieldFlashLine,
  RiLayoutGridLine,
  RiBrainLine,
  RiFolderOpenLine,
  RiPhoneLine,
  RiSettings4Line,
  RiBatteryChargeLine,
  RiCameraLine,
  RiComputerLine,
  RiCloseLine,
  RiImageLine,
  RiPaletteLine
} from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import { getHistory } from '@renderer/services/iris-ai-brain'
import { irisService } from '@renderer/services/Iris-voice-ai'
import ViewSkeleton from '@renderer/components/ViewSkelrton'

import DashboardView from '../views/Dashboard'
import PhoneView from '../views/Phone'
import { VisionMode } from '@renderer/IndexRoot'


const WorkFlowEditorView = lazy(() => import('../views/WorkFlowEditor'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const GalleryView = lazy(() => import('../views/Gallery'))

interface APEXProps {
  isSystemActive: boolean
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  stopVisionMode?: (mode: 'camera' | 'screen') => void
  activeStream: MediaStream | null
  cameraStream?: MediaStream | null
  screenStream?: MediaStream | null
  isCameraOn?: boolean
  isScreenOn?: boolean
}

const glassPanel = 'aurora-glass aurora-glass-hover'

const APEX = (props: APEXProps) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [dashboardPanel, setDashboardPanel] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [time, setTime] = useState<Date>(new Date())
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)
  const [networkState, setNetworkState] = useState(irisService.networkState)
  const [networkDetail, setNetworkDetail] = useState(irisService.networkDetail)
  const [appVersion, setAppVersion] = useState('')
  const [blobColor, setBlobColor] = useState(
    () => localStorage.getItem('apex_blob_color') || '#00ffe1'
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
      getSystemStatus().then(setStats)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    window.electron?.ipcRenderer?.invoke('get-app-version').then((version) => {
      if (version) setAppVersion(version)
    })
  }, [])

  useEffect(() => {
    const handleNetworkChange = (event: any) => setNetworkState(event.detail)
    window.addEventListener('iris-network-change', handleNetworkChange)
    return () => window.removeEventListener('iris-network-change', handleNetworkChange)
  }, [])

  useEffect(() => {
    const handleNetworkDetail = (event: any) => setNetworkDetail(event.detail)
    window.addEventListener('iris-network-detail', handleNetworkDetail)
    return () => window.removeEventListener('iris-network-detail', handleNetworkDetail)
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      const history = await getHistory()
      if (Array.isArray(history)) setChatHistory(history.slice(-15))
    }
    fetchHistory()
    const interval = setInterval(fetchHistory, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleVisionClick = () => {
    if (props.isVideoOn) {
      props.stopVision()
    } else {
      setShowSourceModal(true)
    }
  }

  const handleBlobColorChange = (color: string) => {
    setBlobColor(color)
    localStorage.setItem('apex_blob_color', color)
  }

  const openDashboardPanel = (tab: string) => {
    if (tab === 'DASHBOARD') {
      setDashboardPanel(null)
      return
    }
    setDashboardPanel(tab)
  }

  const openFullTab = (tab: string) => {
    setDashboardPanel(null)
    setActiveTab(tab)
  }

  const renderPanelContent = (tab: string) => {
    if (tab === 'PHONE') return <PhoneView glassPanel={glassPanel} />
    if (tab === 'Macros') return <WorkFlowEditorView />
    if (tab === 'NOTES') return <NotesView glassPanel={glassPanel} />
    if (tab === 'SETTINGS') return <SettingsView isSystemActive={props.isSystemActive} />
    if (tab === 'GALLERY') return <GalleryView />
    return null
  }

  return (
    <div className="h-screen w-full bg-[#070908] text-zinc-100 font-sans overflow-hidden select-none flex flex-col relative">
      <div className="h-10 w-full flex items-center justify-between px-5 z-50 border-b border-white/10 bg-black/75">
        <div
          className={`absolute bottom-0 left-0 h-[2px] transition-all duration-500 ${
            networkState === 'GOOD'
              ? 'w-full bg-white/80'
              : networkState === 'SLOW'
                ? 'w-2/3 bg-yellow-400/90'
                : networkState === 'STALLED'
                  ? 'w-1/3 bg-red-500/90'
                  : networkState === 'CONNECTING'
                    ? 'w-1/2 bg-cyan-400/80'
                    : 'w-10 bg-zinc-700'
          }`}
        />
        <div className="flex items-center gap-3">
          <RiShieldFlashLine className="text-white text-xl animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
        </div>

        <div className={`fixed bottom-0 left-0 z-[80] h-14 w-full items-center justify-between border-t border-white/10 bg-black/85 px-10 backdrop-blur-xl ${activeTab === 'DASHBOARD' ? 'hidden' : 'hidden md:flex'}`}>
          <div className="flex min-w-[520px] items-center gap-7">
            {[
              { id: 'DASHBOARD', icon: <RiLayoutGridLine /> },
              { id: 'Macros', icon: <RiBrainLine /> },
              { id: 'NOTES', icon: <RiFolderOpenLine /> },
              { id: 'GALLERY', icon: <RiImageLine /> },
              { id: 'PHONE', icon: <RiPhoneLine /> },
              { id: 'SETTINGS', icon: <RiSettings4Line /> }
            ].map((tab) => (
              <div key={tab.id} className="flex items-center gap-2">
                <button
                  onClick={() => openFullTab(tab.id)}
                  className={`flex w-18 flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-medium transition-all duration-200 ${
                    activeTab === tab.id ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.id}</span>
                </button>
                {tab.id === 'DASHBOARD' && (
                  <label
                    className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                    title="Blob color"
                  >
                    <RiPaletteLine size={16} />
                    <span
                      className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black"
                      style={{ backgroundColor: blobColor }}
                    />
                    <input
                      type="color"
                      value={blobColor}
                      onChange={(event) => handleBlobColorChange(event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Blob color"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex min-w-[460px] items-center justify-end gap-4 text-[10px] font-medium text-zinc-300">
            <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-zinc-500">v{appVersion || '--'}</span>
            <div
              title={networkDetail}
              className={`flex items-center gap-2 ${
                networkState === 'GOOD'
                  ? 'text-emerald-400'
                  : networkState === 'SLOW'
                    ? 'text-yellow-300'
                    : networkState === 'STALLED'
                      ? 'text-red-400'
                      : networkState === 'CONNECTING'
                        ? 'text-cyan-300'
                        : 'text-zinc-500'
              }`}
            >
              <RiWifiLine /> <span>{networkState}</span>
            </div>
            {networkState !== 'GOOD' && (
              <span className="max-w-[220px] truncate text-zinc-500" title={networkDetail}>
                {networkDetail}
              </span>
            )}
            <span>CPU {props.isSystemActive && stats ? `${stats.cpu}%` : '--'}</span>
            <span>GPU --</span>
            <span>Memory {props.isSystemActive && stats ? `${stats.memory.usedPercentage}%` : '--'}</span>
            <div className="flex items-center gap-1">
              <RiBatteryChargeLine /> <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden relative bg-[#070908] ${activeTab === 'DASHBOARD' ? 'pb-0' : 'pb-14'}`}>
        <div className={`absolute inset-0 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}>
          <DashboardView
            props={props}
            stats={stats}
            chatHistory={chatHistory}
            onVisionClick={handleVisionClick}
            blobColor={blobColor}
            onNavigate={openDashboardPanel}
          />

          {dashboardPanel && (
            <div className="absolute bottom-5 right-5 top-5 z-[70] overflow-hidden rounded-[28px] border border-white/25 bg-[#070908]/96 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-in slide-in-from-left-24 fade-in duration-300 lg:left-[500px] left-5">
              <div className="absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-black/55 px-5 backdrop-blur-xl">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white">
                    {dashboardPanel === 'Macros' ? 'Macro' : dashboardPanel}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Slide workspace
                  </p>
                </div>
                <button
                  onClick={() => setDashboardPanel(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors hover:border-white/40 hover:text-white"
                  title="Close panel"
                >
                  <RiCloseLine size={18} />
                </button>
              </div>

              <div className="absolute inset-0 pt-14">
                <Suspense fallback={<ViewSkeleton />}>{renderPanelContent(dashboardPanel)}</Suspense>
              </div>
            </div>
          )}
        </div>

        <div className={`absolute inset-0 ${activeTab === 'PHONE' ? 'block' : 'hidden'}`}>
          <PhoneView glassPanel={glassPanel} />
        </div>

        <Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'Macros' && <WorkFlowEditorView />}
          {activeTab === 'NOTES' && <NotesView glassPanel={glassPanel} />}
          {activeTab === 'SETTINGS' && <SettingsView isSystemActive={props.isSystemActive} />}
          {activeTab === 'GALLERY' && <GalleryView />}
        </Suspense>
      </div>

      {showSourceModal && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassPanel} w-96 p-1 border-white/30 flex flex-col shadow-2xl`}>
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <span className="text-xs font-bold tracking-widest text-white">
                ESTABLISH UPLINK
              </span>
              <button
                onClick={() => setShowSourceModal(false)}
                className="cursor-pointer text-zinc-500 hover:text-white"
              >
                <RiCloseLine size={18} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  props.startVision('camera')
                  setShowSourceModal(false)
                }}
                className="cursor-pointer group flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-black/40 border border-white/10 hover:border-white/50 hover:bg-white/10 transition-all"
              >
                <div className="p-3 rounded-full bg-zinc-900 group-hover:bg-white text-zinc-400 group-hover:text-black transition-colors">
                  <RiCameraLine size={28} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-zinc-300 group-hover:text-white">
                  CAMERA FEED
                </span>
              </button>

              <button
                onClick={() => {
                  props.startVision('screen')
                  setShowSourceModal(false)
                }}
                className="cursor-pointer group flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-black/40 border border-white/10 hover:border-white/50 hover:bg-white/10 transition-all"
              >
                <div className="p-3 rounded-full bg-zinc-900 group-hover:bg-white text-zinc-400 group-hover:text-black transition-colors">
                  <RiComputerLine size={28} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-zinc-300 group-hover:text-white">
                  SCREEN SHARE
                </span>
              </button>
            </div>

            <div className="p-3 bg-black/20 text-center">
              <p className="text-[9px] text-zinc-600 font-mono">
                SELECT INPUT SOURCE FOR NEURAL PROCESSING
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default APEX
