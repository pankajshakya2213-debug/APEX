import { useEffect, useCallback, useRef, useState, KeyboardEvent } from 'react'
import PlasmaBlob from '@renderer/components/PlasmaBlob'
import { irisService } from '@renderer/services/Iris-voice-ai'
import {
  RiCameraLine,
  RiCpuLine,
  RiDatabase2Line,
  RiFolderOpenLine,
  RiImageLine,
  RiHistoryLine,
  RiImageAddLine,
  RiLayoutGridLine,
  RiMicLine,
  RiMicOffLine,
  RiSettings4Line,
  RiPhoneFill,
  RiPhoneLine,
  RiSwapBoxLine
} from 'react-icons/ri'
import * as faceapi from 'face-api.js'
import { VisionMode } from '@renderer/IndexRoot'

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

interface DashboardViewProps {
  props: APEXProps
  stats: any
  chatHistory: any[]
  onVisionClick: () => void
  blobColor: string
  onNavigate: (tab: string) => void
}

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick,
  blobColor,
  onNavigate
}: DashboardViewProps) {
  const {
    isSystemActive,
    isVideoOn,
    visionMode,
    startVision,
    stopVisionMode,
    toggleMic,
    toggleSystem,
    isMicMuted,
    cameraStream,
    screenStream,
    isCameraOn,
    isScreenOn
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const feedVideoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceScanInterval = useRef<NodeJS.Timeout | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [voiceCommand, setVoiceCommand] = useState('')
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [imageSendStatus, setImageSendStatus] = useState<string | null>(null)
  const [irisStatus, setIrisStatus] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>(
    'IDLE'
  )
  const [networkState, setNetworkState] = useState(irisService.networkState)
  const [networkDetail, setNetworkDetail] = useState(irisService.networkDetail)

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      setAttachedImage(base64)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const handleCommandSubmit = () => {
    const commandText = voiceCommand.trim()

    if (!attachedImage && !commandText) return
    if (!irisService.isConnected) {
      alert('APEX voice engine is not active. Enable the AI system first.')
      return
    }

    if (attachedImage && commandText) {
      setImageSendStatus('Sending image + text...')
      irisService.sendImageWithText(attachedImage, commandText)
      setTimeout(() => setImageSendStatus(null), 2000)
    } else if (attachedImage) {
      setImageSendStatus('Sending image...')
      irisService.sendVideoFrame(attachedImage)
      setTimeout(() => setImageSendStatus(null), 2000)
    } else if (commandText) {
      irisService.sendTextCommand(commandText)
    }

    setVoiceCommand('')
    setAttachedImage(null)
  }

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleCommandSubmit()
    }
  }

  const handleChatScroll = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 80
  }

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || !shouldAutoScrollRef.current) return
    scroller.scrollTop = scroller.scrollHeight
  }, [chatHistory])

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
      } catch (e) {
      }
    }
    loadModels()
  }, [])

  useEffect(() => {
    const handleStatusChange = (e: any) => {
      setIrisStatus(e.detail)
    }
    window.addEventListener('iris-status-change', handleStatusChange)
    return () => window.removeEventListener('iris-status-change', handleStatusChange)
  }, [])

  useEffect(() => {
    const handleNetworkChange = (e: any) => setNetworkState(e.detail)
    window.addEventListener('iris-network-change', handleNetworkChange)
    return () => window.removeEventListener('iris-network-change', handleNetworkChange)
  }, [])

  useEffect(() => {
    const handleNetworkDetail = (e: any) => setNetworkDetail(e.detail)
    window.addEventListener('iris-network-detail', handleNetworkDetail)
    return () => window.removeEventListener('iris-network-detail', handleNetworkDetail)
  }, [])

  useEffect(() => {
    if (
      isCameraOn &&
      modelsLoaded &&
      videoElementRef.current &&
      canvasRef.current
    ) {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)

      faceScanInterval.current = setInterval(async () => {
        const video = videoElementRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) return

        try {
          const vw = video.videoWidth
          const vh = video.videoHeight

          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw
            canvas.height = vh
          }

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
          const detection = await faceapi
            .detectSingleFace(video, options)
            .withFaceExpressions()
            .withAgeAndGender()

          ctx.clearRect(0, 0, vw, vh)

          if (detection) {
            const { x, y, width, height } = detection.detection.box
            const mirroredX = vw - x - width
            const l = 25

            ctx.strokeStyle = '#34d399'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(mirroredX, y + l)
            ctx.lineTo(mirroredX, y)
            ctx.lineTo(mirroredX + l, y)
            ctx.moveTo(mirroredX + width - l, y)
            ctx.lineTo(mirroredX + width, y)
            ctx.lineTo(mirroredX + width, y + l)
            ctx.moveTo(mirroredX, y + height - l)
            ctx.lineTo(mirroredX, y + height)
            ctx.lineTo(mirroredX + l, y + height)
            ctx.moveTo(mirroredX + width - l, y + height)
            ctx.lineTo(mirroredX + width, y + height)
            ctx.lineTo(mirroredX + width, y + height - l)
            ctx.stroke()
          }
        } catch (e) {
        }
      }, 250)
    } else {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }

    return () => {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
    }
  }, [isCameraOn, modelsLoaded])

  const setCameraVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node
      if (node && cameraStream && isCameraOn) {
        node.srcObject = cameraStream
        node.onloadedmetadata = () => node.play().catch(() => { })
      }
    },
    [cameraStream, isCameraOn]
  )

  const setFeedVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      feedVideoElementRef.current = node
      if (node && screenStream && isScreenOn) {
        node.srcObject = screenStream
        node.onloadedmetadata = () => node.play().catch(() => { })
      }
    },
    [screenStream, isScreenOn]
  )

  const toggleFeed = () => {
    if (!isSystemActive) return
    if (isScreenOn && stopVisionMode) stopVisionMode('screen')
    else startVision('screen')
  }

  const toggleCamera = () => {
    if (!isSystemActive) return
    if (isCameraOn && stopVisionMode) stopVisionMode('camera')
    else startVision('camera')
  }

  const assistantState =
    irisStatus === 'THINKING'
      ? 'Thinking...'
      : irisStatus === 'SPEAKING'
        ? 'Speaking...'
        : irisStatus === 'LISTENING' || isSystemActive
          ? 'Listening...'
          : 'Standby'

  const robotMood =
    irisStatus === 'THINKING'
      ? 'thinking'
      : irisStatus === 'SPEAKING'
        ? 'speaking'
        : irisStatus === 'LISTENING' || isSystemActive
          ? 'listening'
          : 'idle'

  const navButtons = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <RiLayoutGridLine /> },
    { id: 'SETTINGS', label: 'Settings', icon: <RiSettings4Line /> },
    { id: 'GALLERY', label: 'Photos', icon: <RiImageLine /> },
    { id: 'NOTES', label: 'Notes', icon: <RiFolderOpenLine /> },
    { id: 'Macros', label: 'Macro', icon: <RiHistoryLine /> },
    { id: 'PHONE', label: 'Phone', icon: <RiPhoneLine /> }
  ]

  return (
    <div className="grid h-full w-full grid-cols-12 gap-5 overflow-hidden bg-[#080a09] px-5 pb-5 pt-5">
      <div className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-3">
        <div className="relative h-[150px] overflow-hidden rounded-[24px] border border-emerald-400/25 bg-[#111413] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isScreenOn ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-500'}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Real Time Feed
            </span>
          </div>
          <video
            ref={setFeedVideoRef}
            className={`h-full w-full object-cover ${isScreenOn ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            playsInline
            muted
          />
          {!isScreenOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
              <RiCameraLine size={24} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">No Signal</span>
            </div>
          )}
          <button
            onClick={toggleFeed}
            disabled={!isSystemActive}
            className={`absolute bottom-3 right-3 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              isScreenOn
                ? 'border-red-400/30 bg-red-500/15 text-red-300'
                : 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300 disabled:opacity-40'
            }`}
          >
            {isScreenOn ? 'Feed Off' : 'Feed On'}
          </button>
        </div>

        <div className="grid gap-2">
          {navButtons.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex h-10 items-center gap-3 rounded-xl border border-white/10 bg-[#111413] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
            >
              <span className="text-emerald-400">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-[#111413]">
          {[
            { label: 'CPU', value: props.isSystemActive && stats ? `${stats.cpu}%` : '--', icon: <RiCpuLine /> },
            { label: 'OS', value: stats?.os?.type || '--', icon: <RiLayoutGridLine /> },
            { label: 'Memory', value: props.isSystemActive && stats ? `${stats.memory.usedPercentage}%` : '--', icon: <RiDatabase2Line /> },
            { label: 'Temp', value: stats?.temperature ? `${stats.temperature}C` : '--', icon: <RiSwapBoxLine /> }
          ].map((metric) => (
            <div key={metric.label} className="flex min-h-[86px] flex-col justify-between border border-white/5 p-4">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-lg text-emerald-400">{metric.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{metric.label}</span>
              </div>
              <span className="text-lg font-semibold text-zinc-100">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative col-span-12 flex min-h-0 flex-col items-center justify-between overflow-hidden lg:col-span-6">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111413]/95 px-6 py-2 text-center text-sm font-semibold tracking-[0.18em] text-zinc-200 shadow-lg">
          APEX
        </div>

        <div className="relative flex h-[330px] w-[380px] max-w-full flex-col items-center justify-center rounded-[34px] border border-white/10 bg-[#111413]/75 shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
          <div className="relative h-[250px] w-[250px]">
            <PlasmaBlob active={isSystemActive} mood={robotMood} color={blobColor} />
          </div>
          <div className="absolute bottom-8 text-center">
            <p className="text-[21px] font-semibold text-white">{assistantState}</p>
            <span className="mt-1 block text-xs text-zinc-400">
              {isSystemActive ? 'How can I help you?' : 'Tap call to connect'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <button
            onClick={toggleMic}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition-all ${isMicMuted
                ? 'border-red-400/40 bg-red-500/15 text-red-300'
                : 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
              }`}
            title="System Mic"
          >
            {isMicMuted ? <RiMicOffLine size={24} /> : <RiMicLine size={24} />}
          </button>
          <button
            onClick={toggleSystem}
            className={`relative flex h-14 w-44 items-center rounded-2xl border px-2 text-sm font-semibold transition-all ${isSystemActive
                ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                : 'border-white/15 bg-[#111413] text-zinc-400'
              }`}
            title="Voice System"
          >
            <span className="absolute inset-y-2 left-2 right-2 rounded-xl bg-black/25" />
            <span
              className={`absolute top-2 flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ${isSystemActive
                  ? 'left-[calc(100%-3rem)] border-emerald-300/50 bg-emerald-400 text-black shadow-[0_0_18px_rgba(52,211,153,0.45)]'
                  : 'left-2 border-white/10 bg-white/[0.04] text-zinc-400'
                }`}
            >
              <RiPhoneFill size={20} className={isSystemActive ? 'rotate-[135deg]' : ''} />
            </span>
            <span className={`relative z-10 w-full px-3 transition-all ${isSystemActive ? 'pr-12 text-left' : 'pl-12 text-right'}`}>
              {isSystemActive ? 'Call On' : 'Call Off'}
            </span>
          </button>
          <button
            onClick={toggleCamera}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${isCameraOn
                ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                : 'border-white/15 bg-[#111413] text-zinc-400'
              }`}
            title="Camera On/Off"
          >
            {isCameraOn ? <RiSwapBoxLine size={22} /> : <RiCameraLine size={22} />}
          </button>
        </div>
      </div>

      <div className="col-span-12 grid min-h-0 grid-rows-[minmax(0,1fr)_170px] gap-3 lg:col-span-3">
        <div className="relative min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#111413] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="absolute left-0 right-0 top-0 h-16 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Chat History</h2>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Live command stream
                </p>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                {chatHistory.length}
              </div>
            </div>
          </div>

          <div className="absolute bottom-[86px] left-0 right-0 top-16">
            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="h-full space-y-3 overflow-y-auto px-4 py-4 scrollbar-small"
            >
              {chatHistory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-700 opacity-50">
                  <RiHistoryLine size={24} />
                  <span className="font-mono text-[9px] uppercase tracking-widest">No chat yet</span>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl border px-3.5 py-3 text-sm leading-snug shadow-sm ${msg.role === 'user'
                          ? 'rounded-br-md border-emerald-400/20 bg-emerald-400/12 text-emerald-50'
                          : 'rounded-bl-md border-white/10 bg-black/22 text-zinc-100'
                        }`}
                    >
                      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${msg.role === 'user' ? 'bg-emerald-300' : 'bg-cyan-300'
                            }`}
                        />
                        <span>{msg.role === 'user' ? 'You' : 'APEX'}</span>
                      </div>
                      {msg.image && (
                        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                          <RiImageAddLine size={14} className="text-emerald-400" />
                          <span>[Image sent]</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">
                        {msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0f1110]/95 px-3 py-3 backdrop-blur-xl">
            {attachedImage && (
              <div className="absolute bottom-[82px] left-3 right-3 rounded-xl border border-emerald-500/30 bg-[#0d1712] p-2 shadow-lg">
                <img
                  src={`data:image/jpeg;base64,${attachedImage}`}
                  alt="Attached"
                  className="mb-2 max-h-24 rounded-lg"
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="text-[10px] text-emerald-400 underline hover:text-emerald-300"
                >
                  Remove Image
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
                title="Attach Image"
              >
                <RiImageAddLine size={18} />
              </button>
              <input
                value={voiceCommand}
                onChange={(e) => setVoiceCommand(e.target.value)}
                onKeyDown={handleCommandKeyDown}
                placeholder="Type your command"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleCommandSubmit}
                className="shrink-0 rounded-xl bg-emerald-500 px-4 py-3 text-[11px] font-bold text-black transition-colors hover:bg-emerald-400"
              >
                {attachedImage && voiceCommand ? 'SEND ALL' : attachedImage ? 'SEND IMG' : 'SEND'}
              </button>
            </div>
            <p className="mt-1 min-h-3 text-[9px] text-zinc-500">
              {imageSendStatus && <span className="text-emerald-400">{imageSendStatus}</span>}
              {!imageSendStatus && attachedImage && 'Image attached'}
            </p>
          </div>
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#111413] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isCameraOn ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Camera
            </span>
          </div>
          <video
            ref={setCameraVideoRef}
            className={`h-full w-full -scale-x-100 object-cover ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          {!isCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
              <RiCameraLine size={24} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">Camera Offline</span>
            </div>
          )}
          {isCameraOn && (
            <button
              onClick={toggleCamera}
              className="absolute right-4 top-4 rounded-md border border-white/10 bg-black/60 p-1.5 text-emerald-300"
            >
              <RiSwapBoxLine size={15} />
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
