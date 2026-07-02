import { IpcMain, app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import util from 'util'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'

const execAsync = util.promisify(exec)

type ActiveDevice = {
  id: string
  mode: 'usb' | 'wifi'
  serial?: string
  ip?: string
  port?: string
  model?: string
}

let activeDevice: ActiveDevice | null = null

type AdbDeviceState = 'device' | 'unauthorized' | 'offline' | 'unknown'

type ParsedAdbDevice = {
  serial: string
  state: AdbDeviceState
  raw: string
}

export default function registerAdbHandlers(ipcMain: IpcMain) {
  const getAdbPath = () => {
    if (app.isPackaged) {
      return `"${path.join(process.resourcesPath, 'adb', 'adb.exe')}"`
    }
    const devAdbPath = path.join(process.cwd(), 'resources', 'adb', 'adb.exe')
    if (existsSync(devAdbPath)) {
      return `"${devAdbPath}"`
    }
    return 'adb'
  }
  const adb = getAdbPath()

  const dirPath = path.join(app.getPath('userData'), 'Connected Devices')
  const historyPath = path.join(dirPath, 'Connect-mobile.json')

  let isMonitoring = false
  const failedAttempts = new Map<string, number>() // IP -> timestamp of last failure
  let excludedIp: string | null = null // IP that was manually disconnected this session
  let lastUsbPromotionAttempt = 0
  let autoConnectPaused = false

  const getActiveTarget = () => {
    if (!activeDevice) return ''
    if (activeDevice.mode === 'usb' && activeDevice.serial) return `-s ${activeDevice.serial}`
    if (activeDevice.ip && activeDevice.port) return `-s ${activeDevice.ip}:${activeDevice.port}`
    return ''
  }

  const parseAdbDevices = (stdout: string): ParsedAdbDevice[] => {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('List of'))
      .map((line) => {
        const parts = line.split(/\s+/)
        const state = ['device', 'unauthorized', 'offline'].includes(parts[1])
          ? (parts[1] as AdbDeviceState)
          : 'unknown'
        return { serial: parts[0], state, raw: line }
      })
  }

  const getConnectedDevices = async () => {
    const { stdout } = await execAsync(`${adb} devices -l`, { timeout: 8000 })
    return parseAdbDevices(stdout)
  }

  const getDeviceModel = async (serial: string, fallback = 'ANDROID DEVICE') => {
    try {
      const { stdout } = await execAsync(`${adb} -s ${serial} shell getprop ro.product.model`, {
        timeout: 4000
      })
      return stdout.trim().toUpperCase() || fallback
    } catch (e) {
      return fallback
    }
  }

  const verifyTarget = async (target: string) => {
    try {
      await execAsync(`${adb} ${target} shell echo iris-ready`, { timeout: 5000 })
      return true
    } catch (e) {
      return false
    }
  }

  const clearInactiveActiveDevice = async () => {
    const target = getActiveTarget()
    if (!target) {
      activeDevice = null
      return false
    }

    const isAlive = await verifyTarget(target)
    if (!isAlive) {
      activeDevice = null
      emitAutoConnected()
      return false
    }
    return true
  }

  const getUsbModel = async (serial: string) => {
    return getDeviceModel(serial, 'USB DEVICE')
  }

  const emitAutoConnected = () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('adb-auto-connected', activeDevice)
    })
  }

  const saveDeviceToHistory = async (ip: string, port: string, model: string, name?: string) => {
    try {
      if (!existsSync(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true })
      }

      let history: any[] = []
      try {
        if (existsSync(historyPath)) {
          const file = await fs.readFile(historyPath, 'utf-8')
          history = JSON.parse(file)
        }
      } catch (e) {}

      const existingIndex = history.findIndex((d) => d.ip === ip && String(d.port) === String(port))
      const displayName = (name || model || 'ANDROID DEVICE').trim()
      const deviceData = {
        ip,
        port,
        model,
        name: displayName,
        lastConnected: new Date().toISOString()
      }

      if (existingIndex > -1) {
        history[existingIndex] = deviceData
      } else {
        history.push(deviceData)
      }
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2))
    } catch (e) {}
  }

  const readDeviceHistory = async () => {
    try {
      if (!existsSync(historyPath)) return []
      const file = await fs.readFile(historyPath, 'utf-8')
      return JSON.parse(file)
    } catch (e) {
      return []
    }
  }

  const connectSavedWirelessDevice = async () => {
    const history = await readDeviceHistory()
    const savedDevices = [...history].reverse()

    for (const device of savedDevices) {
      const ip = String(device.ip || '').trim()
      const port = String(device.port || '5555').trim()
      if (!ip || ip === excludedIp) continue

      const lastFailed = failedAttempts.get(ip) || 0
      if (Date.now() - lastFailed < 30000) continue

      try {
        const { stdout } = await execAsync(`${adb} connect ${ip}:${port}`, { timeout: 7000 })
        const connected =
          stdout.toLowerCase().includes('connected') ||
          stdout.toLowerCase().includes('already connected')

        if (connected && (await verifyTarget(`-s ${ip}:${port}`))) {
          const model = await getDeviceModel(`${ip}:${port}`, device.model || 'ANDROID DEVICE')
          activeDevice = { id: `${ip}:${port}`, mode: 'wifi', ip, port, model }
          failedAttempts.delete(ip)
          await saveDeviceToHistory(ip, port, model)
          emitAutoConnected()
          console.log(`[ADB] Reconnected saved cable-free bridge at ${ip}:${port}`)
          return true
        }

        failedAttempts.set(ip, Date.now())
      } catch (e) {
        failedAttempts.set(ip, Date.now())
      }
    }

    return false
  }

  const getHostGatewayIPs = async () => {
    const candidates: string[] = []
    const addCandidate = (ip?: string | null) => {
      const cleanIp = (ip || '').trim()
      if (
        cleanIp &&
        /^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp) &&
        cleanIp !== '0.0.0.0' &&
        cleanIp !== '127.0.0.1' &&
        !candidates.includes(cleanIp)
      ) {
        candidates.push(cleanIp)
      }
    }

    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          `powershell.exe -NoProfile -Command "Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -ExpandProperty NextHop"`,
          { timeout: 5000 }
        )
        stdout.split(/\r?\n/).forEach(addCandidate)
      } catch (e) {}

      try {
        const { stdout } = await execAsync(`ipconfig`, { timeout: 5000 })
        const gatewayMatches = [
          ...stdout.matchAll(/Default Gateway[ .]*:\s*(\d+\.\d+\.\d+\.\d+)/gi)
        ]
        gatewayMatches.forEach((match) => addCandidate(match[1]))
      } catch (e) {}
    } else {
      try {
        const { stdout } = await execAsync(`ip route show default`, { timeout: 5000 })
        const gatewayMatches = [...stdout.matchAll(/\bvia\s+(\d+\.\d+\.\d+\.\d+)/g)]
        gatewayMatches.forEach((match) => addCandidate(match[1]))
      } catch (e) {}
    }

    return candidates
  }

  const promoteUsbDeviceToWifi = async (serial: string, model: string) => {
    const ips = [...(await getDeviceIPs(serial)), ...(await getHostGatewayIPs())].filter(
      (ip, index, all) => all.indexOf(ip) === index
    )
    if (ips.length === 0) return false

    const candidateIps = ips.filter((ip) => {
      if (ip === excludedIp) return false
      const lastFailed = failedAttempts.get(ip) || 0
      return Date.now() - lastFailed >= 60000
    })

    if (candidateIps.length === 0) return false

    try {
      console.log(`[ADB] USB linked. Preparing cable-free bridge...`)
      await execAsync(`${adb} -s ${serial} tcpip 5555`, { timeout: 8000 })

      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 1800 : 1200))

        for (const ip of candidateIps) {
          console.log(`[ADB] Trying cable-free bridge at ${ip}:5555...`)
          try {
            const { stdout: connectOut } = await execAsync(`${adb} connect ${ip}:5555`, {
              timeout: 8000
            })

            if (
              connectOut.toLowerCase().includes('connected') ||
              connectOut.toLowerCase().includes('already connected')
            ) {
              const isVerified = await verifyWirelessLink(ip)
              if (isVerified) {
                failedAttempts.delete(ip)
                excludedIp = null
                activeDevice = { id: `${ip}:5555`, mode: 'wifi', ip, port: '5555', model }
                await saveDeviceToHistory(ip, '5555', model)
                emitAutoConnected()
                console.log(`[ADB] Cable-free bridge ready at ${ip}:5555`)
                return true
              }
            }

            if (attempt === 5) failedAttempts.set(ip, Date.now())
          } catch (e) {
            if (attempt === 5) failedAttempts.set(ip, Date.now())
          }
        }
      }

      return false
    } catch (e: any) {
      console.warn(`[ADB] Cable-free bridge failed: ${e.message}`)
      candidateIps.forEach((ip) => failedAttempts.set(ip, Date.now()))
      return false
    }
  }

  const connectFirstUsbDevice = async () => {
    await execAsync(`${adb} start-server`, { timeout: 8000 })
    const devices = await getConnectedDevices()
    const usbDevice = devices.find((d) => !d.serial.includes(':') && d.state === 'device')

    if (!usbDevice) {
      const unauthorized = devices.find(
        (d) => !d.serial.includes(':') && d.state === 'unauthorized'
      )
      if (unauthorized) {
        return {
          success: false,
          error: 'Phone detected but not authorized. Unlock it and tap "Allow USB debugging".'
        }
      }

      const offline = devices.find((d) => !d.serial.includes(':') && d.state === 'offline')
      if (offline) {
        return {
          success: false,
          error: 'Phone is offline in ADB. Replug the USB cable, unlock the phone, then try again.'
        }
      }

      return {
        success: false,
        error:
          'No authorized USB device found. Enable USB debugging and accept the prompt on your phone.'
      }
    }

    const serial = usbDevice.serial
    const model = await getUsbModel(serial)
    activeDevice = { id: serial, mode: 'usb', serial, model }
    excludedIp = null
    emitAutoConnected()

    const promoted = await promoteUsbDeviceToWifi(serial, model)

    return {
      success: true,
      device: activeDevice,
      wirelessReady: promoted,
      warning: promoted
        ? undefined
        : 'USB is connected, but the cable-free bridge was not ready. Keep the laptop connected to this phone hotspot and try USB Connect again.'
    }
  }

  const getDeviceIPs = async (serial: string) => {
    const candidates: string[] = []
    const addCandidate = (ip?: string | null) => {
      const cleanIp = (ip || '').trim()
      if (
        cleanIp &&
        /^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp) &&
        cleanIp !== '127.0.0.1' &&
        !candidates.includes(cleanIp)
      ) {
        candidates.push(cleanIp)
      }
    }

    try {
      const { stdout } = await execAsync(`${adb} -s ${serial} shell ip -f inet addr show`)
      const lines = stdout.split('\n')

      // Hotspot phones often expose the laptop-facing gateway on ap0/swlan*/wlan*.
      const preferredInterfaces = /(ap\d+|swlan\d+|wlan\d+|wifi\d+|eth\d+|rndis\d+)/
      for (const line of lines) {
        const match = line.match(
          new RegExp(
            `inet (\\d+\\.\\d+\\.\\d+\\.\\d+).*scope global .*${preferredInterfaces.source}`
          )
        )
        if (match) {
          addCandidate(match[1])
        }
      }

      for (const line of lines) {
        if (line.includes('scope global') && !line.includes('lo')) {
          const match = line.match(/inet (\d+\.\d+\.\d+\.\d+)/)
          if (match) addCandidate(match[1])
        }
      }
    } catch (e) {}

    try {
      const { stdout: routeOut } = await execAsync(`${adb} -s ${serial} shell ip route`, {
        timeout: 4000
      })
      const srcMatches = [...routeOut.matchAll(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)/g)]
      srcMatches.forEach((match) => addCandidate(match[1]))
    } catch (e) {}

    try {
      const props = [
        'dhcp.ap0.ipaddress',
        'dhcp.swlan0.ipaddress',
        'dhcp.wlan0.ipaddress',
        'dhcp.wifi.interface',
        'dhcp.eth0.ipaddress'
      ]
      for (const prop of props) {
        const { stdout: propOut } = await execAsync(`${adb} -s ${serial} shell getprop ${prop}`)
        addCandidate(propOut)
      }
    } catch (e) {}

    return candidates
  }

  const getDeviceIP = async (serial: string) => {
    const ips = await getDeviceIPs(serial)
    return ips[0] || null
  }

  const verifyWirelessLink = async (ip: string) => {
    try {
      const { stdout } = await execAsync(`${adb} -s ${ip}:5555 shell getprop ro.product.model`, {
        timeout: 4000
      })
      return stdout.trim().length > 0
    } catch (e) {
      return false
    }
  }

  const startBackgroundMonitor = async () => {
    if (isMonitoring) return
    isMonitoring = true

    setInterval(async () => {
      try {
        const devices = await getConnectedDevices()
        const usbDevices = devices.filter((d) => !d.serial.includes(':') && d.state === 'device')
        const wirelessDevices = devices.filter(
          (d) => d.serial.includes(':') && d.state === 'device'
        )

        if (activeDevice) {
          const activeStillListed = devices.some(
            (d) => d.serial === activeDevice?.id && d.state === 'device'
          )
          if (!activeStillListed) {
            await clearInactiveActiveDevice()
          } else if (
            activeDevice.mode === 'usb' &&
            activeDevice.serial &&
            Date.now() - lastUsbPromotionAttempt > 30000
          ) {
            lastUsbPromotionAttempt = Date.now()
            const promoted = await promoteUsbDeviceToWifi(
              activeDevice.serial,
              activeDevice.model || 'USB DEVICE'
            )
            if (promoted) return
          }
        }

        if (autoConnectPaused) return

        if (!activeDevice && usbDevices.length > 0) {
          await connectFirstUsbDevice()
          return
        }

        // SMART ADOPTION: If no active device, check if any wireless device matches history.
        // This runs only while auto-connect is not paused by a manual disconnect.
        if (!activeDevice && wirelessDevices.length > 0) {
          try {
            const history = await readDeviceHistory()
            if (history.length > 0) {
              const lastUsed = history[history.length - 1]
              const foundMatch = wirelessDevices.some((d) => d.serial.includes(lastUsed.ip))

              if (foundMatch && lastUsed.ip !== excludedIp) {
                const isVerified = await verifyWirelessLink(lastUsed.ip)
                if (isVerified) {
                  console.log(`[ADB] Smart Adoption: Re-linking to last used device ${lastUsed.ip}`)
                  activeDevice = {
                    id: `${lastUsed.ip}:${lastUsed.port || '5555'}`,
                    mode: 'wifi',
                    ip: lastUsed.ip,
                    port: lastUsed.port || '5555',
                    model: lastUsed.model
                  }
                  emitAutoConnected()
                }
              }
            }
          } catch (e) {}
        }

        if (activeDevice) return

        for (const line of usbDevices) {
          const serial = line.serial
          const ip = await getDeviceIP(serial)

          if (ip) {
            // If we find a NEW USB IP, we reset the exclusion (physical action implies intent)
            if (ip === excludedIp) excludedIp = null

            // Priority: Check if we are in a cooling period for this IP
            const lastFailed = failedAttempts.get(ip) || 0
            if (Date.now() - lastFailed < 60000) {
              continue
            }

            // Check if already connected wirelessly
            const isAlreadyConnected = wirelessDevices.some((d) => d.serial.includes(ip))

            if (!isAlreadyConnected) {
              console.log(`[ADB] USB Device detected (${serial}). Initiating Handshake at ${ip}...`)
              await execAsync(`${adb} -s ${serial} tcpip 5555`)
              await new Promise((r) => setTimeout(r, 2000))

              const { stdout: connectOut } = await execAsync(`${adb} connect ${ip}:5555`)

              if (connectOut.toLowerCase().includes('connected')) {
                const isVerified = await verifyWirelessLink(ip)
                if (isVerified) {
                  console.log(`[ADB] Successfully established AND VERIFIED connection to ${ip}`)
                  failedAttempts.delete(ip)
                  excludedIp = null // Reset exclusion on successful handshake

                  if (!activeDevice) {
                    const model = await getDeviceModel(`${ip}:5555`)
                    activeDevice = { id: `${ip}:5555`, mode: 'wifi', ip, port: '5555', model }
                    await saveDeviceToHistory(ip, '5555', model)
                    emitAutoConnected()
                  }
                } else {
                  console.warn(
                    `[ADB] Connection to ${ip} established but failed data verification.`
                  )
                  failedAttempts.set(ip, Date.now())
                  await execAsync(`${adb} disconnect ${ip}:5555`)
                }
              } else {
                console.warn(`[ADB] Failed to connect to ${ip}: ${connectOut.trim()}`)
                failedAttempts.set(ip, Date.now())
              }
            }
          }
        }
      } catch (e: any) {
        if (!e.message.includes('adb devices')) {
          console.error(`[ADB Monitor Error]: ${e.message}`)
        }
      }
    }, 5000)
  }

  // Start the monitor
  startBackgroundMonitor()

  ipcMain.removeHandler('adb-get-history')
  ipcMain.handle('adb-get-history', async () => {
    const history = await readDeviceHistory()
    return history.sort(
      (a: any, b: any) =>
        new Date(b.lastConnected || 0).getTime() - new Date(a.lastConnected || 0).getTime()
    )
  })

  ipcMain.removeHandler('adb-save-device')
  ipcMain.handle('adb-save-device', async (_, { ip, port = '5555', name, model }) => {
    try {
      const cleanIp = String(ip || '').trim()
      const cleanPort = String(port || '5555').trim()
      const cleanName = String(name || model || 'Saved Phone').trim()

      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp) || !/^\d{2,5}$/.test(cleanPort)) {
        return { success: false, error: 'Enter a valid phone IP address and ADB port.' }
      }

      await saveDeviceToHistory(cleanIp, cleanPort, cleanName.toUpperCase(), cleanName)
      return { success: true, devices: await readDeviceHistory() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-connect')
  ipcMain.handle('adb-connect', async (_, { ip, port }) => {
    try {
      autoConnectPaused = false
      const cleanIp = String(ip || '').trim()
      const cleanPort = String(port || '5555').trim()
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp) || !/^\d{2,5}$/.test(cleanPort)) {
        return { success: false, error: 'Enter a valid phone IP address and ADB port.' }
      }

      const { stdout } = await execAsync(`${adb} connect ${cleanIp}:${cleanPort}`, {
        timeout: 10000
      })

      if (
        stdout.toLowerCase().includes('connected to') ||
        stdout.toLowerCase().includes('already connected')
      ) {
        const target = `-s ${cleanIp}:${cleanPort}`
        const verified = await verifyTarget(target)
        if (!verified) {
          activeDevice = null
          return {
            success: false,
            error: 'ADB connected text was returned, but the phone did not respond to commands.'
          }
        }

        activeDevice = { id: `${cleanIp}:${cleanPort}`, mode: 'wifi', ip: cleanIp, port: cleanPort }
        excludedIp = null // Reset exclusion on manual connect

        try {
          const model = await getDeviceModel(`${cleanIp}:${cleanPort}`, 'UNKNOWN DEVICE')
          activeDevice.model = model
          await saveDeviceToHistory(cleanIp, cleanPort, model)
        } catch (e) {}

        return { success: true, device: activeDevice }
      }
      return { success: false, error: stdout }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-connect-usb')
  ipcMain.handle('adb-connect-usb', async () => {
    try {
      autoConnectPaused = false
      return await connectFirstUsbDevice()
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-disconnect')
  ipcMain.handle('adb-disconnect', async () => {
    autoConnectPaused = true
    if (!activeDevice) return { success: true }
    try {
      if (activeDevice.mode === 'wifi' && activeDevice.ip && activeDevice.port) {
        excludedIp = activeDevice.ip // Remember this was manually disconnected
        await execAsync(`${adb} disconnect ${activeDevice.ip}:${activeDevice.port}`)
      } else {
        excludedIp = null
      }
      activeDevice = null
      return { success: true }
    } catch (e: any) {
      return { success: false }
    }
  })

  ipcMain.removeHandler('adb-screenshot')
  ipcMain.handle('adb-screenshot', async () => {
    if (!activeDevice) return { success: false }
    const target = getActiveTarget()
    if (!target) return { success: false }
    return new Promise((resolve) => {
      exec(
        `${adb} ${target} exec-out screencap -p`,
        { encoding: 'buffer', maxBuffer: 1024 * 1024 * 20 },
        (error, stdout) => {
          if (error) {
            resolve({ success: false })
          } else {
            const base64 = `data:image/png;base64,${stdout.toString('base64')}`
            resolve({ success: true, image: base64 })
          }
        }
      )
    })
  })

  ipcMain.removeHandler('adb-quick-action')
  ipcMain.handle('adb-quick-action', async (_, { action }) => {
    if (!activeDevice) return { success: false }
    const target = getActiveTarget()
    if (!target) return { success: false }
    try {
      if (action === 'camera') {
        await execAsync(
          `${adb} ${target} shell am start -a android.media.action.STILL_IMAGE_CAMERA`
        )
      } else if (action === 'wake') {
        await execAsync(`${adb} ${target} shell input keyevent KEYCODE_WAKEUP`)
      } else if (action === 'lock') {
        await execAsync(`${adb} ${target} shell input keyevent KEYCODE_SLEEP`)
      } else if (action === 'home') {
        await execAsync(`${adb} ${target} shell input keyevent KEYCODE_HOME`)
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-telemetry')
  ipcMain.handle('adb-telemetry', async () => {
    if (!activeDevice) return { success: false, error: 'No device connected' }
    const target = getActiveTarget()
    if (!target) return { success: false, error: 'No device connected' }
    try {
      const { stdout: batteryOut } = await execAsync(`${adb} ${target} shell dumpsys battery`)
      const levelMatch = batteryOut.match(/level: (\d+)/)
      const tempMatch = batteryOut.match(/temperature: (\d+)/)
      const isCharging =
        batteryOut.includes('AC powered: true') || batteryOut.includes('USB powered: true')

      const level = levelMatch ? parseInt(levelMatch[1]) : 0
      const temp = tempMatch ? (parseInt(tempMatch[1]) / 10).toFixed(1) : 0

      const { stdout: storageOut } = await execAsync(`${adb} ${target} shell df -h /data`)
      const storageLines = storageOut.trim().split('\n')
      let storageUsed = '0',
        storageTotal = '0',
        storagePercent = 0

      if (storageLines.length > 1) {
        const parts = storageLines[1].trim().split(/\s+/)
        storageTotal = parts[1]
        storageUsed = parts[2]
        storagePercent = parseInt(parts[4].replace('%', '')) || 0
      }

      const { stdout: modelOut } = await execAsync(
        `${adb} ${target} shell getprop ro.product.model`
      )
      const { stdout: osOut } = await execAsync(
        `${adb} ${target} shell getprop ro.build.version.release`
      )

      return {
        success: true,
        data: {
          model: modelOut.trim().toUpperCase(),
          os: `ANDROID ${osOut.trim()}`,
          battery: { level, isCharging, temp },
          storage: { used: storageUsed, total: storageTotal, percent: storagePercent }
        }
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('get-mobile-info-ai')
  ipcMain.handle('get-mobile-info-ai', async () => {
    if (!activeDevice) return 'Error: You are not currently connected to any mobile device.'
    try {
      const target = getActiveTarget()
      if (!target) return 'Error: You are not currently connected to any mobile device.'
      const { stdout: batOut } = await execAsync(`${adb} ${target} shell dumpsys battery`)
      const level = batOut.match(/level: (\d+)/)?.[1] || 'Unknown'
      const { stdout: modelOut } = await execAsync(
        `${adb} ${target} shell getprop ro.product.model`
      )

      return `I am currently linked to your ${modelOut.trim()}. The battery is at ${level}%.`
    } catch (e) {
      return 'I am connected, but I could not retrieve the telemetry data.'
    }
  })

  ipcMain.removeHandler('adb-open-app')
  ipcMain.handle('adb-open-app', async (_, { packageName }) => {
    if (!activeDevice) return { success: false, error: 'No phone connected.' }

    try {
      const target = getActiveTarget()
      if (!target) return { success: false, error: 'No phone connected.' }

      if (packageName === 'android.media.action.STILL_IMAGE_CAMERA') {
        await execAsync(
          `${adb} ${target} shell am start -a android.media.action.STILL_IMAGE_CAMERA`
        )
        return { success: true }
      }

      await execAsync(
        `${adb} ${target} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
      )
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-close-app')
  ipcMain.handle('adb-close-app', async (_, { packageName }) => {
    if (!activeDevice) return { success: false, error: 'No phone connected.' }

    try {
      const target = getActiveTarget()
      if (!target) return { success: false, error: 'No phone connected.' }

      if (packageName === 'android.media.action.STILL_IMAGE_CAMERA') {
        await execAsync(`${adb} ${target} shell am force-stop com.google.android.GoogleCamera`)
        return { success: true }
      }

      await execAsync(`${adb} ${target} shell am force-stop ${packageName}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-tap')
  ipcMain.handle('adb-tap', async (_, { xPercent, yPercent }) => {
    if (!activeDevice) return { success: false, error: 'No device' }
    const target = getActiveTarget()
    if (!target) return { success: false, error: 'No device' }

    try {
      const { stdout } = await execAsync(`${adb} ${target} shell wm size`)
      const match = stdout.match(/(\d+)x(\d+)/)

      if (match) {
        const width = parseInt(match[1])
        const height = parseInt(match[2])

        const x = Math.round((xPercent / 100) * width)
        const y = Math.round((yPercent / 100) * height)

        await execAsync(`${adb} ${target} shell input tap ${x} ${y}`)
        return { success: true }
      }
      return { success: false, error: 'Could not calculate screen size.' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-swipe')
  ipcMain.handle('adb-swipe', async (_, { direction }) => {
    if (!activeDevice) return { success: false, error: 'No device' }
    const target = getActiveTarget()
    if (!target) return { success: false, error: 'No device' }

    try {
      const { stdout } = await execAsync(`${adb} ${target} shell wm size`)
      const match = stdout.match(/(\d+)x(\d+)/)
      if (!match) return { success: false }

      const w = parseInt(match[1])
      const h = parseInt(match[2])
      const cx = Math.round(w / 2)
      const cy = Math.round(h / 2)

      let cmd = ''
      if (direction === 'up')
        cmd = `input swipe ${cx} ${Math.round(h * 0.7)} ${cx} ${Math.round(h * 0.3)} 300`
      if (direction === 'down')
        cmd = `input swipe ${cx} ${Math.round(h * 0.3)} ${cx} ${Math.round(h * 0.7)} 300`
      if (direction === 'left')
        cmd = `input swipe ${Math.round(w * 0.8)} ${cy} ${Math.round(w * 0.2)} ${cy} 300`
      if (direction === 'right')
        cmd = `input swipe ${Math.round(w * 0.2)} ${cy} ${Math.round(w * 0.8)} ${cy} 300`

      if (cmd) {
        await execAsync(`${adb} ${target} shell ${cmd}`)
        return { success: true }
      }
      return { success: false, error: 'Invalid direction.' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-get-notifications')
  ipcMain.handle('adb-get-notifications', async () => {
    if (!activeDevice) return { success: false, error: 'No device connected.' }
    const target = getActiveTarget()
    if (!target) return { success: false, error: 'No device connected.' }

    try {
      const { stdout } = await execAsync(`${adb} ${target} shell dumpsys notification --noredact`)

      const notifications: string[] = []
      const lines = stdout.split('\n')
      let currentTitle = ''

      for (const line of lines) {
        if (line.includes('android.title=')) {
          const match = line.match(/android\.title=(?:String|CharSequence) \((.*?)\)/)
          if (match && match[1]) currentTitle = match[1].trim()
        } else if (line.includes('android.text=')) {
          const match = line.match(/android\.text=(?:String|CharSequence) \((.*?)\)/)
          if (match && match[1]) {
            const currentText = match[1].trim()

            const isSystem =
              currentTitle.toLowerCase().includes('running') ||
              currentTitle.toLowerCase().includes('sync') ||
              currentText.toLowerCase().includes('running')

            if (currentTitle && currentText && !isSystem) {
              const fullMsg = `You got a Message on your Smartphone from ${currentTitle}: ${currentText}`
              if (!notifications.includes(fullMsg)) {
                notifications.push(fullMsg)
              }
              currentTitle = ''
            }
          }
        }
      }

      return { success: true, data: notifications }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-push-file')
  ipcMain.handle('adb-push-file', async (_, { sourcePath, destPath = '/sdcard/Download/' }) => {
    if (!activeDevice) return { success: false, error: 'No phone connected.' }
    try {
      const target = getActiveTarget()
      if (!target) return { success: false, error: 'No phone connected.' }
      await execAsync(`${adb} ${target} push "${sourcePath}" "${destPath}"`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-pull-file')
  ipcMain.handle('adb-pull-file', async (_, { sourcePath, destPath }) => {
    if (!activeDevice) return { success: false, error: 'No phone connected.' }
    try {
      const target = getActiveTarget()
      if (!target) return { success: false, error: 'No phone connected.' }

      const finalDest = destPath || path.join(app.getPath('downloads'))

      await execAsync(`${adb} ${target} pull "${sourcePath}" "${finalDest}"`)
      return { success: true, savedTo: finalDest }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-hardware-toggle')
  ipcMain.handle('adb-hardware-toggle', async (_, { setting, state }) => {
    if (!activeDevice) return { success: false, error: 'No phone connected.' }
    const target = getActiveTarget()
    if (!target) return { success: false, error: 'No phone connected.' }

    try {
      const cleanSetting = setting.toLowerCase().trim()
      const action = state ? 'enable' : 'disable'

      if (cleanSetting === 'bluetooth' || cleanSetting === 'bt') {
        try {
          await execAsync(`${adb} ${target} shell svc bluetooth ${action}`, { timeout: 5000 })
        } catch (e) {
          await execAsync(`${adb} ${target} shell cmd bluetooth_manager ${action}`, {
            timeout: 5000
          })
        }
        return { success: true }
      }

      if (cleanSetting === 'wifi') {
        try {
          await execAsync(`${adb} ${target} shell svc wifi ${action}`, { timeout: 5000 })
        } catch (e) {
          const wifiState = state ? 'enabled' : 'disabled'
          await execAsync(`${adb} ${target} shell cmd wifi set-wifi-enabled ${wifiState}`, {
            timeout: 5000
          })
        }
        return { success: true }
      }

      if (cleanSetting === 'data' || cleanSetting === 'mobile data') {
        await execAsync(`${adb} ${target} shell svc data ${action}`, { timeout: 5000 })
        return { success: true }
      }

      if (cleanSetting === 'airplane' || cleanSetting === 'flight') {
        await execAsync(`${adb} ${target} shell cmd connectivity airplane-mode ${action}`, {
          timeout: 5000
        })
        return { success: true }
      }

      if (cleanSetting === 'location' || cleanSetting === 'gps') {
        const locState = state ? '3' : '0'
        await execAsync(`${adb} ${target} shell settings put secure location_mode ${locState}`, {
          timeout: 5000
        })
        return { success: true }
      }

      if (cleanSetting === 'flashlight' || cleanSetting === 'torch') {
        await execAsync(`${adb} ${target} shell input keyevent KEYCODE_WAKEUP`)

        await execAsync(`${adb} ${target} shell cmd statusbar expand-settings`)

        return {
          success: true,
          warning:
            'Android OS blocks silent flashlight toggles. I have pulled down your Quick Settings menu instead.'
        }
      }

      return { success: false, error: `I don't know how to toggle: ${setting}` }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('adb-get-status')
  ipcMain.handle('adb-get-status', async () => {
    if (activeDevice) {
      await clearInactiveActiveDevice()
    }
    return activeDevice
  })
}
