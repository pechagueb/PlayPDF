import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Square, Music, FileText, Loader2, Volume2, Guitar } from 'lucide-react';
import { motion } from 'motion/react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [instrument, setInstrument] = useState<InstrumentName>('acoustic_guitar_nylon');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const images = await pdfToImages(file);
      const parsedScore = await parseScoreFromImages(images);
      setScore(parsedScore);
    } catch (err: any) {
      console.error(err);
      setError('Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
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

      const beatDuration = 60 / score.bpm;
      
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
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div>
          <h1 className="font-serif italic text-2xl tracking-tight">TabReader AI</h1>
          <p className="text-[11px] uppercase tracking-widest opacity-50 font-mono">PDF to MIDI Transcription Engine</p>
        </div>
        <div className="flex gap-4 items-center">
          {score && (
            <div className="flex items-center gap-2 px-3 py-1 border border-[#141414] rounded-full text-xs font-mono">
              <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              {isPlaying ? 'PLAYING' : 'IDLE'}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="border border-[#141414] p-6 bg-white/50 backdrop-blur-sm">
            <h2 className="font-serif italic text-lg mb-4">01. Source Material</h2>
            <div className="space-y-4">
              <label className="block">
                <div className={cn(
                  "border-2 border-dashed border-[#141414]/20 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:border-[#141414]/50",
                  file && "border-solid border-[#141414] bg-white"
                )}>
                  <Upload className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm font-medium">{file ? file.name : 'Choose PDF Tab/Score'}</span>
                  <span className="text-[10px] uppercase opacity-40 mt-1">Max 10MB • PDF Only</span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </div>
              </label>
              
              <button
                onClick={processFile}
                disabled={!file || isProcessing}
                className="w-full py-3 bg-[#141414] text-[#E4E3E0] font-mono text-sm uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:invert transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Process Score
                  </>
                )}
              </button>
            </div>
            {error && <p className="text-red-500 text-[10px] mt-2 font-mono uppercase">{error}</p>}
          </section>

          <section className="border border-[#141414] p-6 bg-white/50 backdrop-blur-sm">
            <h2 className="font-serif italic text-lg mb-4">02. Playback Config</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst.value}
                    onClick={() => setInstrument(inst.value)}
                    className={cn(
                      "flex items-center gap-2 p-2 border border-[#141414]/10 text-[10px] uppercase font-mono transition-all",
                      instrument === inst.value ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-white"
                    )}
                  >
                    {inst.icon}
                    {inst.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Visualization & Data */}
        <div className="lg:col-span-8 space-y-8">
          <section className="border border-[#141414] bg-white min-h-[500px] flex flex-col">
            <div className="border-b border-[#141414] p-4 flex justify-between items-center bg-[#141414] text-[#E4E3E0]">
              <div className="flex items-center gap-4">
                <h2 className="font-serif italic text-lg">{score?.title || 'No Score Loaded'}</h2>
                {score && <span className="text-[10px] font-mono opacity-60">{score.bpm} BPM</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  disabled={!score}
                  className="p-2 hover:bg-white/20 rounded-full transition-all disabled:opacity-30"
                >
                  {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden p-8">
              {!score ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20">
                  <Music className="w-24 h-24 mb-4" />
                  <p className="font-mono text-sm uppercase tracking-widest">Awaiting Data Input</p>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Simple Note Visualization */}
                  <div className="flex-1 border border-[#141414]/10 relative overflow-x-auto">
                    <div 
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-10 transition-all duration-50 ease-linear"
                      style={{ left: `${(currentTime * 50)}px` }}
                    />
                    <div className="h-full min-w-[2000px] relative">
                      {score.notes.map((note, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.001 }}
                          className={cn(
                            "absolute h-4 rounded-sm border border-[#141414] flex items-center justify-center text-[8px] font-mono transition-colors",
                            currentTime >= note.time && currentTime <= note.time + note.duration 
                              ? "bg-[#141414] text-[#E4E3E0]" 
                              : "bg-white/50"
                          )}
                          style={{
                            left: `${note.time * 50}px`,
                            top: `${(72 - (note.pitch.charCodeAt(0) + (parseInt(note.pitch.slice(-1)) * 12))) * 8}px`,
                            width: `${note.duration * 50}px`,
                          }}
                        >
                          {note.pitch}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Data Grid View */}
                  <div className="mt-8 border-t border-[#141414]">
                    <div className="grid grid-cols-4 p-2 border-b border-[#141414] bg-[#141414]/5 text-[10px] font-mono uppercase opacity-50">
                      <span>Pitch</span>
                      <span>Time (Beats)</span>
                      <span>Duration</span>
                      <span>Status</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto font-mono text-[11px]">
                      {score.notes.slice(0, 50).map((note, idx) => (
                        <div key={idx} className={cn(
                          "grid grid-cols-4 p-2 border-b border-[#141414]/5 transition-colors",
                          currentTime >= note.time && currentTime <= note.time + note.duration && "bg-[#141414] text-[#E4E3E0]"
                        )}>
                          <span>{note.pitch}</span>
                          <span>{note.time.toFixed(2)}</span>
                          <span>{note.duration.toFixed(2)}</span>
                          <span className="text-[9px] opacity-50">
                            {currentTime > note.time + note.duration ? 'PAST' : currentTime > note.time ? 'ACTIVE' : 'PENDING'}
                          </span>
                        </div>
                      ))}
                      {score.notes.length > 50 && (
                        <div className="p-4 text-center text-[10px] opacity-40 uppercase">
                          + {score.notes.length - 50} more notes
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-[#141414] p-6 mt-12 flex justify-between items-center opacity-50 font-mono text-[10px] uppercase tracking-widest">
        <div>System Version: 1.0.4-Stable</div>
        <div>Powered by Gemini 3.1 Pro & Soundfont Engine</div>
        <div>© 2026 TabReader AI</div>
      </footer>
    </div>
  );
}
