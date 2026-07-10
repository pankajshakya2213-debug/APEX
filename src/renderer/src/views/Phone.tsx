import { useState, useEffect, useRef } from 'react'
import { FaAndroid } from 'react-icons/fa6'
import {
  RiLinkM,
  RiWifiLine,
  RiSmartphoneLine,
  RiSignalWifi3Line,
  RiBattery2ChargeLine,
  RiDatabase2Line,
  RiShutDownLine,
  RiCameraLensLine,
  RiLockPasswordLine,
  RiSunLine,
  RiTerminalBoxLine,
  RiHome5Line,
  RiAddLine,
  RiTerminalLine,
  RiFileCopyLine,
  RiCheckLine,
  RiSave3Line
} from 'react-icons/ri'
import BackgroundGlows from '../components/BackgroundGlows'

const PhoneView = ({ glassPanel }: { glassPanel?: string }) => {
  const [ip, setIp] = useState(() => localStorage.getItem('iris_adb_ip') || '')
  const [port, setPort] = useState(() => localStorage.getItem('iris_adb_port') || '5555')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'verifying' | 'connected'>('idle')
  const [uiMode, setUiMode] = useState<'history' | 'manual'>('history')
  const [errorMsg, setErrorMsg] = useState('')
  const [deviceHistory, setDeviceHistory] = useState<any[]>([])
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem('iris_adb_name') || '')
  const [copied, setCopied] = useState(false)
  const [connectionMode, setConnectionMode] = useState<'usb' | 'wifi' | null>(null)

  const screenRef = useRef<HTMLImageElement>(null)
  const isStreaming = useRef(false)
  const knownNotifs = useRef<string[]>([])
  const hasAutoConnected = useRef(false)

  const [telemetry, setTelemetry] = useState({
    model: 'UNKNOWN DEVICE',
    os: 'ANDROID --',
    battery: { level: 0, isCharging: false, temp: '0.0' },
    storage: { used: '0 GB', total: '0 GB TOTAL', percent: 0 }
  })

  const loadDeviceHistory = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('adb-get-history')
      setDeviceHistory(data || [])
      return data || []
    } catch (e) {
      return []
    }
  }

  const formatLastConnected = (value?: string) => {
    if (!value) return 'Not connected yet'
    try {
      return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return 'Saved'
    }
  }

  useEffect(() => {
    // 1. Check if already connected via main process
    window.electron.ipcRenderer.invoke('adb-get-status').then((device) => {
      if (device && (device.ip || device.serial)) {
        if (device.ip) setIp(device.ip)
        if (device.port) setPort(device.port)
        setConnectionMode(device.mode || (device.serial ? 'usb' : 'wifi'))
        setStatus('connected')
        isStreaming.current = true
        fetchTelemetry()
        startScreenStream()
      } else {
        // 2. Fallback: try history auto-connect if nothing is active
        loadDeviceHistory().then((data) => {
          if (data.length > 0 && !hasAutoConnected.current) {
            hasAutoConnected.current = true
            const lastDevice = data[0]
            if (lastDevice && lastDevice.ip) {
              setIp(lastDevice.ip)
              setPort(lastDevice.port)
              connectToDevice(lastDevice.ip, lastDevice.port)
            }
          }
        })
      }
    })

    // 3. Listen for background auto-connections (Zero-Gap)
    const unsubscribe = window.electron.ipcRenderer.on('adb-auto-connected', (device: any) => {
      if (!device) {
        isStreaming.current = false
        setStatus('idle')
        setConnectionMode(null)
        if (screenRef.current) screenRef.current.src = ''
        return
      }

      if (device && (device.ip || device.serial)) {
        if (device.ip) setIp(device.ip)
        if (device.port) setPort(device.port)
        if (device.model) setDeviceName(device.name || device.model)
        setConnectionMode(device.mode || (device.serial ? 'usb' : 'wifi'))
        setStatus('verifying')

        // Wait a small moment for the bridge to stabilize
        setTimeout(() => {
          setStatus('connected')
          isStreaming.current = true
          fetchTelemetry()
          loadDeviceHistory()
          startScreenStream()

          window.dispatchEvent(
            new CustomEvent('ai-force-speak', {
              detail:
                device.mode === 'usb'
                  ? 'USB debugging link established. APEX is connected to your smartphone directly through the cable.'
                  : 'Zero-Gap Protocol established. I have automatically linked to your smartphone wirelessly via the USB handshake.'
            })
          )
        }, 1000)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const checkNotifications = async () => {
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-get-notifications')
      if (res.success && res.data) {
        const currentNotifs: string[] = res.data

        if (knownNotifs.current.length === 0) {
          knownNotifs.current = currentNotifs
          return
        }

        const newNotifs = currentNotifs.filter((n) => !knownNotifs.current.includes(n))

        if (newNotifs.length > 0) {
          window.dispatchEvent(
            new CustomEvent('ai-force-speak', {
              detail: `System Alert: The user just received a new mobile notification. Announce it out loud briefly: "${newNotifs[0]}"`
            })
          )
          knownNotifs.current = currentNotifs
        }
      }
    } catch (e) {}
  }

  const connectToDevice = async (targetIp: string, targetPort: string) => {
    if (!targetIp || !targetPort) return setErrorMsg('IP and Port are required.')
    setStatus('connecting')
    setErrorMsg('')

    try {
      const res = await window.electron.ipcRenderer.invoke('adb-connect', {
        ip: targetIp,
        port: targetPort
      })
      if (res.success) {
        if (res.device?.ip) setIp(res.device.ip)
        if (res.device?.port) setPort(res.device.port)
        if (res.device?.model) setDeviceName(res.device.name || res.device.model)
        setConnectionMode(res.device?.mode || 'wifi')
        setStatus('connected')
        isStreaming.current = true
        fetchTelemetry()
        loadDeviceHistory()
        startScreenStream()
      } else {
        setStatus('idle')
        setErrorMsg(
          res.error ||
            'Wireless bridge refused. For direct mode, plug in USB and use Connect via USB Debugging.'
        )
      }
    } catch (e) {
      setStatus('idle')
      setErrorMsg('Electron IPC Error.')
    }
  }

  const handleManualConnect = () => {
    localStorage.setItem('iris_adb_ip', ip)
    localStorage.setItem('iris_adb_port', port)
    localStorage.setItem('iris_adb_name', deviceName)
    setConnectionMode('wifi')
    connectToDevice(ip, port)
  }

  const handleSaveDevice = async () => {
    if (!ip || !port) return setErrorMsg('IP and Port are required before saving.')
    setErrorMsg('')

    try {
      const res = await window.electron.ipcRenderer.invoke('adb-save-device', {
        ip,
        port,
        name: deviceName || 'Saved Phone'
      })

      if (res.success) {
        localStorage.setItem('iris_adb_ip', ip)
        localStorage.setItem('iris_adb_port', port)
        localStorage.setItem('iris_adb_name', deviceName)
        await loadDeviceHistory()
        setUiMode('history')
      } else {
        setErrorMsg(res.error || 'Could not save this phone.')
      }
    } catch (e) {
      setErrorMsg('Electron IPC Error.')
    }
  }

  const handleUsbConnect = async () => {
    setStatus('connecting')
    setErrorMsg('')

    try {
      const res = await window.electron.ipcRenderer.invoke('adb-connect-usb')
      if (res.success) {
        const device = res.device
        if (device?.ip) setIp(device.ip)
        if (device?.port) setPort(device.port)
        if (device?.model) setDeviceName(device.name || device.model)
        setConnectionMode(device?.mode || 'usb')
        if (device?.ip) localStorage.setItem('iris_adb_ip', device.ip)
        if (device?.port) localStorage.setItem('iris_adb_port', device.port)
        if (device?.model) localStorage.setItem('iris_adb_name', device.name || device.model)
        setStatus('connected')
        isStreaming.current = true
        fetchTelemetry()
        loadDeviceHistory()
        startScreenStream()

        if (res.warning) {
          window.dispatchEvent(
            new CustomEvent('ai-force-speak', {
              detail: res.warning
            })
          )
        }
      } else {
        setStatus('idle')
        setErrorMsg(
          res.error || 'USB device not found. Enable USB debugging and accept the prompt.'
        )
      }
    } catch (e) {
      setStatus('idle')
      setErrorMsg('Electron IPC Error.')
    }
  }

  const handleDisconnect = async () => {
    isStreaming.current = false
    try {
      await window.electron.ipcRenderer.invoke('adb-disconnect')
    } catch (e) {}
    setStatus('idle')
    setConnectionMode(null)
    if (screenRef.current) screenRef.current.src = ''
  }

  const executeQuickCommand = async (action: 'camera' | 'wake' | 'lock' | 'home') => {
    try {
      await window.electron.ipcRenderer.invoke('adb-quick-action', { action })
    } catch (e) {}
  }

  const fetchTelemetry = async () => {
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-telemetry')
      if (res.success) setTelemetry(res.data)
    } catch (e) {}
  }

  const startScreenStream = async () => {
    if (!isStreaming.current) return
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-screenshot')
      if (res.success && res.image && screenRef.current) {
        screenRef.current.src = res.image
      }
    } catch (e) {}

    if (isStreaming.current) {
      requestAnimationFrame(startScreenStream)
    }
  }

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('IRIS will run adb tcpip 5555 automatically after USB trust.')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    let interval: any
    if (status === 'connected') {
      interval = setInterval(() => {
        fetchTelemetry()
        checkNotifications()
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [status])

  if (status !== 'connected' && uiMode === 'history') {
    return (
      <div className="flex-1 bg-[#080a09] min-h-screen text-zinc-100 relative overflow-y-auto scrollbar-small pb-24 p-5">
      <BackgroundGlows />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/[0.03]">
                <RiSmartphoneLine className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Phone Link</h1>
                <p className="text-xs text-zinc-500">
                  Plug in once with USB debugging, then continue over the saved Wi-Fi bridge.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUsbConnect}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white"
              >
                <RiLinkM size={18} /> USB Connect
              </button>
              <button
                onClick={() => setUiMode('manual')}
                className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-white/50"
              >
                <RiAddLine size={18} /> Wi-Fi Device
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {deviceHistory.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-6 text-sm text-zinc-500">
                No saved phones yet. Use USB Connect once, or add the phone IP manually.
              </div>
            )}

            {deviceHistory.map((dev, i) => (
              <button
                key={`${dev.ip}-${dev.port}-${i}`}
                onClick={() => connectToDevice(dev.ip, dev.port)}
                className="flex min-h-32 flex-col justify-between rounded-xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 text-left transition-colors hover:border-white/50 hover:bg-[#151719]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-black/25">
                      <RiSmartphoneLine size={22} className="text-zinc-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {dev.name || dev.model || 'Saved Phone'}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">{dev.model || 'ANDROID DEVICE'}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-300">
                    {status === 'connecting' && ip === dev.ip ? 'LINKING...' : 'CONNECT'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <span className="block text-[10px] uppercase text-zinc-600">IP</span>
                    <span className="font-mono text-zinc-300">{dev.ip}</span>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <span className="block text-[10px] uppercase text-zinc-600">Port</span>
                    <span className="font-mono text-zinc-300">{dev.port || '5555'}</span>
                  </div>
                  <div className="col-span-2 rounded-lg bg-black/20 px-3 py-2">
                    <span className="block text-[10px] uppercase text-zinc-600">
                      Last connected
                    </span>
                    <span className="text-zinc-300">{formatLastConnected(dev.lastConnected)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status !== 'connected' && uiMode === 'manual') {
    return (
      <div className="relative flex-1 flex flex-col lg:flex-row items-start justify-center gap-8 p-6 md:p-12 animate-in fade-in duration-300 bg-[#080a09] min-h-dvh overflow-y-auto text-zinc-100 pb-24">
      <BackgroundGlows />

        <div className="w-full lg:w-1/3 max-w-md flex flex-col gap-6 shrink-0">
          {deviceHistory.length > 0 && (
            <button
              onClick={() => setUiMode('history')}
              className="w-fit rounded-lg border border-white/20 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/50 hover:text-white"
            >
              Saved Devices
            </button>
          )}

          <div className="p-5 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/[0.03] rounded-lg border border-white/20">
                <FaAndroid className="text-white text-2xl" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add Device</h2>
                <p className="text-xs text-zinc-500">USB trust first, auto Wi-Fi after that</p>
              </div>
            </div>
          </div>

          <div className="p-6 border border-white/20 rounded-xl bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-6">
            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg font-mono leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleUsbConnect}
              disabled={status === 'connecting'}
              className="w-full rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-50"
            >
              {status === 'connecting' ? 'Scanning USB...' : 'Connect via USB Debugging'}
            </button>

            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <div className="h-px flex-1 bg-white/10"></div>
              <span>or saved wireless bridge</span>
              <div className="h-px flex-1 bg-white/10"></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-2 block">Phone Name</label>
              <div className="flex items-center bg-black/25 border border-white/20 rounded-lg px-4 py-3 focus-within:border-white/60 transition-colors">
                <RiSmartphoneLine className="text-white mr-3" size={20} />
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="My Phone"
                  className="bg-transparent border-none outline-none text-base text-zinc-100 w-full placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-2 block">
                Target IP Address
              </label>
              <div className="flex items-center bg-black/25 border border-white/20 rounded-lg px-4 py-3 focus-within:border-white/60 transition-colors">
                <RiWifiLine className="text-white mr-3" size={20} />
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.1.xxx"
                  className="bg-transparent border-none outline-none text-base text-zinc-100 w-full placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-2 block">Target Port</label>
              <div className="flex items-center bg-black/25 border border-white/20 rounded-lg px-4 py-3 focus-within:border-white/60 transition-colors">
                <RiLinkM className="text-white mr-3" size={20} />
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="5555"
                  className="bg-transparent border-none outline-none text-base text-zinc-100 w-full placeholder:text-zinc-600"
                />
              </div>
            </div>

            <button
              onClick={handleManualConnect}
              disabled={status === 'connecting'}
              className="w-full mt-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-50"
            >
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>

            <button
              onClick={handleSaveDevice}
              disabled={status === 'connecting'}
              className="w-full rounded-lg border border-white/20 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/50 disabled:opacity-50"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RiSave3Line size={18} /> Save Phone Box
              </span>
            </button>
          </div>
        </div>

        <div className="w-full lg:w-1/2 max-w-2xl flex flex-col">
          <div className="bg-black border border-white/40 rounded-2xl shadow-lg p-8 md:p-10 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <RiTerminalLine size={240} />
            </div>

            <div className="flex items-center gap-4 mb-8 relative z-10">
              <RiTerminalBoxLine className="text-white" size={28} />
              <h3 className="text-base font-bold tracking-[0.2em] text-white uppercase">
                First-Time Setup Protocol
              </h3>
            </div>

            <p className="text-sm text-zinc-400 font-mono mb-10 leading-relaxed relative z-10 pr-4">
              First connect with USB debugging. If your laptop is connected to this phone's hotspot,
              IRIS will use the phone's hotspot gateway IP, save it, and reconnect after unplugging.
            </p>

            <div className="space-y-8 relative z-10">
              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-950 border border-white/50 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    1
                  </div>
                  <div className="w-px h-full bg-white/30 my-2"></div>
                </div>
                <div className="pb-3">
                  <h4 className="text-sm font-bold text-white tracking-wider mb-2">
                    ENABLE USB DEBUGGING
                  </h4>
                  <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                    Go to{' '}
                    <span className="text-white">Settings &gt; Developer Options</span> on
                    your Android and enable USB Debugging. (If hidden, tap "Build Number" 7 times in
                    About Phone).
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-950 border border-white/50 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    2
                  </div>
                  <div className="w-px h-full bg-white/30 my-2"></div>
                </div>
                <div className="pb-3">
                  <h4 className="text-sm font-bold text-white tracking-wider mb-2">
                    PHYSICAL LINK
                  </h4>
                  <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                    Connect the device to this PC via USB cable. Accept the "Allow USB debugging"
                    prompt on your phone's screen.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-950 border border-white/50 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    3
                  </div>
                  <div className="w-px h-full bg-white/30 my-2"></div>
                </div>
                <div className="pb-3 w-full">
                  <h4 className="text-sm font-bold text-white tracking-wider mb-2">
                    CONNECT DIRECTLY
                  </h4>
                  <p className="text-xs font-mono text-zinc-500 leading-relaxed mb-3">
                    Keep the cable plugged in and click Connect via USB Debugging. IRIS will prepare
                    port 5555 and try the hotspot/Wi-Fi IPs before you unplug.
                  </p>

                  <div className="relative group w-full">
                    <code className="block w-full bg-zinc-950 border border-white/30 text-white text-sm p-4 pr-14 rounded-xl tracking-widest font-mono">
                      USB TRUST + AUTO WIRELESS BRIDGE
                    </code>
                    <button
                      onClick={handleCopyCommand}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white hover:text-white hover:bg-white/30 rounded-lg transition-all"
                      title="Copy command"
                    >
                      {copied ? (
                        <RiCheckLine size={20} className="text-white" />
                      ) : (
                        <RiFileCopyLine size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center text-xs font-bold text-black shrink-0">
                    4
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wider mb-2">
                    OPTIONAL WI-FI FALLBACK
                  </h4>
                  <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                    After IRIS shows the Wi-Fi bridge as active, unplug the cable. Keep the laptop
                    connected to the phone hotspot so the saved IP remains reachable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 p-10 animate-in fade-in duration-500 bg-[#080a09] min-h-screen overflow-y-auto">
      <BackgroundGlows />

      <div className="w-1/4 flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <RiSmartphoneLine className="text-purple-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-widest uppercase">
              {telemetry.model}
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              {telemetry.os}
            </p>
          </div>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-cyan-500 border-b border-white/20 pb-4 mb-4">
          <span>UPTIME: LIVE</span>
          <span className="text-orange-500">TEMP: {telemetry.battery.temp}°C</span>
        </div>

        <h3 className="text-fuchsia-500 font-bold tracking-widest text-sm text-center my-6 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
          DEVICE TELEMETRY
        </h3>

        <div className="flex flex-col gap-4">
          <div className="bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 rounded-2xl p-5 hover:border-purple-500/30 transition-all">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest">NETWORK</span>
              <RiSignalWifi3Line className="text-purple-500" />
            </div>
            <h4 className="text-2xl font-black text-white">
              {status === 'verifying' ? 'VERIFYING...' : 'ACTIVE'}
            </h4>
            <span className="text-[10px] font-mono text-white uppercase">
              {status === 'verifying'
                ? 'Testing Data Link'
                : connectionMode === 'usb'
                  ? 'USB Debugging Direct'
                  : 'Seamless Wireless Bridge'}
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 rounded-2xl p-5 hover:border-purple-500/30 transition-all">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest">BATTERY</span>
              <RiBattery2ChargeLine className="text-green-500" />
            </div>
            <div className="flex justify-between items-end mb-2">
              <h4 className="text-3xl font-black text-white">{telemetry.battery.level}%</h4>
              <span className="text-[10px] font-mono text-green-500">
                {telemetry.battery.isCharging ? 'CHARGING' : 'DISCHARGING'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-green-500 h-1.5 shadow-[0_0_10px_rgba(34,197,94,0.8)]"
                style={{ width: `${telemetry.battery.level}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 rounded-2xl p-5 hover:border-purple-500/30 transition-all">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest">STORAGE</span>
              <RiDatabase2Line className="text-orange-500" />
            </div>
            <div className="flex justify-between items-end mb-2">
              <h4 className="text-3xl font-black text-white">{telemetry.storage.used}</h4>
              <span className="text-[10px] font-mono text-zinc-500">{telemetry.storage.total}</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-orange-500 h-1.5 shadow-[0_0_10px_rgba(249,115,22,0.8)]"
                style={{ width: `${telemetry.storage.percent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-1/3 flex justify-center relative">
        <div className="w-full max-w-[320px] h-162.5 bg-black rounded-[3rem] border-12 border-[#1a1a1a] shadow-[0_0_50px_rgba(168,85,247,0.1)] relative overflow-hidden flex flex-col">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20 flex items-center justify-end px-3 gap-2 shadow-md">
            <div className="w-2 h-2 rounded-full bg-purple-500/50"></div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          </div>
          <img ref={screenRef} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"></div>
        </div>
      </div>

      <div className="w-1/4 flex flex-col h-162.5 relative">
        <div className="bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/20 rounded-2xl p-6 flex flex-col h-full shadow-lg">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/20">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <RiTerminalBoxLine className="text-purple-400" size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-widest uppercase">
                SYSTEM CONTROLS
              </h3>
              <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                NEURAL UPLINK SECURED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-auto">
            <button
              onClick={() => executeQuickCommand('camera')}
              className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/50 border border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-2xl transition-all"
            >
              <RiCameraLensLine
                size={28}
                className="text-zinc-500 group-hover:text-purple-400 transition-colors"
              />
              <span className="text-[10px] font-bold text-white tracking-widest">CAMERA</span>
            </button>
            <button
              onClick={() => executeQuickCommand('lock')}
              className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/50 border border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-2xl transition-all"
            >
              <RiLockPasswordLine
                size={28}
                className="text-zinc-500 group-hover:text-purple-400 transition-colors"
              />
              <span className="text-[10px] font-bold text-white tracking-widest">LOCK</span>
            </button>
            <button
              onClick={() => executeQuickCommand('wake')}
              className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/50 border border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-2xl transition-all"
            >
              <RiSunLine
                size={28}
                className="text-zinc-500 group-hover:text-purple-400 transition-colors"
              />
              <span className="text-[10px] font-bold text-white tracking-widest">WAKE</span>
            </button>
            <button
              onClick={() => executeQuickCommand('home')}
              className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/50 border border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-2xl transition-all"
            >
              <RiHome5Line
                size={28}
                className="text-zinc-500 group-hover:text-purple-400 transition-colors"
              />
              <span className="text-[10px] font-bold text-white tracking-widest">HOME</span>
            </button>
          </div>

          <div className="mb-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <p className="text-[10px] text-purple-400 font-mono leading-relaxed text-center">
              APEX is listening via the primary neural audio interface. Voice commands for app
              execution are online.
            </p>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold rounded-xl tracking-widest transition-all duration-300 border border-red-500/30 flex items-center justify-center gap-3"
          >
            <RiShutDownLine size={20} /> SEVER CONNECTION
          </button>
        </div>
      </div>
    </div>
  )
}

export default PhoneView
