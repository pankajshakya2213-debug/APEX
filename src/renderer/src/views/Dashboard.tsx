import { useEffect, useCallback, useRef, useState, KeyboardEvent } from 'react'
import PlasmaBlob from '@renderer/components/PlasmaBlob'
import { irisService } from '@renderer/services/Iris-voice-ai'
import {
  RiCameraLine,
  RiHistoryLine,
  RiImageAddLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneFill,
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
  activeStream: MediaStream | null
}

interface DashboardViewProps {
  props: APEXProps
  stats: any
  chatHistory: any[]
  onVisionClick: () => void
  blobColor: string
}

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick,
  blobColor
}: DashboardViewProps) {
  const {
    isSystemActive,
    isVideoOn,
    visionMode,
    startVision,
    activeStream,
    toggleMic,
    toggleSystem,
    isMicMuted
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
      isVideoOn &&
      visionMode === 'camera' &&
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
  }, [isVideoOn, visionMode, modelsLoaded])

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn]
  )

  const toggleSource = () => {
    if (!isSystemActive) return
    const nextMode = visionMode === 'camera' ? 'screen' : 'camera'
    startVision(nextMode)
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

  return (
    <div className="grid h-full w-full grid-cols-12 gap-5 overflow-hidden bg-[#080a09] px-6 pb-4 pt-5">
      <div className="relative col-span-12 flex h-full flex-col items-center justify-center overflow-hidden lg:col-span-9">
        <div className="absolute top-0 h-12 w-px bg-white/20" />

        <div className="relative flex h-[360px] w-[640px] max-w-full items-center justify-center gap-[116px]">
          <button
            onClick={toggleMic}
            className={`z-20 flex h-[58px] w-[58px] shrink-0 cursor-pointer items-center justify-center rounded-full text-3xl transition-all duration-200 ${
              isMicMuted
                ? 'border border-red-400/40 bg-red-500/15 text-red-300'
                : 'bg-emerald-400 text-black shadow-[0_0_34px_rgba(52,211,153,0.5)]'
            }`}
            title="System Mic"
          >
            {isMicMuted ? <RiMicOffLine size={28} /> : <RiMicLine size={28} />}
          </button>

          <div className="relative h-[390px] w-[390px] shrink-0">
            <PlasmaBlob active={isSystemActive} mood={robotMood} color={blobColor} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
              <p className="text-[22px] font-semibold text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]">
                {assistantState}
              </p>
              <span className="mt-1 block text-sm text-zinc-300/80">
                {isSystemActive ? 'How can I help you?' : 'Tap call to connect'}
              </span>
            </div>
          </div>

          <button
            onClick={toggleSystem}
            className={`z-20 flex h-[58px] w-[58px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-200 ${
              isSystemActive
                ? 'border-white bg-white/5 text-white shadow-[0_0_20px_rgba(255,255,255,0.18)]'
                : 'border-white/45 bg-black/20 text-zinc-300'
            }`}
            title="Voice System"
          >
            <RiPhoneFill size={25} className={isSystemActive ? 'rotate-[135deg]' : ''} />
          </button>
        </div>

        <button
          onClick={onVisionClick}
          className={`mt-12 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition-all duration-200 ${
            isVideoOn
              ? 'border-red-400/50 bg-red-500/15 text-red-300'
              : 'border-white/20 bg-white/5 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300'
          }`}
          title="Toggle Optics"
        >
          {isVideoOn ? <RiSwapBoxLine size={21} /> : <RiCameraLine size={22} />}
        </button>

        <div className="absolute left-6 top-6 h-[210px] w-[330px] overflow-hidden rounded-[22px] border border-fuchsia-300/20 bg-[linear-gradient(145deg,rgba(88,17,49,0.72),rgba(24,14,34,0.78))] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isVideoOn ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-zinc-500'}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {isVideoOn ? (visionMode === 'screen' ? 'Screen Feed' : 'Optical Feed') : 'Optics Offline'}
            </span>
          </div>
          <video
            key={visionMode}
            ref={setVideoRef}
            className={`h-full w-full object-cover ${isVideoOn ? 'opacity-100' : 'opacity-0'} ${visionMode === 'camera' ? '-scale-x-100' : ''}`}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          {!isVideoOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fuchsia-100/25">
              <RiCameraLine size={26} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">No Signal</span>
            </div>
          )}
          {isVideoOn && (
            <button
              onClick={toggleSource}
              className="absolute right-3 top-3 rounded-md border border-white/10 bg-black/60 p-1 text-emerald-300"
            >
              <RiSwapBoxLine size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="relative hidden h-full min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#111413] shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:col-span-3 lg:block">
        <div className="absolute left-0 right-0 top-0 h-[70px] border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-4 py-3">
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

        <div className="absolute bottom-[116px] left-0 right-0 top-[70px]">
          <div ref={scrollRef} className="h-full space-y-3 overflow-y-auto px-3 py-4 scrollbar-small">
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
                    className={`max-w-[88%] rounded-2xl border px-3.5 py-3 text-sm leading-snug shadow-sm ${
                      msg.role === 'user'
                        ? 'rounded-br-md border-emerald-400/20 bg-emerald-400/12 text-emerald-50'
                        : 'rounded-bl-md border-white/10 bg-black/22 text-zinc-100'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          msg.role === 'user' ? 'bg-emerald-300' : 'bg-cyan-300'
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

        <div className="absolute bottom-14 left-0 right-0 min-h-[96px] border-t border-white/10 bg-[#0f1110]/95 px-3 py-3 backdrop-blur-xl">
            {attachedImage && (
              <div className="absolute bottom-[96px] left-3 right-3 rounded-xl border border-emerald-500/30 bg-[#0d1712] p-2 shadow-lg">
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
                title="Attach Image"
              >
                <RiImageAddLine size={18} />
              </button>
              <input
                value={voiceCommand}
                onChange={(e) => setVoiceCommand(e.target.value)}
                onKeyDown={handleCommandKeyDown}
                placeholder="Type your command"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/35 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleCommandSubmit}
                className="shrink-0 rounded-lg bg-emerald-500 px-4 py-3 text-[11px] font-bold text-black transition-colors hover:bg-emerald-400"
              >
                {attachedImage && voiceCommand ? 'SEND ALL' : attachedImage ? 'SEND IMG' : 'SEND'}
              </button>
            </div>
            <p className="mt-2 min-h-3 text-[9px] text-zinc-500">
              {imageSendStatus && <span className="text-emerald-400">{imageSendStatus}</span>}
              {!imageSendStatus && attachedImage && 'Image attached'}
            </p>
        </div>
      </div>

    </div>
  )
}
