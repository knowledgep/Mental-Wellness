import type { Chat } from '@google/genai';

export enum Page {
  Splash,
  Welcome,
  SignIn,
  SignUp,
  Home,
  Journal,
  VoiceLog,
  MoodScan,
  MoodTracker,
  Recommendations,
  Safety,
  SupportChat,
}

export type Mood = 'Happy' | 'Sad' | 'Neutral' | 'Anxious' | 'Calm' | 'Excited' | 'Tired' | 'Angry' | 'Content';

export interface MoodEntry {
  id: string;
  mood: Mood;
  emoji: string;
  date: Date;
  source: 'Journal' | 'Voice' | 'Facial';
  notes?: string;
}

export interface SpotifyPlaylist {
  title: string;
  description: string;
}

export interface YouTubeVideo {
  title: string;
  type: 'Meditation' | 'Funny';
}

export interface Recommendations {
  forMood: Mood;
  breathing: string[];
  journaling: string[];
  music: SpotifyPlaylist[];
  videos: YouTubeVideo[];
}


export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export interface AppContextType {
  currentPage: Page;
  navigate: (page: Page) => void;
  moodHistory: MoodEntry[];
  addMoodEntry: (entry: Omit<MoodEntry, 'id' | 'date'>) => void;
  user: { name: string };
  setUser: (user: { name: string }) => void;
  highDistressAlert: boolean;
  setHighDistressAlert: (isAlert: boolean) => void;
  chatHistory: ChatMessage[];
  sendMessage: (message: string) => Promise<void>;
  isAiTyping: boolean;
  initializeChat: () => void;
}