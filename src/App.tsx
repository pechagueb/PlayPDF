import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Square, Music, FileText, Loader2, Volume2, Guitar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Soundfont from 'soundfont-player';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { pdfToImages } from './utils/pdf';
import { parseScoreFromImages } from './services/gemini';
import { Score, InstrumentName } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INSTRUMENTS: { label: string; value: InstrumentName; icon: React.ReactNode }[] = [
  { label: 'Acoustic Piano', value: 'acoustic_grand_piano', icon: <Music className="w-4 h-4" /> },
  { label: 'Nylon Guitar', value: 'acoustic_guitar_nylon', icon: <Guitar className="w-4 h-4" /> },
  { label: 'Steel Guitar', value: 'acoustic_guitar_steel', icon: <Guitar className="w-4 h-4" /> },
  { label: 'Clean Electric', value: 'electric_guitar_clean', icon: <Guitar className="w-4 h-4" /> },
  { label: 'Distortion Guitar', value: 'distortion_guitar', icon: <Guitar className="w-4 h-4" /> },
  { label: 'Electric Bass', value: 'electric_bass_finger', icon: <Volume2 className="w-4 h-4" /> },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [instrument, setInstrument] = useState<InstrumentName>('acoustic_guitar_nylon');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<any>(null);
  const playbackTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setScore(null);
      setPdfImages([]);
      setError(null);
      
      try {
        const images = await pdfToImages(selectedFile);
        setPdfImages(images);
      } catch (err) {
        setError('Failed to load PDF preview.');
      }
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const processFile = async () => {
    if (!file || pdfImages.length === 0) return;
    setIsProcessing(true);
    setAnalysisProgress(0);
    setError(null);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      const parsedScore = await parseScoreFromImages(pdfImages);
      setScore(parsedScore);
      setTempo(parsedScore.bpm || 120);
      setAnalysisProgress(100);
    } catch (err: any) {
      console.error(err);
      setError('Failed to process PDF. Please try again.');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const stopPlayback = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    playbackTimeoutRef.current.forEach(clearTimeout);
    playbackTimeoutRef.current = [];
    if (playerRef.current) {
      playerRef.current.stop();
    }
    setCurrentTime(0);
  };

  const startPlayback = async () => {
    if (!score) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    startTimeRef.current = audioContextRef.current.currentTime;

    try {
      const player = await Soundfont.instrument(audioContextRef.current, instrument);
      playerRef.current = player;

      const beatDuration = 60 / tempo;
      
      score.notes.forEach((note) => {
        const timeout = setTimeout(() => {
          if (!isPlayingRef.current) return;
          player.play(note.pitch, audioContextRef.current!.currentTime, {
            duration: note.duration * beatDuration,
          });
        }, note.time * beatDuration * 1000);
        
        playbackTimeoutRef.current.push(timeout);
      });

      // Track progress
      const progressInterval = setInterval(() => {
        if (!isPlayingRef.current) {
          clearInterval(progressInterval);
          return;
        }
        const elapsed = (audioContextRef.current!.currentTime - startTimeRef.current) / beatDuration;
        setCurrentTime(elapsed);
        
        const lastNote = score.notes[score.notes.length - 1];
        if (elapsed > (lastNote.time + lastNote.duration + 1)) {
          stopPlayback();
          clearInterval(progressInterval);
        }
      }, 50);

    } catch (err) {
      console.error('Playback error:', err);
      stopPlayback();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <Music className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">PlayPDF</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">AI Music Transcription</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-6 w-full sm:w-auto">
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm shrink-0">
              <Volume2 className="w-3 h-3" />
              TEMPO
            </button>
            <div className="flex flex-col min-w-[100px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">Setting</span>
                <span className="text-xs font-mono font-bold text-indigo-600">{tempo} BPM</span>
              </div>
              <input 
                type="range" 
                min="60" 
                max="180" 
                value={tempo} 
                onChange={(e) => setTempo(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-slate-400">Status</span>
              <span className={cn(
                "text-xs font-bold flex items-center gap-1.5",
                isPlaying ? "text-emerald-600" : (score ? "text-slate-500" : "text-slate-300")
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-emerald-500 animate-pulse" : (score ? "bg-slate-400" : "bg-slate-200"))} />
                {isPlaying ? 'PLAYING' : (score ? 'READY' : 'IDLE')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSwapped(!isSwapped)}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              title="Swap Panels"
            >
              <motion.div 
                animate={{ rotate: isSwapped ? 180 : 0 }}
                className="flex items-center -space-x-1"
              >
                <div className="w-3 h-3 border border-slate-400 rounded-sm bg-slate-100" />
                <div className="w-3 h-3 border border-slate-400 rounded-sm bg-indigo-100" />
              </motion.div>
              Swap
            </motion.button>
            
            <label className="cursor-pointer group">
              <div className="bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 px-4 lg:px-6 py-2 rounded-2xl transition-all flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600 truncate max-w-[120px] lg:max-w-none">
                  {file ? file.name : 'Upload PDF'}
                </span>
              </div>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
            </label>
          </div>
        </div>
      </header>

      <main className={cn(
        "flex-1 flex flex-col lg:flex-row overflow-hidden relative",
        isSwapped && "lg:flex-row-reverse"
      )}>
        {/* Progress Overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-0 z-[100] bg-white/90 backdrop-blur-md flex items-start justify-center p-4 lg:p-8 border-b border-indigo-100 shadow-xl"
            >
              <div className="max-w-2xl w-full flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
                <div className="relative w-16 h-16 shrink-0">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-indigo-100 rounded-full"
                  />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-t-indigo-600 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
                
                <div className="flex-1 w-full space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-slate-900 leading-none mb-1">AI Analysis in Progress</h2>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Transcribing notes & timing</p>
                    </div>
                    <span className="text-xl font-mono font-bold text-indigo-600">{Math.round(analysisProgress)}%</span>
                  </div>

                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${analysisProgress}%` }}
                      className="absolute inset-y-0 left-0 bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* PDF Viewer */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-200/30 border-b lg:border-b-0 lg:border-r border-slate-200 order-2 lg:order-none">
          <div className="max-w-4xl mx-auto space-y-4 lg:space-y-8">
            {pdfImages.length > 0 ? (
              pdfImages.map((img, idx) => (
                <div key={idx} className="bg-white rounded-2xl lg:rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-200">
                  <div className="bg-slate-50 px-4 lg:px-6 py-2 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page {idx + 1}</span>
                  </div>
                  <img src={`data:image/png;base64,${img}`} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                </div>
              ))
            ) : (
              <div className="h-[40vh] lg:h-[80vh] flex flex-col items-center justify-center text-slate-400 border-4 border-dashed border-slate-200 rounded-2xl lg:rounded-[40px] p-8 text-center">
                <FileText className="w-12 lg:w-20 h-12 lg:h-20 mb-4 opacity-20" />
                <p className="font-semibold text-base lg:text-lg">Upload a PDF to see the score</p>
                <p className="text-xs lg:text-sm opacity-60">Guitar tabs or sheet music supported</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls & Player */}
        <div className={cn(
          "w-full lg:w-[450px] bg-white flex flex-col shadow-2xl z-10 order-1 lg:order-none",
          isSwapped ? "lg:border-r border-slate-200" : "lg:border-l border-slate-200"
        )}>
          <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 flex-1 overflow-y-auto">
            {/* Instrument Selection */}
            <section>
              <h3 className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">01. Select Instrument</h3>
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst.value}
                    onClick={() => setInstrument(inst.value)}
                    className={cn(
                      "flex flex-col items-start gap-2 p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 transition-all text-left",
                      instrument === inst.value 
                        ? "border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50" 
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-6 lg:w-8 h-6 lg:h-8 rounded-lg flex items-center justify-center",
                      instrument === inst.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {React.cloneElement(inst.icon as React.ReactElement, { className: "w-3 lg:w-4 h-3 lg:h-4" })}
                    </div>
                    <span className={cn(
                      "text-[9px] lg:text-[11px] font-bold uppercase tracking-tight",
                      instrument === inst.value ? "text-indigo-900" : "text-slate-600"
                    )}>
                      {inst.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* AI Action */}
            <section>
              <h3 className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">02. AI Transcription</h3>
              <button
                onClick={processFile}
                disabled={!file || isProcessing}
                className={cn(
                  "w-full py-3 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg",
                  isProcessing 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]"
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 lg:w-5 h-4 lg:h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Music className="w-4 lg:w-5 h-4 lg:h-5" />
                    Transcribe
                  </>
                )}
              </button>
              {error && <p className="text-rose-500 text-[9px] lg:text-[10px] mt-3 font-bold uppercase text-center">{error}</p>}
            </section>

            {/* Playback & Visualization */}
            <section className="flex-1 flex flex-col min-h-0">
              <h3 className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">03. Playback & Data</h3>
              <div className="flex-1 bg-slate-900 rounded-2xl lg:rounded-[32px] p-4 lg:p-6 flex flex-col shadow-inner overflow-hidden relative min-h-[300px]">
                {!score ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                    <Volume2 className="w-10 lg:w-12 h-10 lg:h-12 mb-2 opacity-20" />
                    <p className="text-[9px] lg:text-[10px] font-bold uppercase tracking-widest">Awaiting Transcription</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Compact Player Controls */}
                    <div className="flex items-center justify-between mb-4 lg:mb-6">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-xs lg:text-sm truncate max-w-[120px] lg:max-w-[150px]">{score.title}</span>
                        <span className="text-[8px] lg:text-[9px] text-slate-500 font-mono uppercase">{score.notes.length} Notes</span>
                      </div>
                      <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-10 lg:w-12 h-10 lg:h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
                      >
                        {isPlaying ? <Square className="w-4 lg:w-5 h-4 lg:h-5 text-slate-900 fill-current" /> : <Play className="w-4 lg:w-5 h-4 lg:h-5 text-slate-900 fill-current ml-1" />}
                      </button>
                    </div>

                    {/* Compact Visualizer */}
                    <div className="flex-1 bg-slate-800/50 rounded-xl lg:rounded-2xl border border-white/5 overflow-hidden relative mb-4">
                      <div 
                        className="absolute top-0 bottom-0 w-px bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] z-10"
                        style={{ left: '50%' }}
                      />
                      <div className="h-full relative overflow-hidden">
                        {score.notes.map((note, idx) => {
                          const xPos = 50 + (note.time - currentTime) * 100;
                          if (xPos < -100 || xPos > 500) return null;
                          return (
                            <motion.div
                              key={idx}
                              className={cn(
                                "absolute h-1.5 lg:h-2 rounded-full border transition-all duration-200",
                                currentTime >= note.time && currentTime <= note.time + note.duration 
                                  ? "bg-indigo-400 border-indigo-300 shadow-[0_0_15px_rgba(129,140,248,0.5)]" 
                                  : "bg-slate-700 border-slate-600 opacity-40"
                              )}
                              style={{
                                left: `${xPos}px`,
                                top: `${(72 - (note.pitch.charCodeAt(0) + (parseInt(note.pitch.slice(-1)) * 12))) * 3 + 80}px`,
                                width: `${note.duration * 100}px`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Mini Data Feed */}
                    <div className="h-20 lg:h-24 bg-black/20 rounded-xl p-3 font-mono text-[8px] lg:text-[9px] overflow-y-auto space-y-1 custom-scrollbar">
                      {score.notes.map((note, idx) => (
                        <div key={idx} className={cn(
                          "flex justify-between px-2 py-1 rounded transition-colors",
                          currentTime >= note.time && currentTime <= note.time + note.duration 
                            ? "bg-indigo-500/20 text-indigo-300" 
                            : "text-slate-600"
                        )}>
                          <span>{note.pitch}</span>
                          <span>T: {note.time.toFixed(2)}</span>
                          <span>D: {note.duration.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <footer className="p-6 lg:p-8 border-t border-slate-100 bg-slate-50/50">
            <div className="flex justify-between items-center opacity-40 font-bold text-[8px] lg:text-[9px] uppercase tracking-widest text-slate-500">
              <span>v1.3.0-Responsive</span>
              <span>© 2026 PlayPDF</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
