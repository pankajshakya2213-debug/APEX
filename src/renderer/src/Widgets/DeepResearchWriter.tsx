import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, CheckCircle2, Search, List } from 'lucide-react'

export default function DeepResearchWriter() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('')
  const [aiFileName, setAiFileName] = useState<string>('')
  const [displayedText, setDisplayedText] = useState('')
  const [isDone, setIsDone] = useState(false)
  
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Typewriter states
  const streamBufferRef = useRef('')
  const displayedLengthRef = useRef(0)
  const isDoneStreamingRef = useRef(false)
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleStart = (e: any) => {
      setQuery(e.detail.query)
      setMode(e.detail.mode)
      setAiFileName(e.detail.fileName || '')
      
      setDisplayedText('')
      streamBufferRef.current = ''
      displayedLengthRef.current = 0
      isDoneStreamingRef.current = false
      setIsDone(false)
      setIsOpen(true)
      
      // Start Typewriter Loop
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current)
      typewriterIntervalRef.current = setInterval(() => {
        const bufferLen = streamBufferRef.current.length
        const currLen = displayedLengthRef.current
        
        if (currLen < bufferLen) {
          // Calculate chunk size based on backlog to prevent falling too far behind
          const backlog = bufferLen - currLen
          const charsToAdd = backlog > 100 ? 5 : backlog > 20 ? 2 : 1
          
          displayedLengthRef.current = Math.min(currLen + charsToAdd, bufferLen)
          setDisplayedText(streamBufferRef.current.substring(0, displayedLengthRef.current))
          
          // Auto scroll to bottom
          if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight
          }
        } else if (currLen === bufferLen && isDoneStreamingRef.current) {
          // If buffer is empty and streaming is totally done, we mark UI as done
          setIsDone(true)
          if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current)

          // Auto-save file only after the visual typing is fully complete
          window.electron.ipcRenderer.invoke('save-deep-research-document', { 
            query: e.detail.query, 
            content: streamBufferRef.current,
            fileName: e.detail.fileName
          }).then((res: any) => {
            if (res.success) {
              setDisplayedText(prev => prev + `\n\n✅ *Document automatically saved to: ${res.path}*`)
            } else {
              setDisplayedText(prev => prev + `\n\n⚠️ *Could not save file: ${res.error}*`)
            }
          })
        }
      }, 15) // ~15ms per character creates a fast smooth typing effect
    }

    const handleStream = (_event: any, chunk: string) => {
      // Just push to buffer, let typewriter effect handle the display
      streamBufferRef.current += chunk
    }

    const handleDone = () => {
      isDoneStreamingRef.current = true
    }

    window.addEventListener('deep-research-writer-start', handleStart)
    window.electron.ipcRenderer.on('deep-research-writer-stream', handleStream)
    window.electron.ipcRenderer.on('deep-research-writer-done', handleDone)

    return () => {
      window.removeEventListener('deep-research-writer-start', handleStart)
      window.electron.ipcRenderer.removeAllListeners('deep-research-writer-stream')
      window.electron.ipcRenderer.removeAllListeners('deep-research-writer-done')
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current)
    }
  }, [])

  // Helper to slugify a string
  const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Basic markdown-to-html conversion for simple bolding and lists
  const parseContent = (text: string) => {
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')
    parsed = parsed.replace(/\*(.*?)\*/g, '<em class="text-cyan-100">$1</em>')
    parsed = parsed.replace(/```([\s\S]*?)```/g, '<pre class="bg-black/50 p-3 rounded text-sm text-green-400 my-2">$1</pre>')
    
    // Add IDs to standard headers
    parsed = parsed.replace(/^(#+)\s+(.+)$/gm, (match, hashes, content) => {
      const slug = slugify(content.trim())
      const size = hashes.length === 1 ? 'text-xl' : hashes.length === 2 ? 'text-lg' : 'text-base'
      return `<h3 id="${slug}" class="font-bold text-cyan-400 mt-5 mb-2 ${size}">${content}</h3>`
    })

    // Add IDs to underline headers (e.g. === or ---)
    parsed = parsed.replace(/^([A-Za-z0-9][^\n]+)\n(=+|-+)$/gm, (match, content) => {
      const slug = slugify(content.trim())
      const size = match.includes('=') ? 'text-xl' : 'text-lg'
      return `<h3 id="${slug}" class="font-bold text-cyan-400 mt-5 mb-2 ${size}">${content}</h3>`
    })

    return parsed
  }

  // Extract headings to form the Index points
  const extractPoints = (text: string) => {
    const lines = text.split(/\r?\n/)
    const points: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Standard markdown headers (#)
      if (line.startsWith('#')) {
        const clean = line.replace(/^#+\s*/, '').replace(/\*/g, '').trim()
        if (clean) points.push(clean)
        continue
      }
      
      // Underline headers (=== or ---)
      if (i + 1 < lines.length && line.length > 0) {
        const nextLine = lines[i + 1].trim()
        if (nextLine.length >= 3 && (nextLine.match(/^=+$/) || nextLine.match(/^-+$/))) {
          const clean = line.replace(/\*/g, '').trim()
          if (clean && !points.includes(clean)) points.push(clean)
        }
      }
    }
    return points
  }
  
  const extractedPoints = extractPoints(displayedText)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[700px] bg-black/85 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.9)] z-50 overflow-hidden flex flex-col font-sans"
        >
          {/* Header */}
          <div className="flex items-center p-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 to-transparent">
            {/* Left Header Area */}
            <div className="w-[30%] flex items-center gap-3 border-r border-white/10 pr-4">
              <Search className={`w-5 h-5 text-cyan-400 ${!isDone ? 'animate-pulse' : ''}`} />
              <h3 className="text-sm font-bold tracking-widest text-cyan-400 uppercase">
                {mode === 'high' ? 'High Deep Research' : 'Normal Research'}
              </h3>
            </div>
            
            {/* Right Header Area */}
            <div className="flex-1 flex items-center justify-between pl-6">
              <p className="text-sm text-gray-300 tracking-wide font-medium">
                {query}
              </p>
              
              <div className="flex items-center gap-3">
                {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
                {!isDone ? (
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest border border-red-500/30 px-3 py-1 rounded-full"
                  >
                    Terminate
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-widest border border-cyan-500/30 px-3 py-1 rounded-full"
                  >
                    Close Panel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2-Column Body */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Sidebar - Paragraph Points / Index */}
            <div className="w-[30%] border-r border-white/10 bg-black/40 p-5 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-4">
                <List className="w-4 h-4 text-gray-400" />
                <h4 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Document Index</h4>
              </div>
              
              {extractedPoints.length === 0 && !isDone && (
                <p className="text-xs text-gray-600 animate-pulse mt-4">Extracting key points...</p>
              )}
              
              <ul className="space-y-3 mt-4">
                {extractedPoints.map((point, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => {
                      const slug = slugify(point)
                      const el = document.getElementById(slug)
                      if (el && contentRef.current) {
                        contentRef.current.scrollTo({
                          top: el.offsetTop - 50,
                          behavior: 'smooth'
                        })
                      }
                    }}
                    className="text-xs text-cyan-100/70 border-l-2 border-cyan-500/30 pl-3 leading-relaxed cursor-pointer hover:text-cyan-300 hover:border-cyan-400 transition-colors"
                  >
                    {point}
                  </motion.li>
                ))}
              </ul>
            </div>
            
            {/* Right Main Area - Actual Text */}
            <div 
              ref={contentRef}
              className="flex-1 p-8 overflow-y-auto custom-scrollbar relative"
            >
              {!displayedText && !isDone && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                    <p className="text-sm text-cyan-500 tracking-widest uppercase animate-pulse">Synthesizing Data...</p>
                  </div>
                </div>
              )}
              
              {displayedText && (
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <FileText className="w-5 h-5 text-cyan-600/50" />
                  </div>
                  <div 
                    className="flex-1 text-gray-200 text-sm md:text-base leading-relaxed tracking-wide whitespace-pre-wrap font-sans"
                    dangerouslySetInnerHTML={{ __html: parseContent(displayedText) }}
                  />
                  {/* Blinking cursor effect while typing */}
                  {!isDone && displayedText && (
                    <motion.div 
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-block w-2 h-5 bg-cyan-400 translate-y-1 ml-1"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
