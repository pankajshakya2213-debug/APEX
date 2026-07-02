import { useState, useEffect, useRef } from 'react'
import MiniOverlay from './components/MiniOverlay'
import { irisService } from './services/Iris-voice-ai'
import { getScreenSourceId } from './hooks/CaptureDesktop'
import APEX from './UI/IRIS'
import TerminalOverlay from './components/TerminalOverlay'
import LeafletMapWidget from './Widgets/MapView'
import ImageWidget from './Widgets/ImageWidget'
import EmailWidget from './Widgets/EmailWidget'
import WeatherWidget from './Widgets/WeatherWidget'
import StockWidget from './Widgets/StockWidget'
import LiveCodingWidget from './Widgets/LiveCodingWidget'
import WormholeWidget from './Widgets/WormholeWidget'
import OracleWidget from './Widgets/RagOrcaleWidget'
import ResearchWidget from './Widgets/DeepResearch'
import SemanticWidget from './Widgets/SematicSearch'
import SmartDropZonesWidget from './Widgets/SmartZoneWidget'
import TitleBar from './components/Titlebar'

export type VisionMode = 'camera' | 'screen' | 'none'

const IndexRoot = () => {
  const [isOverlay, setIsOverlay] = useState(false)

  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<VisionMode>('none')
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenOn, setIsScreenOn] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)

  useEffect(() => {
    window.electron.ipcRenderer.on('overlay-mode', (_e, mode) => setIsOverlay(mode))
    return () => {
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
    }
  }, [])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (isSystemActive && !irisService.isConnected && !isConnectingRef.current) {
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
    }, 1000)
    return () => clearInterval(watchdog)
  }, [isSystemActive])

  const toggleSystem = async () => {
    if (!isSystemActive) {
      try {
        setIsSystemActive(true) // Instant UI feedback
        isConnectingRef.current = true
        await irisService.connect()
        isConnectingRef.current = false
        setIsMicMuted(false)
        irisService.setMute(false)
      } catch (err: any) {
        if (err.message === 'NO_API_KEY') {
          alert(
            '⚠️ CRITICAL ERROR: Gemini API Key is missing. Please enter it in the Command Center Vault (Settings Tab).'
          )
        } else {
          alert(`Connection failed: ${err.message}`)
        }
        isConnectingRef.current = false
        setIsSystemActive(false)
      }
    } else {
      irisService.disconnect()
      setIsSystemActive(false)
      setIsMicMuted(true)
      irisService.setMute(true)
      stopVision()
    }
  }

  const toggleMic = () => {
    const s = !isMicMuted
    setIsMicMuted(s)
    irisService.setMute(s)
  }

  const syncVisionState = () => {
    const cameraActive = Boolean(cameraStreamRef.current)
    const screenActive = Boolean(screenStreamRef.current)
    setIsCameraOn(cameraActive)
    setIsScreenOn(screenActive)
    setIsVideoOn(cameraActive || screenActive)
    setVisionMode(screenActive ? 'screen' : cameraActive ? 'camera' : 'none')
  }

  const setProcessingSource = async () => {
    const stream = screenStreamRef.current || cameraStreamRef.current
    if (!processingVideoRef.current) return
    if (!stream) {
      processingVideoRef.current.pause()
      processingVideoRef.current.srcObject = null
      return
    }
    processingVideoRef.current.srcObject = stream
    await processingVideoRef.current.play().catch(() => {})
  }

  const stopVisionMode = async (mode: 'camera' | 'screen') => {
    const streamRef = mode === 'camera' ? cameraStreamRef : screenStreamRef
    const stream = streamRef.current
    if (!stream) return
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.onended = null
        } catch (err) {}
        track.stop()
      })
    } finally {
      streamRef.current = null
      if (mode === 'camera') setCameraStream(null)
      else setScreenStream(null)
      syncVisionState()
      await setProcessingSource()
    }
  }

  const startVision = async (mode: 'camera' | 'screen') => {
    if (!isSystemActive) return

    try {
      let stream: MediaStream

      if (mode === 'camera') {
        await stopVisionMode('camera')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: 640,
            height: 480,
            facingMode: 'user'
          }
        })
      } else {
        await stopVisionMode('screen')
        const sourceId = await getScreenSourceId()
        if (!sourceId) return
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 1280,
              maxHeight: 720
            }
          }
        })
      }

      if (mode === 'camera') {
        cameraStreamRef.current = stream
        setCameraStream(stream)
      } else {
        screenStreamRef.current = stream
        setScreenStream(stream)
      }

      syncVisionState()
      await setProcessingSource()

      startAIProcessing()

      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => stopVisionMode(mode)
      }
    } catch (err) {
      console.error('Failed to start vision stream', err)
      await stopVisionMode(mode)
      alert(
        'Camera could not start. Close other camera apps and try again, or check Windows camera permissions.'
      )
    }
  }

  const stopVision = () => {
    stopVisionMode('camera')
    stopVisionMode('screen')

    if (processingVideoRef.current) {
      try {
        processingVideoRef.current.pause()
      } catch (err) {}
      processingVideoRef.current.srcObject = null
    }

    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current)
      aiIntervalRef.current = null
    }
  }

  const startAIProcessing = () => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current)

    aiIntervalRef.current = setInterval(() => {
      const vid = processingVideoRef.current
      if (vid && vid.readyState === 4 && irisService.socket?.readyState === WebSocket.OPEN) {
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 450
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
          irisService.sendVideoFrame(base64)
        }
      }
    }, 2000)
  }

  if (isOverlay) {
    return (
      <div className="w-screen h-screen overflow-hidden flex items-center justify-center bg-transparent">
        <MiniOverlay
          isSystemActive={isSystemActive}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
          stopVisionMode={stopVisionMode}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative border border-white/20 rounded-xl">
      <TitleBar />
      <div className="flex-1 relative">
        <APEX
          isSystemActive={isSystemActive}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
          stopVisionMode={stopVisionMode}
          activeStream={screenStream || cameraStream}
          cameraStream={cameraStream}
          screenStream={screenStream}
          isCameraOn={isCameraOn}
          isScreenOn={isScreenOn}
        />
      </div>
      <SmartDropZonesWidget />
      <SemanticWidget />
      <OracleWidget />
      <WormholeWidget />
      <LeafletMapWidget />
      <StockWidget />
      <WeatherWidget />
      <ImageWidget />
      <EmailWidget />
      <TerminalOverlay />
      <LiveCodingWidget />
      <ResearchWidget />
    </div>
  )
}

export default IndexRoot
