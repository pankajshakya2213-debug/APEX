import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles, RefreshCw, ListChecks } from 'lucide-react';

const UpdateNotification = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [versionInfo, setVersionInfo] = useState<any>(null);

    const releaseNotes = useMemo(() => {
        const notes = versionInfo?.releaseNotes;
        if (!notes) return [];

        if (Array.isArray(notes)) {
            return notes
                .map((item) => {
                    if (typeof item === 'string') return item;
                    return item?.note || item?.description || item?.version || '';
                })
                .filter(Boolean)
                .flatMap((item) => item.split(/\r?\n/));
        }

        if (typeof notes === 'string') {
            return notes.split(/\r?\n/);
        }

        return [];
    }, [versionInfo]);

    const cleanNotes = releaseNotes
        .map((line) => line.replace(/^[-*#\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 6);

    useEffect(() => {
        // @ts-ignore
        if (window.electron && window.electron.ipcRenderer) {
            // @ts-ignore
            window.electron.ipcRenderer.onUpdateAvailable((_event, info) => {
                setVersionInfo(info);
                setUpdateAvailable(true);
            });

            // @ts-ignore
            window.electron.ipcRenderer.onDownloadProgress((_event, percent) => {
                setDownloading(true);
                setProgress(percent);
            });

            // @ts-ignore
            window.electron.ipcRenderer.onUpdateDownloaded(() => {
                setCompleted(true);
                setDownloading(false);
            });
        }
    }, []);

    const handleDownload = () => {
        // @ts-ignore
        window.electron.ipcRenderer.startDownload();
        setDownloading(true);
    };

    const handleRestart = () => {
        // @ts-ignore
        window.electron.ipcRenderer.restartApp();
    };

    const closePopup = () => {
        setUpdateAvailable(false);
    };

    return (
        <AnimatePresence>
            {updateAvailable && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed bottom-8 right-8 z-[9999] w-96 max-w-[calc(100vw-2rem)] overflow-hidden"
                >
                    <div className="relative rounded-2xl border border-white/10 bg-[#0d1110]/95 p-5 shadow-2xl backdrop-blur-2xl">
                        <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-cyan-500/10 blur-3xl" />
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-400/20">
                                    <Sparkles className="w-5 h-5 text-cyan-400" />
                                </div>
                                {!downloading && !completed && (
                                    <button 
                                        onClick={closePopup}
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-4 h-4 text-white/40" />
                                    </button>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1">
                                APEX Update Available
                            </h3>
                            <p className="text-sm text-white/60">
                                Version {versionInfo?.version || 'New'} is ready.
                            </p>

                            <div className="my-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                                    <ListChecks className="h-4 w-4" />
                                    What changed
                                </div>
                                {cleanNotes.length > 0 ? (
                                    <ul className="space-y-2 text-sm leading-relaxed text-zinc-300">
                                        {cleanNotes.map((note, index) => (
                                            <li key={`${note}-${index}`} className="flex gap-2">
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                                                <span>{note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm leading-relaxed text-zinc-400">
                                        Stability improvements, fixes, and new APEX enhancements are included in this release.
                                    </p>
                                )}
                            </div>

                            {!downloading && !completed && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Update Now
                                    </button>
                                    <button
                                        onClick={closePopup}
                                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                                    >
                                        Later
                                    </button>
                                </div>
                            )}

                            {downloading && (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-cyan-400 animate-pulse">Downloading...</span>
                                        <span className="text-white/40">{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-cyan-500" 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {completed && (
                                <button
                                    onClick={handleRestart}
                                    className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Restart to Apply
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UpdateNotification;
