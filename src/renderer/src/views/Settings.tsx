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
  RiDownloadCloud2Line
} from 'react-icons/ri'

interface SettingsProps {
  isSystemActive: boolean
}

type TabType = 'general' | 'keys' | 'gmail' | 'security' | 'support'

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
      setUpdateMessage(`Update available: v${info?.version || 'new'}.`)
    })
    const unsubNotAvailable = window.electron.ipcRenderer.onUpdateNotAvailable?.(() => {
      setUpdateBusy(false)
      setUpdateMessage('You are already on the latest version.')
    })
    const unsubError = window.electron.ipcRenderer.onUpdateError?.((_event: any, message: string) => {
      setUpdateBusy(false)
      setUpdateMessage(formatUpdateError(message))
    })

    return () => {
      if (typeof unsubAvailable === 'function') unsubAvailable()
      if (typeof unsubNotAvailable === 'function') unsubNotAvailable()
      if (typeof unsubError === 'function') unsubError()
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
      } catch (e) {}
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
    setGmailBusy(true)
    setGmailMessage('Opening Google login...')
    try {
      const res = await window.electron.ipcRenderer.invoke('gmail-connect')
      if (res.success) {
        setGmailMessage(`Connected: ${res.email || 'Gmail account'}`)
        await refreshGmailStatus()
      } else {
        setGmailMessage(res.error || 'Gmail connection failed.')
      }
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

  const cardClass = 'rounded-xl border border-white/10 bg-[#101214]'
  const inputContainerClass =
    'flex items-center bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus-within:border-emerald-400/60 transition-colors w-full'
  const titleClass = 'text-xs font-semibold text-zinc-300 flex items-center gap-2'

  return (
    <div className="flex-1 p-5 md:p-6 flex flex-col items-center bg-[#090b0c] min-h-screen text-zinc-100 relative overflow-y-auto scrollbar-small font-sans pb-28">
      <motion.div
        className="w-full max-w-5xl flex flex-col gap-5 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#101214] p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <RiSettings4Line size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                <RiRecordCircleLine
                  className={`${isSystemActive ? 'text-emerald-400' : 'text-zinc-600'}`}
                  size={14}
                />
                {isSystemActive ? 'System active' : 'System standby'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-3">
            <div className="flex md:flex-col gap-2 rounded-xl border border-white/10 bg-[#101214] p-2">
              {(['general', 'keys', 'gmail', 'security', 'support'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-1 items-center justify-center md:justify-start gap-2 rounded-lg px-4 py-3 text-xs font-semibold capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-black'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {tab === 'general' && <RiSettings4Line size={15} />}
                  {tab === 'keys' && <RiPlugLine size={15} />}
                  {tab === 'gmail' && <RiMailLine size={15} />}
                  {tab === 'security' && <RiShieldKeyholeLine size={15} />}
                  {tab === 'support' && <RiDownloadCloud2Line size={15} />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

        <div className="relative col-span-12 min-h-[400px] md:col-span-9">
          <AnimatePresence mode="wait">
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
                      <RiBrainLine className="text-emerald-400" size={18} /> Personality
                    </span>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-[9px] font-mono tracking-widest ${currentWordCount >= 150 ? 'text-red-400' : 'text-zinc-600'}`}
                      >
                        {currentWordCount} / 150 WORDS
                      </span>
                      <button
                        onClick={savePersonality}
                        className="text-zinc-300 hover:text-emerald-300 transition-colors bg-white/[0.03] p-2 rounded-lg border border-white/10"
                      >
                        <RiSave3Line size={18} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={personality}
                    onChange={handlePersonalityChange}
                    placeholder="Describe how APEX should speak and behave..."
                    className="bg-black/20 border border-white/10 rounded-lg p-4 text-sm text-zinc-200 h-32 resize-none focus:border-emerald-400/60 outline-none transition-colors scrollbar-small font-sans"
                  />
                </div>

                <div className={`${cardClass} p-8 flex flex-col gap-5`}>
                  <span className={titleClass}>
                    <RiUserLine className="text-emerald-400" size={18} /> User Name
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
                      <RiUserVoiceLine className="text-emerald-400" size={18} /> Voice
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
                        className={`flex-1 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors border ${
                          voice === s
                            ? 'bg-emerald-500 text-black border-emerald-500'
                            : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
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
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                      <RiDownloadCloud2Line className="text-emerald-400" size={22} />
                    </div>
                    <div>
                      <span className={titleClass}>App Updates</span>
                      <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                        Check GitHub releases for a new APEX version and show update changes in the app.
                      </p>
                      <div className="mt-3 inline-flex rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                        Installed version: v{appVersion || '...'}
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">{updateMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={checkUpdates}
                    disabled={updateBusy}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-xs font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <RiRefreshLine size={16} className={updateBusy ? 'animate-spin' : ''} />
                    {updateBusy ? 'Checking...' : 'Check Update'}
                  </button>
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-white/5">
                    <span className={titleClass}>
                      <RiKey2Line className="text-emerald-400" size={18} /> API Keys
                    </span>
                    <button
                      onClick={saveApiKeys}
                      className="flex items-center gap-2 bg-emerald-500 text-black px-5 py-3 rounded-lg text-xs font-semibold hover:bg-emerald-400 transition-colors active:scale-95"
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

                  <div className="bg-white/[0.03] border border-white/10 p-4 rounded-lg flex items-start gap-3">
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
                    <div>
                      <span className={titleClass}>
                        <RiMailLine className="text-emerald-400" size={18} /> Gmail Connect
                      </span>
                      <p className="mt-2 text-xs text-zinc-500">
                        Connect Gmail for read, send, and draft email commands.
                      </p>
                    </div>
                    <div
                      className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                        gmailStatus.connected
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                          : gmailStatus.configured
                            ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'
                            : 'border-white/10 bg-white/[0.03] text-zinc-400'
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
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-zinc-300">
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
                      disabled={gmailBusy || !gmailStatus.configured}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-black px-5 py-3 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50"
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

                  <div className="bg-white/[0.03] border border-white/10 p-4 rounded-lg flex items-start gap-3">
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
                <div className={`${cardClass} overflow-hidden shadow-2xl relative min-h-[400px] flex items-center justify-center border-white/5`}>
                  <AnimatePresence mode="wait">
                    {!isSecurityUnlocked ? (
                      <motion.div
                        key="lock-screen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 backdrop-blur-[60px] bg-black/60 flex flex-col items-center justify-center p-8 text-center"
                      >
                        <div className="bg-white/5 p-6 rounded-[2rem] mb-6 border border-white/10 shadow-xl">
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
                            className={`h-14 bg-white/[0.03] border w-full rounded-lg text-center text-2xl tracking-[0.4em] text-white outline-none transition-colors ${authError ? 'border-red-500 text-red-500' : 'border-white/10 focus:border-emerald-400/60'}`}
                          />
                          <button
                            onClick={unlockSecurityModule}
                            className="h-14 px-8 bg-emerald-500 text-black text-xs font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
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

                          <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex flex-col gap-4 shadow-inner">
                            <div className="flex items-center gap-3 text-zinc-400">
                              <RiShieldKeyholeLine size={20} />
                              <h4 className="text-[11px] font-black uppercase tracking-[0.1em]">ENCRYPTION_VAULT</h4>
                            </div>
                            <p className="text-[9px] text-zinc-600 font-mono leading-relaxed font-bold uppercase tracking-tighter">
                              Biometrics are isolated in a local OS sandbox. APEX does not store plaintext secure data.
                            </p>
                          </div>
                        </div>

                        <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] flex flex-col gap-8 shadow-inner">
                          <div className="flex justify-between items-center pb-4 border-b border-white/5">
                            <span className={titleClass}>
                              <RiScan2Line size={18} /> Biometric Registry
                            </span>
                            <span className="text-[9px] text-zinc-400 font-mono tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                              {faceCount} ENROLLED
                            </span>
                          </div>

                          {isScanningFace ? (
                            <div className="flex flex-col items-center gap-6 bg-black/40 p-8 rounded-[2rem] border border-white/10">
                              <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-32 h-32 rounded-[2.5rem] object-cover -scale-x-100 border border-white/10 shadow-2xl"
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
