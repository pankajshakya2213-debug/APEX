import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RiImage2Line,
  RiDeleteBinLine,
  RiFolderOpenLine,
  RiCloseLine,
  RiMagicLine,
  RiFileWarningLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine
} from 'react-icons/ri'
import { motion, AnimatePresence } from 'framer-motion'

interface GalleryImage {
  filename: string
  displayName: string
  path: string
  url: string
  createdAt: Date
}

const GalleryView = () => {
  const [allImages, setAllImages] = useState<GalleryImage[]>([])
  const [visibleImages, setVisibleImages] = useState<GalleryImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)

  const [direction, setDirection] = useState(0)

  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 12
  const observer = useRef<IntersectionObserver | null>(null)

  const lastImageRef = useCallback(
    (node: HTMLDivElement) => {
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && visibleImages.length < allImages.length) {
          setPage((prev) => prev + 1)
        }
      })
      if (node) observer.current.observe(node)
    },
    [visibleImages.length, allImages.length]
  )

  const fetchGallery = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-gallery')
      if (Array.isArray(data)) setAllImages(data)
    } catch (e) {
    }
  }

  useEffect(() => {
    fetchGallery()
    const interval = setInterval(fetchGallery, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const endIndex = page * ITEMS_PER_PAGE
    setVisibleImages(allImages.slice(0, endIndex))
  }, [page, allImages])


  const deleteImage = async (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('delete-image', filename)

    if (selectedImage) {
      const currentIndex = allImages.findIndex((img) => img.filename === selectedImage.filename)
      const nextImage = allImages[currentIndex + 1] || allImages[currentIndex - 1]

      if (nextImage) {
        setSelectedImage(nextImage)
      } else {
        setSelectedImage(null)
      }
    }
    fetchGallery()
  }

  const openLocation = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('open-image-location', path)
  }

  const saveCopy = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('save-image-external', path)
  }


  const navigateImage = useCallback(
    (newDirection: number) => {
      if (!selectedImage || allImages.length === 0) return

      setDirection(newDirection)

      const currentIndex = allImages.findIndex((img) => img.filename === selectedImage.filename)
      if (currentIndex === -1) return

      let newIndex = currentIndex + newDirection

      if (newIndex >= allImages.length) newIndex = 0
      if (newIndex < 0) newIndex = allImages.length - 1

      setSelectedImage(allImages[newIndex])
    },
    [selectedImage, allImages]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return

      if (e.key === 'ArrowRight') navigateImage(1)
      if (e.key === 'ArrowLeft') navigateImage(-1)
      if (e.key === 'Escape') setSelectedImage(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, navigateImage])

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    })
  }

  return (
    <div className="flex-1 bg-[#090b0c] h-full relative overflow-hidden font-sans flex flex-col text-zinc-100">
      <div className="p-5 relative z-10 flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between shrink-0 rounded-xl border border-white/10 bg-[#101214] p-4 mb-5">
          <div className="flex items-center gap-3 text-zinc-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <RiImage2Line className="text-emerald-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Gallery</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Generated images</p>
            </div>
          </div>

          <div className="hidden text-xs font-medium text-zinc-300 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/10 items-center gap-2">
            <RiMagicLine size={14} className="text-emerald-400" /> {allImages.length} images
          </div>
        </div>

        <div className="absolute bottom-24 right-8 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-[#101214] px-4 py-3 text-xs font-medium text-zinc-300 shadow-xl">
          <RiMagicLine size={14} className="text-emerald-400" /> {allImages.length} images
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-small pr-2 min-h-0">
          {allImages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <RiImage2Line size={44} className="opacity-40" />
              <p className="text-sm">No images yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
              {visibleImages.map((img, index) => {
                const isLast = index === visibleImages.length - 1

                return (
                  <div
                    key={`${img.filename}-${index}`}
                    ref={isLast ? lastImageRef : null}
                    onClick={() => {
                      setDirection(0) 
                      setSelectedImage(img)
                    }}
                    className="group relative aspect-16/10 bg-black/40 rounded-xl border border-white/10 overflow-hidden hover:border-emerald-400/50 transition-colors cursor-pointer"
                  >
                    <img
                      src={img.url}
                      alt={img.displayName}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />

                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                      <p className="text-sm text-zinc-100 line-clamp-1 font-medium mb-1">
                        {img.displayName}
                      </p>
                      <p className="text-xs text-zinc-400 mb-4">
                        {new Date(img.createdAt).toLocaleDateString()} • SECURE_DATA
                      </p>

                      <div className="absolute right-3 top-3 flex gap-2">
                        <button
                          onClick={(e) => openLocation(img.path, e)}
                          className="p-2.5 bg-white/10 text-zinc-300 rounded-lg hover:bg-emerald-500 hover:text-black transition-colors border border-white/10"
                          title="Open location"
                        >
                          <RiFolderOpenLine size={14} />
                        </button>
                        <button
                          onClick={(e) => deleteImage(img.filename, e)}
                          className="p-2.5 bg-white/10 text-zinc-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors border border-white/10"
                          title="Delete image"
                        >
                          <RiDeleteBinLine size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 bg-black/90 flex items-center justify-center p-4 md:p-10"
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="cursor-pointer absolute top-8 right-8 p-3 bg-white/10 hover:bg-red-500/20 hover:text-red-300 rounded-lg text-zinc-300 transition-colors border border-white/10 z-50"
            >
              <RiCloseLine size={24} />
            </button>

            <div
              className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-40 flex items-center justify-start pl-8 group cursor-pointer"
              onClick={() => navigateImage(-1)}
            >
              <div className="p-4 bg-white/10 group-hover:bg-white/20 text-zinc-300 rounded-lg transition-colors border border-white/10">
                <RiArrowLeftSLine size={32} />
              </div>
            </div>

            <div
              className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-40 flex items-center justify-end pr-8 group cursor-pointer"
              onClick={() => navigateImage(1)}
            >
              <div className="p-4 bg-white/10 group-hover:bg-white/20 text-zinc-300 rounded-lg transition-colors border border-white/10">
                <RiArrowRightSLine size={32} />
              </div>
            </div>

            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-7xl h-full flex items-center justify-center">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.img
                    key={selectedImage.filename}
                    src={selectedImage.url}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: 'spring', stiffness: 300, damping: 35 },
                      opacity: { duration: 0.2 }
                    }}
                    className="max-w-full max-h-[80vh] rounded-xl shadow-2xl border border-white/10 object-contain bg-[#111315]"
                  />
                </AnimatePresence>
              </div>

              <div className="absolute left-10 bottom-10 z-50 max-w-md animate-in slide-in-from-bottom-10 duration-300">
                <div className="px-5 py-3 rounded-xl border border-white/10 bg-[#111315]/95">
                  <h3 className="text-base font-semibold text-white mb-1 truncate max-w-md">
                    {selectedImage.displayName}
                  </h3>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-zinc-500">
                      {new Date(selectedImage.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute right-10 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3">
                  <button
                    onClick={() => openLocation(selectedImage.path)}
                    className="cursor-pointer flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/15"
                  >
                    <RiFolderOpenLine size={16} /> Open Folder
                  </button>

                  <button
                    onClick={() => saveCopy(selectedImage.path)}
                    className="cursor-pointer flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-xs font-semibold text-black transition-colors hover:bg-emerald-400"
                  >
                    <RiDownloadLine size={16} /> Save Copy
                  </button>

                  <button
                    onClick={() => deleteImage(selectedImage.filename)}
                    className="cursor-pointer flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-5 py-3 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                  >
                    <RiDeleteBinLine size={16} /> Delete
                  </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GalleryView
