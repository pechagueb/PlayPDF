export interface Note {
  pitch: string;
  time: number;
  duration: number;
  velocity?: number;
}

export interface Score {
  title: string;
  bpm: number;
  notes: Note[];
}

export type InstrumentName = 
  | 'acoustic_grand_piano'
  | 'acoustic_guitar_nylon'
  | 'acoustic_guitar_steel'
  | 'electric_guitar_jazz'
  | 'electric_guitar_clean'
  | 'distortion_guitar'
  | 'electric_bass_finger';
