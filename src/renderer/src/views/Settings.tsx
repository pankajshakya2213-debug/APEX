import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as faceapi from 'face-api.js'
import { GiArtificialIntelligence } from 'react-icons/gi'
import {
  RiKey2Line,
  RiSave3Line,
  RiUserVoiceLine,
  RiUserLine,
  RiLockPasswordLine,
  RiScan2Line,
  RiAddLine,
  RiRecordCircleLine,
  RiLock2Line,
  RiSettings4Line,
  RiShieldKeyholeLine,
  RiPlugLine,
  RiBrainLine,
  RiCloudLine,
  RiCpuLine,
  RiDatabase2Line,
  RiDeleteBin2Line,
  RiTerminalLine,
  RiMailLine,
  RiLoginCircleLine,
  RiLogoutCircleLine,
  RiRefreshLine,
  RiDownloadCloud2Line,
  RiPhoneLine,
  RiSendPlaneLine,
  RiInstagramLine
} from 'react-icons/ri'

interface SettingsProps {
  isSystemActive: boolean
}

type TabType = 'general' | 'keys' | 'gmail' | 'security' | 'support' | 'about'

const SettingsView = ({ isSystemActive }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('general')

  const [voice, setVoice] = useState<'MALE' | 'FEMALE'>(
    (localStorage.getItem('iris_voice_profile') as 'MALE' | 'FEMALE') || 'MALE'
  )
  const [personality, setPersonality] = useState('')
  const [userName, setUserName] = useState(localStorage.getItem('iris_user_name') || '')

  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('iris_custom_api_key') || '')
  const [groqKey, setGroqKey] = useState(localStorage.getItem('iris_groq_api_key') || '')
  const [hfKey, setHfKey] = useState(localStorage.getItem('iris_hf_api_key') || '')
  const [tailvyKey, setTailvyKey] = useState(localStorage.getItem('iris_tailvy_api_key') || '')
  const [gmailClientId, setGmailClientId] = useState('')
  const [gmailClientSecret, setGmailClientSecret] = useState('')
  const [gmailStatus, setGmailStatus] = useState({
    configured: false,
    connected: false,
    email: '',
    clientId: ''
  })
  const [gmailBusy, setGmailBusy] = useState(false)
  const [gmailMessage, setGmailMessage] = useState('')

  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('Ready to check GitHub releases.')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(0)
  const [availableVersion, setAvailableVersion] = useState('')
  const [appVersion, setAppVersion] = useState('')

  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false)
  const [authPin, setAuthPin] = useState('')
  const [authError, setAuthError] = useState(false)

  const [newPin, setNewPin] = useState('')
  const [faceCount, setFaceCount] = useState(0)

  const [isScanningFace, setIsScanningFace] = useState(false)
  const [enrollStatus, setEnrollStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const formatUpdateError = (message?: string) => {
    const text = message || ''
    if (text.includes('404') || text.includes('Not Found')) {
      return 'No GitHub release found yet. Create release v1.1.5 in pankajshakya2213-debug/APEX, then check again.'
    }
    if (text.toLowerCase().includes('authentication') || text.toLowerCase().includes('token')) {
      return 'GitHub update check needs a public release or valid GitHub access.'
    }
    if (text.length > 140) return 'Update check failed. Check GitHub release setup and internet connection.'
    return text || 'Update check failed.'
  }

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return undefined

    window.electron.ipcRenderer.invoke('get-personality').then((res) => {
      if (res) setPersonality(res)
    })
    window.electron.ipcRenderer
      .invoke('check-vault-status')
      .then((res) => setFaceCount(res?.faceCount || 0))
    window.electron.ipcRenderer.invoke('get-app-version').then((version) => {
      if (version) setAppVersion(version)
    })
    refreshGmailStatus()

    const unsubAvailable = window.electron.ipcRenderer.onUpdateAvailable?.((_event: any, info: any) => {
      setUpdateBusy(false)
      setUpdateAvailable(true)
      setUpdateDownloaded(false)
      setUpdateProgress(0)
      setAvailableVersion(info?.version || '')
      setUpdateMessage(`Update available: v${info?.version || 'new'}. Download it inside APEX.`)
    })
    const unsubNotAvailable = window.electron.ipcRenderer.onUpdateNotAvailable?.(() => {
      setUpdateBusy(false)
      setUpdateAvailable(false)
      setUpdateDownloaded(false)
      setUpdateProgress(0)
      setUpdateMessage('You are already on the latest version.')
    })
    const unsubError = window.electron.ipcRenderer.onUpdateError?.((_event: any, message: string) => {
      setUpdateBusy(false)
      setUpdateMessage(formatUpdateError(message))
    })
    const unsubProgress = window.electron.ipcRenderer.onDownloadProgress?.((_event: any, percent: number) => {
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0))
      setUpdateBusy(true)
      setUpdateProgress(safePercent)
      setUpdateMessage(`Downloading update... ${Math.round(safePercent)}%`)
    })
    const unsubDownloaded = window.electron.ipcRenderer.onUpdateDownloaded?.(() => {
      setUpdateBusy(false)
      setUpdateDownloaded(true)
      setUpdateProgress(100)
      setUpdateMessage('Update downloaded. Restart APEX to apply the new version.')
    })

    return () => {
      if (typeof unsubAvailable === 'function') unsubAvailable()
      if (typeof unsubNotAvailable === 'function') unsubNotAvailable()
      if (typeof unsubError === 'function') unsubError()
      if (typeof unsubProgress === 'function') unsubProgress()
      if (typeof unsubDownloaded === 'function') unsubDownloaded()
    }
  }, [])

  const refreshGmailStatus = async () => {
    if (!window.electron?.ipcRenderer) return
    const status = await window.electron.ipcRenderer.invoke('gmail-get-status')
    if (status) {
      setGmailStatus(status)
      if (status.clientId) setGmailClientId(status.clientId)
    }
  }

  const handleVoiceChange = (v: 'MALE' | 'FEMALE') => {
    if (isSystemActive) return
    setVoice(v)
    localStorage.setItem('iris_voice_profile', v)
  }

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length <= 150) setPersonality(text)
  }

  const savePersonality = async () => {
    if (window.electron?.ipcRenderer) {
      const res = await window.electron.ipcRenderer.invoke('set-personality', personality)
      if (res?.sanitized !== undefined) setPersonality(res.sanitized)
      alert(res?.message || 'Personality Matrix Saved.')
    }
  }

  const saveUserName = () => {
    const cleanName = userName.trim()
    setUserName(cleanName)
    if (cleanName) localStorage.setItem('iris_user_name', cleanName)
    else localStorage.removeItem('iris_user_name')
    alert('User Designation Saved.')
  }

  const saveApiKeys = async () => {
    localStorage.setItem('iris_custom_api_key', geminiKey)
    localStorage.setItem('iris_groq_api_key', groqKey)
    localStorage.setItem('iris_hf_api_key', hfKey)
    localStorage.setItem('iris_tailvy_api_key', tailvyKey)

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('secure-save-keys', {
          groqKey,
          geminiKey
        })
      } catch (e) { }
    }

    alert('Neural Uplinks (API Keys) secured.')
  }

  const saveGmailConfig = async () => {
    if (!window.electron?.ipcRenderer) return
    setGmailBusy(true)
    setGmailMessage('')
    try {
      const res = await window.electron.ipcRenderer.invoke('gmail-save-config', {
        clientId: gmailClientId,
        clientSecret: gmailClientSecret
      })
      if (res.success) {
        setGmailMessage('Gmail OAuth keys saved. Now connect your Gmail account.')
        setGmailClientSecret('')
        await refreshGmailStatus()
      } else {
        setGmailMessage(res.error || 'Could not save Gmail OAuth keys.')
      }
    } finally {
      setGmailBusy(false)
    }
  }

  const connectGmail = async () => {
    if (!window.electron?.ipcRenderer) return
    if (!gmailStatus.configured) {
      setGmailMessage('Please save OAuth Client ID and Secret first before connecting.')
      return
    }
    setGmailBusy(true)
    setGmailMessage('Opening Google login in your browser...')
    try {
      const res = await window.electron.ipcRenderer.invoke('gmail-connect')
      if (res.success) {
        setGmailMessage(`Connected: ${res.email || 'Gmail account'}`)
        await refreshGmailStatus()
      } else {
        setGmailMessage(res.error || 'Gmail connection failed.')
      }
    } catch (e: any) {
      setGmailMessage(e.message || 'Error connecting to Gmail.')
    } finally {
      setGmailBusy(false)
    }
  }

  const disconnectGmail = async () => {
    if (!window.electron?.ipcRenderer) return
    setGmailBusy(true)

    setGmailMessage('')
    try {
      const res = await window.electron.ipcRenderer.invoke('gmail-disconnect')
      setGmailMessage(res.success ? 'Gmail disconnected.' : res.error || 'Could not disconnect Gmail.')
      await refreshGmailStatus()
    } finally {
      setGmailBusy(false)
    }
  }

  const checkUpdates = async () => {
    if (!window.electron?.ipcRenderer) return
    setUpdateBusy(true)
    setUpdateDownloaded(false)
    setUpdateProgress(0)
    setUpdateMessage('Checking GitHub releases...')
    try {
      const res = await window.electron.ipcRenderer.checkForUpdates?.()
      if (res && !res.success) {
        setUpdateBusy(false)
        setUpdateMessage(formatUpdateError(res.message))
      }
    } catch (e: any) {
      setUpdateBusy(false)
      setUpdateMessage(formatUpdateError(e?.message))
    }
  }

  const downloadUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setUpdateBusy(true)
    setUpdateProgress(0)
    setUpdateMessage('Starting update download...')
    try {
      const res = await window.electron.ipcRenderer.downloadUpdate?.()
      if (res && !res.success) {
        setUpdateBusy(false)
        setUpdateMessage(formatUpdateError(res.message))
      }
    } catch (e: any) {
      setUpdateBusy(false)
      setUpdateMessage(formatUpdateError(e?.message))
    }
  }

  const installUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setUpdateMessage('Restarting APEX to apply update...')
    window.electron.ipcRenderer.installUpdate?.()
  }

  const currentWordCount = personality
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length

  const unlockSecurityModule = async () => {
    if (!window.electron?.ipcRenderer) return
    const isValid = await window.electron.ipcRenderer.invoke('verify-vault-pin', authPin)
    if (isValid) {
      setIsSecurityUnlocked(true)
      setAuthPin('')
    } else {
      setAuthError(true)
      setTimeout(() => setAuthError(false), 1000)
    }
  }

  const updateMasterPin = async () => {
    if (newPin.length !== 4 || !window.electron?.ipcRenderer) return
    await window.electron.ipcRenderer.invoke('setup-vault-pin', newPin)
    setNewPin('')
    alert('Master PIN Updated.')
  }

  const resetFaceEnrollment = async () => {
    if (!window.electron?.ipcRenderer) return
    const confirmed = window.confirm(
      'Delete all enrolled face data?'
    )
    if (!confirmed) return
    await window.electron.ipcRenderer.invoke('reset-vault-face')
    setFaceCount(0)
    alert('Faces deleted.')
  }

  const startFaceEnrollment = async () => {
    setIsScanningFace(true)
    setEnrollStatus('INITIALIZING...')
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ])

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setEnrollStatus('POSITION FACE')

        const scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState !== 4) return
          const detection = await faceapi
            .detectSingleFace(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptor()

          if (detection) {
            clearInterval(scanInterval)
            setEnrollStatus('ACQUIRED')
            const descriptorArray = Array.from(detection.descriptor)

            if (window.electron?.ipcRenderer) {
              await window.electron.ipcRenderer.invoke('setup-vault-face', descriptorArray)
            }

            stream.getTracks().forEach((t) => t.stop())
            setIsScanningFace(false)
            setFaceCount((prev) => prev + 1)
            alert('Identity Saved.')
          }
        }, 1000)
      }
    } catch (e) {
      setEnrollStatus('ERROR')
      setTimeout(() => setIsScanningFace(false), 2000)
    }
  }

  const cardClass = 'rounded-xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]'
  const inputContainerClass =
    'flex items-center bg-black/20 border border-white/20 rounded-lg px-4 py-3 focus-within:border-white/60 transition-colors w-full'
  const titleClass = 'text-xs font-semibold text-zinc-300 flex items-center gap-2'

  return (
    <div className="flex-1 p-5 md:p-6 flex flex-col items-center bg-[#080a09] min-h-screen text-zinc-100 relative overflow-y-auto scrollbar-small font-sans pb-28">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none absolute -left-40 top-[-20%] h-[600px] w-[600px] rounded-full bg-purple-600/15 mix-blend-screen blur-[130px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[20%] h-[600px] w-[600px] rounded-full bg-fuchsia-600/15 mix-blend-screen blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/15 mix-blend-screen blur-[110px]" />

      <motion.div
        className="w-full max-w-5xl flex flex-col gap-5 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/[0.03]">
              <RiSettings4Line size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                <RiRecordCircleLine
                  className={`${isSystemActive ? 'text-white' : 'text-zinc-600'}`}
                  size={14}
                />
                {isSystemActive ? 'System active' : 'System standby'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-3">
            <div className="flex md:flex-col gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-2">
              {(['general', 'keys', 'gmail', 'security', 'support', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-1 items-center justify-center md:justify-start gap-2 rounded-lg px-4 py-3 text-xs font-semibold capitalize transition-colors ${activeTab === tab
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                >
                  {tab === 'general' && <RiSettings4Line size={15} />}
                  {tab === 'keys' && <RiPlugLine size={15} />}
                  {tab === 'gmail' && <RiMailLine size={15} />}
                  {tab === 'security' && <RiShieldKeyholeLine size={15} />}
                  {tab === 'support' && <RiDownloadCloud2Line size={15} />}
                  {tab === 'about' && <GiArtificialIntelligence size={15} />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative col-span-12 min-h-[400px] md:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`${cardClass} absolute w-full p-8 flex flex-col gap-6`}
                >
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className={titleClass}>
                      <GiArtificialIntelligence className="text-cyan-400" size={24} /> APEX System Capabilities
                    </span>
                  </div>

                  <div className="overflow-y-auto max-h-[550px] scrollbar-small pr-4 space-y-8 text-sm text-zinc-300">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-zinc-300 leading-relaxed text-[13px]">
                        <strong className="text-white">APEX</strong> is your personal AI assistant. It doesn't just chat with you — it can actually use your computer just like you do. It can click your mouse, type on your keyboard, manage your files, and even control your phone. Just <strong className="text-cyan-400">ask naturally</strong> over voice or chat, and APEX will figure out exactly what to do.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-white font-bold tracking-wider text-xs uppercase flex items-center gap-2 border-b border-white/10 pb-2"><RiCpuLine className="text-cyan-400" /> 1. Computer Control</h3>
                      <ul className="list-none space-y-3 ml-1 text-[13px]">
                        <li>
                          <strong className="text-cyan-300 block mb-1">Mouse & Keyboard (Phantom Control)</strong>
                          <span className="text-zinc-400">APEX can take over your mouse and keyboard to click buttons, scroll pages, and type text for you. <br /><em>Example: "Click the start button" or "Type hello in notepad"</em></span>
                        </li>
                        <li>
                          <strong className="text-cyan-300 block mb-1">App & File Manager</strong>
                          <span className="text-zinc-400">It can open or close any app on your PC (like Chrome or Spotify) and create, read, or move your files and folders automatically.</span>
                        </li>
                        <li>
                          <strong className="text-cyan-300 block mb-1">Auto Folder Organizer (Drop Zones)</strong>
                          <span className="text-zinc-400">APEX watches specific folders. When you drop messy files in there, it automatically sorts them into the right places (like putting images in an Images folder).</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-white font-bold tracking-wider text-xs uppercase flex items-center gap-2 border-b border-white/10 pb-2"><RiTerminalLine className="text-purple-400" /> 2. Coding & Research</h3>
                      <ul className="list-none space-y-3 ml-1 text-[13px]">
                        <li>
                          <strong className="text-purple-300 block mb-1">Live Coding Assistant</strong>
                          <span className="text-zinc-400">APEX can open your code editor, run terminal commands, write code for you, and even build animated websites from scratch.</span>
                        </li>
                        <li>
                          <strong className="text-purple-300 block mb-1">Smart Code Search (Oracle)</strong>
                          <span className="text-zinc-400">It reads your entire project folder so you can ask it questions like "Where is the login code?" and it will find the exact file instantly.</span>
                        </li>
                        <li>
                          <strong className="text-purple-300 block mb-1">Deep Web Research</strong>
                          <span className="text-zinc-400">Instead of just searching Google, APEX can automatically open websites, read multiple pages, and create a full research report for you.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-white font-bold tracking-wider text-xs uppercase flex items-center gap-2 border-b border-white/10 pb-2"><RiPhoneLine className="text-emerald-400" /> 3. Phone & Apps</h3>
                      <ul className="list-none space-y-3 ml-1 text-[13px]">
                        <li>
                          <strong className="text-emerald-300 block mb-1">Mobile Phone Control</strong>
                          <span className="text-zinc-400">APEX connects to your Android phone. It can swipe the screen, open apps, read your notifications, and even turn on your flashlight or WiFi.</span>
                        </li>
                        <li>
                          <strong className="text-emerald-300 block mb-1">WhatsApp & Gmail Automator</strong>
                          <span className="text-zinc-400">It can read your unread emails or WhatsApp messages, write a reply in your style, and send it for you without you lifting a finger.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-white font-bold tracking-wider text-xs uppercase flex items-center gap-2 border-b border-white/10 pb-2"><RiCloudLine className="text-blue-400" /> 4. Live Data & Memory</h3>
                      <ul className="list-none space-y-3 ml-1 text-[13px]">
                        <li>
                          <strong className="text-blue-300 block mb-1">Screen & Camera Reader</strong>
                          <span className="text-zinc-400">APEX can "see" what is on your screen or webcam live. <br /><em>Example: "What am I looking at right now?" or "Read this error on my screen"</em></span>
                        </li>
                        <li>
                          <strong className="text-blue-300 block mb-1">Live Widgets (Weather, Stocks, Maps)</strong>
                          <span className="text-zinc-400">It can fetch live weather, real-time stock prices, and show 3D maps directly on your screen.</span>
                        </li>
                        <li>
                          <strong className="text-blue-300 block mb-1">Long-Term Memory</strong>
                          <span className="text-zinc-400">APEX remembers important details about you. It saves your preferences so you don't have to repeat yourself every time you open the app.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-white font-bold tracking-wider text-xs uppercase flex items-center gap-2 border-b border-white/10 pb-2"><RiKey2Line className="text-amber-400" /> Keyboard Shortcuts</h3>
                      <ul className="list-none space-y-3 ml-1 text-[13px]">
                        <li><strong className="text-amber-300">Ctrl + Shift + I</strong> : <span className="text-zinc-400">Toggle APEX Mini Mode (Hides the main dashboard).</span></li>
                        <li><strong className="text-amber-300">Ctrl + Alt + Space</strong> : <span className="text-zinc-400">Summon Phantom Control (Let APEX control your mouse/keyboard).</span></li>
                        <li><strong className="text-amber-300">Ctrl + Alt + X</strong> : <span className="text-zinc-400">Trigger Screen Peeler (Advanced screenshot and text scanner).</span></li>
                      </ul>
                    </div>

                    <div className="mt-8 flex flex-col items-center justify-center border-t border-white/10 pt-6 pb-4">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-1">Designed & Developed by</span>
                      <span className="text-[15px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-widest">
                        💕Pankaj Shakya🙌
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 absolute w-full"
                >
                  <div className={`${cardClass} md:col-span-2 p-8 flex flex-col gap-6`}>
                    <div className="flex justify-between items-center">
                      <span className={titleClass}>
                        <RiBrainLine className="text-white" size={18} /> Personality
                      </span>
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-[9px] font-mono tracking-widest ${currentWordCount >= 150 ? 'text-red-400' : 'text-zinc-600'}`}
                        >
                          {currentWordCount} / 150 WORDS
                        </span>
                        <button
                          onClick={savePersonality}
                          className="text-zinc-300 hover:text-white transition-colors bg-white/[0.03] p-2 rounded-lg border border-white/20"
                        >
                          <RiSave3Line size={18} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={personality}
                      onChange={handlePersonalityChange}
                      placeholder="Describe how APEX should speak and behave..."
                      className="bg-black/20 border border-white/20 rounded-lg p-4 text-sm text-zinc-200 h-32 resize-none focus:border-white/60 outline-none transition-colors scrollbar-small font-sans"
                    />
                  </div>

                  <div className={`${cardClass} p-8 flex flex-col gap-5`}>
                    <span className={titleClass}>
                      <RiUserLine className="text-white" size={18} /> User Name
                    </span>
                    <div className={inputContainerClass}>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Your name"
                        className="bg-transparent border-none outline-none text-sm text-zinc-100 w-full placeholder:text-zinc-600 font-medium"
                      />
                      <button
                        onClick={saveUserName}
                        className="text-zinc-600 hover:text-white transition-colors ml-2"
                      >
                        <RiSave3Line size={20} />
                      </button>
                    </div>
                  </div>

                  <div className={`${cardClass} p-8 flex flex-col gap-5 relative overflow-hidden group`}>
                    <div className="flex justify-between items-center">
                      <span className={titleClass}>
                        <RiUserVoiceLine className="text-white" size={18} /> Voice
                      </span>
                      {isSystemActive && (
                        <span className="text-[9px] text-zinc-600 font-mono tracking-widest flex items-center gap-1">
                          <RiLock2Line /> Locked while active
                        </span>
                      )}
                    </div>
                    <div
                      className={`flex gap-3 h-12 mt-1 ${isSystemActive ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                    >
                      {(['FEMALE', 'MALE'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleVoiceChange(s)}
                          className={`flex-1 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors border ${voice === s
                              ? 'bg-white text-black border-white/30'
                              : 'bg-white/[0.03] border-white/20 text-zinc-400 hover:text-white hover:border-white/20'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                </motion.div>
              )}

              {activeTab === 'support' && (
                <motion.div
                  key="support"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 gap-6 absolute w-full"
                >
                  <div className={`${cardClass} p-8 flex flex-col gap-5`}>
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/[0.03]">
                        <RiDownloadCloud2Line className="text-white" size={22} />
                      </div>
                      <div>
                        <span className={titleClass}>App Updates</span>
                        <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                          Check GitHub releases for a new APEX version and show update changes in the app.
                        </p>
                        <div className="mt-3 inline-flex rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                          Installed version: v{appVersion || '...'}
                        </div>
                        {availableVersion && (
                          <div className="mt-2 inline-flex rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                            Latest version: v{availableVersion}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-zinc-400">{updateMessage}</p>
                      </div>
                    </div>
                    {(updateBusy && updateProgress >= 0 && !updateDownloaded && updateProgress > 0) || (updateProgress > 0 && updateProgress < 100) ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-500 tracking-widest uppercase">Downloading</span>
                          <span className="text-white font-bold tabular-nums">{Math.round(updateProgress)}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/5 relative">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-white to-white transition-all duration-300 ease-out relative"
                            style={{ width: `${updateProgress}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <button
                        onClick={checkUpdates}
                        disabled={updateBusy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-xs font-semibold text-black transition-colors hover:bg-white disabled:opacity-50"
                      >
                        <RiRefreshLine size={16} className={updateBusy ? 'animate-spin' : ''} />
                        {updateBusy && updateProgress === 0 ? 'Checking...' : 'Check Update'}
                      </button>
                      <button
                        onClick={downloadUpdate}
                        disabled={updateBusy || !updateAvailable || updateDownloaded}
                        className="flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-400 hover:text-black disabled:opacity-40"
                      >
                        <RiDownloadCloud2Line size={16} />
                        Download Update
                      </button>
                      <button
                        onClick={installUpdate}
                        disabled={!updateDownloaded}
                        className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-5 py-3 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 disabled:bg-white/5 disabled:text-zinc-600 disabled:opacity-50"
                      >
                        <RiRefreshLine size={16} />
                        Restart APEX
                      </button>
                    </div>
                  </div>

                  <div className={`${cardClass} p-8 flex flex-col gap-5`}>
                    <div className="flex justify-between items-center pb-4 border-b border-white/20">
                      <span className={titleClass}>
                        <RiMailLine className="text-white" size={18} /> Contact Developer
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center p-6 text-center border border-white/10 rounded-lg bg-black/20 gap-3 mt-2">
                      <RiSendPlaneLine size={32} className="text-cyan-400" />
                      <p className="text-xs text-zinc-400 max-w-[300px] leading-relaxed">
                        Have a feature request, found a bug, or just want to say hi? Contact the developer of APEX at:
                      </p>
                      
                      <div className="flex flex-col gap-3 mt-2">
                        <a 
                          href="mailto:pankajshakya2213@gmail.com?subject=APEX%20Feedback" 
                          className="flex items-center justify-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors tracking-wide"
                        >
                          <RiMailLine size={16} /> pankajshakya2213@gmail.com
                        </a>
                        <a 
                          href="https://instagram.com/pankajshakya2213" 
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors tracking-wide"
                        >
                          <RiInstagramLine size={16} /> @pankajshakya2213
                        </a>
                      </div>
                    </div>
                  </div>

                </motion.div>
              )}

              {activeTab === 'keys' && (
                <motion.div
                  key="keys"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 gap-6 absolute w-full"
                >
                  <div className={`${cardClass} p-8 flex flex-col gap-8`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-white/20">
                      <span className={titleClass}>
                        <RiKey2Line className="text-white" size={18} /> API Keys
                      </span>
                      <button
                        onClick={saveApiKeys}
                        className="flex items-center gap-2 bg-white text-black px-5 py-3 rounded-lg text-xs font-semibold hover:bg-white transition-colors active:scale-95"
                      >
                        <RiSave3Line size={16} /> Save Keys
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { label: 'Gemini Pro', value: geminiKey, setter: setGeminiKey, icon: RiBrainLine },
                        { label: 'Groq Infer', value: groqKey, setter: setGroqKey, icon: RiCpuLine },
                        { label: 'HF Vision', value: hfKey, setter: setHfKey, icon: RiCloudLine },
                        { label: 'Tailvy Agent', value: tailvyKey, setter: setTailvyKey, icon: RiPlugLine }
                      ].map((key, i) => (
                        <div key={i} className="flex flex-col gap-3">
                          <label className="text-xs text-zinc-400 flex items-center gap-2 font-medium">
                            <key.icon size={14} className="text-zinc-400" /> {key.label}
                          </label>
                          <div className={inputContainerClass}>
                            <input
                              type="password"
                              value={key.value}
                              onChange={(e) => key.setter(e.target.value)}
                              placeholder="Paste key"
                              className="bg-transparent border-none outline-none text-sm text-zinc-100 w-full placeholder:text-zinc-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white/[0.03] border border-white/20 p-4 rounded-lg flex items-start gap-3">
                      <RiShieldKeyholeLine className="text-zinc-600 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Keys are saved locally on this device.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'gmail' && (
                <motion.div
                  key="gmail"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 gap-6 absolute w-full"
                >
                  <div className={`${cardClass} p-8 flex flex-col gap-7`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/20">
                      <div>
                        <span className={titleClass}>
                          <RiMailLine className="text-white" size={18} /> Gmail Connect
                        </span>
                        <p className="mt-2 text-xs text-zinc-500">
                          Connect Gmail for read, send, and draft email commands.
                        </p>
                      </div>
                      <div
                        className={`rounded-lg border px-4 py-2 text-xs font-semibold ${gmailStatus.connected
                            ? 'border-white/30 bg-white/10 text-white'
                            : gmailStatus.configured
                              ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'
                              : 'border-white/20 bg-white/[0.03] text-zinc-400'
                          }`}
                      >
                        {gmailStatus.connected
                          ? `CONNECTED ${gmailStatus.email ? `- ${gmailStatus.email}` : ''}`
                          : gmailStatus.configured
                            ? 'KEYS SAVED'
                            : 'NOT SETUP'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-3">
                        <label className="text-xs text-zinc-400 flex items-center gap-2 font-medium">
                          <RiKey2Line size={14} className="text-zinc-400" /> OAuth Client ID
                        </label>
                        <div className={inputContainerClass}>
                          <input
                            type="text"
                            value={gmailClientId}
                            onChange={(e) => setGmailClientId(e.target.value)}
                            placeholder="Google OAuth desktop client id"
                            className="bg-transparent border-none outline-none text-sm text-zinc-100 w-full placeholder:text-zinc-600"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-xs text-zinc-400 flex items-center gap-2 font-medium">
                          <RiShieldKeyholeLine size={14} className="text-zinc-400" /> OAuth Client Secret
                        </label>
                        <div className={inputContainerClass}>
                          <input
                            type="password"
                            value={gmailClientSecret}
                            onChange={(e) => setGmailClientSecret(e.target.value)}
                            placeholder={gmailStatus.configured ? 'Saved. Paste new secret to replace.' : 'Google OAuth client secret'}
                            className="bg-transparent border-none outline-none text-sm text-zinc-100 w-full placeholder:text-zinc-600"
                          />
                        </div>
                      </div>
                    </div>

                    {gmailMessage && (
                      <div className="rounded-lg border border-white/20 bg-white/[0.03] p-4 text-xs text-zinc-300">
                        {gmailMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={saveGmailConfig}
                        disabled={gmailBusy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-white text-black px-5 py-3 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
                      >
                        <RiSave3Line size={16} /> Save OAuth Keys
                      </button>
                      <button
                        onClick={connectGmail}
                        disabled={gmailBusy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-white text-black px-5 py-3 text-xs font-semibold hover:bg-white disabled:opacity-50"
                      >
                        <RiLoginCircleLine size={16} /> Connect Gmail
                      </button>
                      <button
                        onClick={disconnectGmail}
                        disabled={gmailBusy || !gmailStatus.connected}
                        className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-5 py-3 text-xs font-semibold hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        <RiLogoutCircleLine size={16} /> Disconnect
                      </button>
                    </div>

                    <div className="bg-white/[0.03] border border-white/20 p-4 rounded-lg flex items-start gap-3">
                      <RiShieldKeyholeLine className="text-zinc-600 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Use a Google Cloud OAuth Client ID with Desktop app type and Gmail API enabled.
                        After saving keys, Connect Gmail opens the Google permission screen.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="w-full absolute"
                >
                  <div className={`${cardClass} overflow-hidden shadow-2xl relative min-h-[400px] flex items-center justify-center border-white/20`}>
                    <AnimatePresence mode="wait">
                      {!isSecurityUnlocked ? (
                        <motion.div
                          key="lock-screen"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 backdrop-blur-[60px] bg-black/60 flex flex-col items-center justify-center p-8 text-center"
                        >
                          <div className="bg-white/5 p-6 rounded-[2rem] mb-6 border border-white/20 shadow-xl">
                            <RiLockPasswordLine size={48} className="text-white" />
                          </div>
                          <h2 className="text-xl font-semibold text-white mb-4">Security Locked</h2>
                          <div className="flex flex-col md:flex-row gap-4 items-center w-full max-w-xs">
                            <input
                              type="password"
                              maxLength={4}
                              value={authPin}
                              onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="PIN"
                              className={`h-14 bg-white/[0.03] border w-full rounded-lg text-center text-2xl tracking-[0.4em] text-white outline-none transition-colors ${authError ? 'border-red-500 text-red-500' : 'border-white/20 focus:border-white/60'}`}
                            />
                            <button
                              onClick={unlockSecurityModule}
                              className="h-14 px-8 bg-white text-black text-xs font-semibold rounded-lg hover:bg-white transition-colors"
                            >
                              UNLOCK
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="security-content"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 w-full"
                        >
                          <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-5">
                              <span className={titleClass}>
                                <RiLockPasswordLine size={18} /> Update Master PIN
                              </span>
                              <div className={inputContainerClass}>
                                <input
                                  type="password"
                                  maxLength={4}
                                  value={newPin}
                                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                  placeholder="NEW_PIN..."
                                  className="bg-transparent border-none outline-none text-xl font-mono text-zinc-100 w-full tracking-[0.5em] placeholder:text-zinc-900"
                                />
                                <button
                                  onClick={updateMasterPin}
                                  className="text-zinc-600 hover:text-white transition-colors ml-4"
                                >
                                  <RiSave3Line size={24} />
                                </button>
                              </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/20 p-6 rounded-2xl flex flex-col gap-4 shadow-inner">
                              <div className="flex items-center gap-3 text-zinc-400">
                                <RiShieldKeyholeLine size={20} />
                                <h4 className="text-[11px] font-black uppercase tracking-[0.1em]">ENCRYPTION_VAULT</h4>
                              </div>
                              <p className="text-[9px] text-zinc-600 font-mono leading-relaxed font-bold uppercase tracking-tighter">
                                Biometrics are isolated in a local OS sandbox. APEX does not store plaintext secure data.
                              </p>
                            </div>
                          </div>

                          <div className="bg-white/[0.01] border border-white/20 p-8 rounded-[2rem] flex flex-col gap-8 shadow-inner">
                            <div className="flex justify-between items-center pb-4 border-b border-white/20">
                              <span className={titleClass}>
                                <RiScan2Line size={18} /> Biometric Registry
                              </span>
                              <span className="text-[9px] text-zinc-400 font-mono tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/20">
                                {faceCount} ENROLLED
                              </span>
                            </div>

                            {isScanningFace ? (
                              <div className="flex flex-col items-center gap-6 bg-black/40 p-8 rounded-[2rem] border border-white/20">
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  muted
                                  playsInline
                                  className="w-32 h-32 rounded-[2.5rem] object-cover -scale-x-100 border border-white/20 shadow-2xl"
                                />
                                <span className="text-[10px] text-white font-mono tracking-[0.3em] animate-pulse font-black uppercase">
                                  {enrollStatus}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-6 h-full justify-between">
                                <p className="text-[9px] text-zinc-600 font-mono leading-relaxed font-bold uppercase tracking-tighter">
                                  Enroll new neural face descriptors for instant operator recognition.
                                </p>
                                <div className="flex flex-col gap-3">
                                  <button
                                    onClick={startFaceEnrollment}
                                    className="w-full py-4 rounded-xl bg-white text-black font-black tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all uppercase"
                                  >
                                    <RiAddLine size={18} /> ENROLL_NEW
                                  </button>
                                  {faceCount > 0 && (
                                    <button
                                      onClick={resetFaceEnrollment}
                                      className="w-full py-4 rounded-xl border border-red-900/40 text-red-800 font-bold tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-red-900/10 transition-all uppercase"
                                    >
                                      <RiDeleteBin2Line size={18} /> WIPE_DATA
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Footer Branding - Neutral */}
      <div className="mt-16 opacity-10 flex flex-col items-center gap-4 relative z-10">
        <RiTerminalLine size={24} className="text-white" />
        <p className="text-[8px] font-mono tracking-[0.8em] text-white font-black uppercase">
          PROJECT_AURORA // PURE_CRYSTAL_GLASS
        </p>
      </div>
    </div>
  )
}

export default SettingsView
