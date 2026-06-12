import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  RiStickyNoteLine,
  RiDeleteBinLine,
  RiFileTextLine,
  RiMarkdownLine,
  RiAddLine,
  RiSave3Line,
  RiCloseLine,
  RiEditLine 
} from 'react-icons/ri'

interface Note {
  filename: string
  title: string
  content: string
  createdAt: Date
}

const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    return !inline ? (
      <div className="bg-black/50 rounded-lg p-3 my-2 border border-white/10 font-mono text-xs overflow-x-auto">
        <code {...props}>{children}</code>
      </div>
    ) : (
      <code
        className="bg-white/10 px-1 py-0.5 rounded text-emerald-400 font-mono text-xs"
        {...props}
      >
        {children}
      </code>
    )
  }
}

const NotesView = ({ glassPanel }: { glassPanel?: string }) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editOriginalFilename, setEditOriginalFilename] = useState<string | null>(null)

  const fetchNotes = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-notes')
      setNotes(data)
    } catch (e) {
    }
  }

  useEffect(() => {
    fetchNotes()
    const interval = setInterval(fetchNotes, 3000) 
    return () => clearInterval(interval)
  }, [])


  const startCreating = () => {
    setSelectedNote(null)
    setEditOriginalFilename(null)
    setNewTitle('')
    setNewContent('')
    setIsEditorOpen(true)
  }

  const startEditing = () => {
    if (!selectedNote) return

    setEditOriginalFilename(selectedNote.filename)
    setNewTitle(selectedNote.title)

    const cleanContent = selectedNote.content.replace(/^# .+\n\n/, '')
    setNewContent(cleanContent)

    setIsEditorOpen(true)
  }

  const cancelEditor = () => {
    setIsEditorOpen(false)
    setEditOriginalFilename(null)
  }

  const saveManualNote = async () => {
    if (!newTitle.trim() || !newContent.trim()) return


    await window.electron.ipcRenderer.invoke('save-note', {
      title: newTitle,
      content: newContent
    })

    setIsEditorOpen(false)
    setEditOriginalFilename(null)
    fetchNotes()

    setTimeout(() => {
      window.electron.ipcRenderer.invoke('get-notes').then((data: Note[]) => {
        const created = data.find((n) =>
          n.title.toLowerCase().includes(newTitle.toLowerCase().replace(/ /g, '_'))
        )
        if (created) setSelectedNote(created)
      })
    }, 500)
  }

  const deleteNote = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electron.ipcRenderer.invoke('delete-note', filename)
    fetchNotes()
    if (selectedNote?.filename === filename) setSelectedNote(null)
  }

  return (
    <div className="flex h-full w-full bg-[#090b0c] relative overflow-hidden font-sans text-zinc-100">
      <button
        onClick={startCreating}
        className="absolute left-[calc(33.333333%+1.75rem)] bottom-24 z-20 flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black shadow-xl transition-colors hover:bg-emerald-400 active:scale-95"
        title="New note"
      >
        <RiAddLine size={18} /> New Note
      </button>
      <div className="w-full h-full grid grid-cols-12 gap-5 p-5 relative z-10">
        <div className="col-span-4 flex flex-col gap-4 h-full overflow-hidden rounded-xl border border-white/10 bg-[#101214] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-zinc-100">
              <RiStickyNoteLine className="text-emerald-400" />
              <span className="text-sm font-semibold">Notes</span>
            </div>

            <div className="flex items-center gap-3 pr-1">
              <span className="text-xs text-zinc-500">{notes.length} notes</span>
            </div>
          </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 library-scrollbar">
          {notes.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm mt-10">
              <p>No notes yet.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.filename}
                onClick={() => {
                  setIsEditorOpen(false)
                  setSelectedNote(note)
                }}
                className={`group p-4 rounded-lg transition-colors cursor-pointer flex items-center justify-between relative overflow-hidden border ${
                  selectedNote?.filename === note.filename && !isEditorOpen
                    ? 'bg-emerald-400/10 border-emerald-400/50'
                    : 'bg-[#151719] border-white/10 hover:bg-[#191d1f]'
                }`}
              >
                {selectedNote?.filename === note.filename && !isEditorOpen && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />
                )}

                <div className="overflow-hidden pl-2">
                  <h3
                    className={`text-sm font-medium truncate transition-colors ${selectedNote?.filename === note.filename && !isEditorOpen ? 'text-emerald-200' : 'text-zinc-200'}`}
                  >
                    {note.title.replace(/_/g, ' ')}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-zinc-500">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={(e) => deleteNote(note.filename, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-300 bg-white/[0.03] rounded-lg transition-all"
                  >
                    <RiDeleteBinLine size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className="col-span-8 flex flex-col overflow-hidden relative rounded-xl border border-white/10 bg-[#101214]"
      >
        {isEditorOpen ? (
          <div className="flex-1 flex flex-col p-6 relative z-10">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <input
                type="text"
                placeholder="Note title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-transparent border-none outline-none text-2xl font-semibold text-white placeholder-zinc-600 w-full"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={saveManualNote}
                  disabled={!newTitle || !newContent}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-40 active:scale-95"
                >
                  <RiSave3Line size={16} /> {editOriginalFilename ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={cancelEditor}
                  className="rounded-lg border border-white/10 p-2 text-zinc-500 transition-colors hover:text-white"
                >
                  <RiCloseLine size={22} />
                </button>
              </div>
            </div>

            <textarea
              placeholder="Write your note..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-black/20 outline-none resize-none text-sm text-zinc-200 placeholder-zinc-600 leading-relaxed p-4 scrollbar-small"
            />
          </div>
        ) : selectedNote ? (
          <>
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#121517]">
              <div className="flex items-center gap-3">
                <RiFileTextLine className="text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-100">
                  {selectedNote.title}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={startEditing}
                  className="text-zinc-500 hover:text-emerald-300 transition-colors"
                  title="Edit note"
                >
                  <RiEditLine size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 library-scrollbar bg-[#0b0d0e]">
              <div className="prose prose-invert prose-indigo max-w-none">
                <div className="text-zinc-300 leading-[1.8] font-medium">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {selectedNote.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer" onClick={startCreating}>
              <RiFileTextLine size={32} className="text-zinc-500" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-semibold text-zinc-400">
                Select a note
              </span>
              <span className="text-xs text-zinc-600">Choose a note from the list or create a new one.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)
}

export default NotesView
