import React, { useState, useEffect, useContext, createContext, useRef, useCallback, useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import type { Chat } from '@google/genai';
import { Page, MoodEntry, AppContextType, Mood, Recommendations, ChatMessage, SpotifyPlaylist, YouTubeVideo } from './types';
import { BrainIcon, DocumentIcon, TrendIcon, PersonalizedIcon, BackArrowIcon, MicIcon, CameraIcon, JournalIcon, MusicIcon, BreathingIcon, ShieldAlertIcon, PhoneIcon, ChatIcon, SendIcon, PieChartIcon, PlayIcon, StopIcon, SpotifyIcon, YouTubeIcon } from './constants';
import * as geminiService from './services/geminiService';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';


// --- CONTEXT --- //
const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// --- HELPER COMPONENTS --- //

const Layout: FC<{ children: ReactNode; title: string; showBackButton?: boolean }> = ({ children, title, showBackButton = true }) => {
  const { navigate } = useAppContext();
  return (
    <div className="p-6 h-full flex flex-col">
      <header className="flex items-center mb-6">
        {showBackButton && (
          <button onClick={() => navigate(Page.Home)} className="p-2 -ml-2 mr-2 rounded-full hover:bg-gray-200 transition-colors">
            <BackArrowIcon className="w-6 h-6 text-brand-text" />
          </button>
        )}
        <h1 className="text-3xl font-bold text-brand-text">{title}</h1>
      </header>
      <main className="flex-grow overflow-y-auto">{children}</main>
    </div>
  );
};

const RecentMoods: FC<{ data: MoodEntry[] }> = ({ data }) => {
    const recentEntries = data.slice(-5).reverse();

    if (recentEntries.length === 0) {
        return <div className="text-center py-4 text-brand-subtext">Log your mood to see your history here!</div>
    }

    return (
        <div className="space-y-3">
            {recentEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-brand-primary-light/50 rounded-lg">
                    <div className="flex items-center">
                        <span className="text-2xl mr-3">{entry.emoji}</span>
                        <div>
                            <p className="font-semibold text-brand-text">{entry.mood}</p>
                            <p className="text-xs text-brand-subtext">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - {entry.source}</p>
                        </div>
                    </div>
                    {entry.notes && <p className="text-sm text-brand-subtext italic text-right max-w-[50%] truncate">"{entry.notes}"</p>}
                </div>
            ))}
        </div>
    );
};

const FeatureCard: FC<{ icon: ReactNode, title: string, description: string, onClick: () => void, colorClass: string }> = ({ icon, title, description, onClick, colorClass }) => (
    <button onClick={onClick} className="bg-brand-card w-full p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow text-left flex items-center space-x-4">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-brand-text">{title}</h3>
            <p className="text-sm text-brand-subtext">{description}</p>
        </div>
    </button>
);


const moodToValue = (mood: Mood): number => {
    const mapping: Record<Mood, number> = {
        'Angry': 0,
        'Sad': 1,
        'Tired': 2,
        'Anxious': 3,
        'Neutral': 4,
        'Content': 5,
        'Calm': 6,
        'Excited': 7,
        'Happy': 8,
    };
    return mapping[mood] || 4;
};

const moodValueToEmoji = (value: number): string => {
    const emojiMap: { [key: number]: string } = {
        0: '😡',
        1: '😢',
        2: '😴',
        3: '😟',
        4: '😐',
        5: '😌',
        6: '🧘',
        7: '🤩',
        8: '😄',
    };
    return emojiMap[value] || '😐';
};


const MoodChart: FC<{ data: MoodEntry[] }> = ({ data }) => {
    const chartData = data.map(entry => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        moodValue: moodToValue(entry.mood),
        mood: entry.mood,
    }));

    if (chartData.length < 2) {
        return <div className="h-40 my-4 flex items-center justify-center text-center text-sm text-brand-subtext bg-gray-50 rounded-lg">Not enough data to draw a trend line.</div>;
    }

    return (
        <div className="h-40 my-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" fontSize={10} tick={{ fill: '#6B7280' }} />
              <YAxis
                domain={[0, 8]}
                ticks={[0, 4, 8]}
                tickFormatter={moodValueToEmoji}
                fontSize={14}
                tick={{ fill: '#6B7280' }}
              />
              <Tooltip
                  contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(5px)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  formatter={(value, name, props) => [props.payload.mood, 'Mood']}
              />
              <Line type="monotone" dataKey="moodValue" stroke="#8A3FFC" strokeWidth={2} dot={{ r: 4, fill: '#8A3FFC' }} activeDot={{ r: 6, fill: '#8A3FFC' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
    );
};


// --- PAGE COMPONENTS --- //

const SplashScreen = () => {
    const { navigate } = useAppContext();
    useEffect(() => {
        const timer = setTimeout(() => navigate(Page.Welcome), 2000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-full bg-brand-bg animate-fade-in">
            <div className="p-6 bg-brand-secondary-light rounded-full mb-4">
                <BrainIcon className="w-16 h-16 text-brand-secondary" />
            </div>
            <h1 className="text-3xl font-bold text-brand-text">MindWell</h1>
            <p className="text-brand-subtext mt-2">Smart Mental Wellness Assistant</p>
        </div>
    );
};

const WelcomeScreen = () => {
    const { navigate } = useAppContext();
    return (
        <div className="flex flex-col h-full p-8 text-center bg-brand-bg">
            <div className="flex-grow flex flex-col items-center justify-center">
                <h1 className="text-4xl font-bold text-brand-text mb-6">Welcome</h1>
                <div className="space-y-4 w-full max-w-sm text-left">
                    <div className="flex items-start space-x-4 p-4 bg-brand-card rounded-lg">
                        <DocumentIcon className="w-8 h-8 text-brand-primary mt-1" />
                        <div>
                            <h3 className="font-semibold text-brand-text">Track your mood</h3>
                            <p className="text-sm text-brand-subtext">Log your feelings through text, voice, or facial recognition.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-4 p-4 bg-brand-card rounded-lg">
                        <PersonalizedIcon className="w-8 h-8 text-brand-primary mt-1" />
                        <div>
                            <h3 className="font-semibold text-brand-text">Get personalized suggestions</h3>
                            <p className="text-sm text-brand-subtext">Receive AI-powered recommendations to support your well-being.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-4 p-4 bg-brand-card rounded-lg">
                        <TrendIcon className="w-8 h-8 text-brand-primary mt-1" />
                        <div>
                            <h3 className="font-semibold text-brand-text">View your mood trends</h3>
                            <p className="text-sm text-brand-subtext">Visualize your emotional patterns over time.</p>
                        </div>
                    </div>
                </div>
            </div>
            <button onClick={() => navigate(Page.SignIn)} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg">
                Continue
            </button>
        </div>
    );
};

const SignInScreen = () => {
    const { navigate } = useAppContext();
    return (
        <Layout title="Sign In" showBackButton={false}>
            <div className="flex flex-col h-full justify-center">
                <button onClick={() => navigate(Page.Home)} className="w-full bg-white border border-brand-border text-brand-text py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-gray-50 transition-colors shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.841 44 30.013 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                    <span>Sign in with Google</span>
                </button>
                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-brand-border"></div>
                    <span className="flex-shrink mx-4 text-brand-subtext">OR</span>
                    <div className="flex-grow border-t border-brand-border"></div>
                </div>
                <div className="space-y-4">
                    <input type="email" placeholder="Email" className="w-full p-3 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
                    <input type="password" placeholder="Password" className="w-full p-3 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
                </div>
                <button onClick={() => navigate(Page.Home)} className="mt-6 w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg">
                    Sign In
                </button>
                <p className="text-center mt-4 text-brand-subtext">Don't have an account? <button onClick={() => navigate(Page.SignUp)} className="font-semibold text-brand-primary hover:underline">Sign up</button></p>
            </div>
        </Layout>
    );
};

const SignUpScreen = () => {
    const { navigate, setUser } = useAppContext();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignUp = () => {
        setUser({ name: name.trim() || 'Friend' });
        navigate(Page.Home);
    };

    return (
        <Layout title="Sign Up" showBackButton={false}>
            <div className="flex flex-col h-full justify-center">
                <div className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="Name" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                    <input 
                        type="email" 
                        placeholder="Email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                <button 
                    onClick={handleSignUp} 
                    disabled={!email.trim() || !password.trim()}
                    className="mt-6 w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg disabled:bg-gray-400"
                >
                    Sign Up
                </button>
                <p className="text-center mt-4 text-brand-subtext">
                    Already have an account?{' '}
                    <button onClick={() => navigate(Page.SignIn)} className="font-semibold text-brand-primary hover:underline">
                        Sign In
                    </button>
                </p>
            </div>
        </Layout>
    );
};

const HomeScreen = () => {
    const { navigate, user, moodHistory, highDistressAlert } = useAppContext();
    const latestMood = moodHistory.length > 0 ? moodHistory[moodHistory.length - 1] : null;

    const SafetyAlertCard = () => (
        <div className="p-4 mb-6 bg-red-100 border border-red-300 rounded-2xl shadow-md text-red-800">
            <div className="flex items-center">
                <ShieldAlertIcon className="w-8 h-8 mr-3"/>
                <div>
                    <h3 className="font-bold">High Distress Detected</h3>
                    <p className="text-sm">We've noticed you might be struggling. Help is available.</p>
                </div>
            </div>
            <button 
                onClick={() => navigate(Page.Safety)} 
                className="mt-3 w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors">
                View Safety Options
            </button>
        </div>
    );

    return (
        <div className="p-6 h-full flex flex-col space-y-6 overflow-y-auto">
            <header>
                <h1 className="text-3xl font-bold text-brand-text">Hi, {user.name}!</h1>
                <p className="text-brand-subtext">How are you feeling today?</p>
            </header>

            {highDistressAlert && <SafetyAlertCard />}
            
            <div className="bg-brand-card p-4 rounded-2xl shadow-md">
                <h2 className="font-bold text-brand-text mb-2">Mood Summary</h2>
                 {latestMood ? (
                    <div className="flex items-center text-lg">
                        <span className="text-3xl mr-2">{latestMood.emoji}</span>
                        <span className="font-semibold text-brand-text">Feeling {latestMood.mood}</span>
                    </div>
                ) : (
                    <p className="text-sm text-brand-subtext">No moods logged yet.</p>
                )}
                
                <MoodChart data={moodHistory.slice(-10)} />

                <h3 className="font-bold text-brand-text mt-4 mb-2">Recent Entries</h3>
                <RecentMoods data={moodHistory} />
            </div>

            <button onClick={() => navigate(Page.Recommendations)} className="w-full p-4 bg-brand-primary-light text-brand-primary-dark font-bold rounded-xl text-left flex items-center justify-between hover:bg-cyan-100 transition-colors">
                <span>Try deep breathing now</span>
                <span className="text-2xl">&raquo;</span>
            </button>

            <div className="flex-grow space-y-4">
                <h2 className="font-bold text-brand-text text-lg">How can I help?</h2>
                <div className="space-y-3">
                    <FeatureCard icon={<ChatIcon className="w-6 h-6 text-brand-secondary" />} title="Support Chat" description="Talk with an AI assistant" onClick={() => navigate(Page.SupportChat)} colorClass="bg-brand-secondary-light" />
                    <FeatureCard icon={<PieChartIcon className="w-6 h-6 text-brand-secondary" />} title="Mood Tracker" description="View your mood stats" onClick={() => navigate(Page.MoodTracker)} colorClass="bg-brand-secondary-light" />
                    <FeatureCard icon={<JournalIcon className="w-6 h-6 text-brand-secondary" />} title="Journal" description="Write down your thoughts" onClick={() => navigate(Page.Journal)} colorClass="bg-brand-secondary-light" />
                    <FeatureCard icon={<MicIcon className="w-6 h-6 text-brand-secondary" />} title="Voice Log" description="Speak your mind" onClick={() => navigate(Page.VoiceLog)} colorClass="bg-brand-secondary-light" />
                    <FeatureCard icon={<CameraIcon className="w-6 h-6 text-brand-secondary" />} title="Mood Scan" description="Scan your facial expression" onClick={() => navigate(Page.MoodScan)} colorClass="bg-brand-secondary-light" />
                </div>
            </div>
        </div>
    );
};

const JournalScreen = () => {
    const { navigate, addMoodEntry } = useAppContext();
    const [entry, setEntry] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!entry.trim() || isLoading) return;
        setIsLoading(true);
        try {
            const result = await geminiService.analyzeTextMood(entry);
            addMoodEntry({ ...result, source: 'Journal' });
            navigate(Page.Home);
        } catch (error) {
            console.error(error);
            // You might want to show an error to the user here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout title="Journal">
            <div className="flex flex-col h-full">
                <label htmlFor="journal-entry" className="text-brand-subtext mb-2">How are you feeling today?</label>
                <textarea
                    id="journal-entry"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="Write about your day, your feelings, anything on your mind..."
                    className="w-full flex-grow p-4 border border-brand-border rounded-xl resize-none focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    rows={10}
                ></textarea>
                 <button onClick={handleSubmit} disabled={isLoading || !entry.trim()} className="mt-6 w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg disabled:bg-gray-400">
                    {isLoading ? 'Analyzing...' : 'Submit'}
                </button>
            </div>
        </Layout>
    );
};

const VoiceLogScreen = () => {
    const { navigate, addMoodEntry } = useAppContext();
    const { transcript, isListening, startListening, stopListening, isSupported, error } = useSpeechRecognition();
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!transcript.trim() || isLoading) return;
        setIsLoading(true);
        try {
            const result = await geminiService.analyzeTextMood(transcript);
            addMoodEntry({ ...result, source: 'Voice' });
            navigate(Page.Home);
        } catch (err) {
            console.error("Analysis failed", err);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Layout title="Voice Log">
            <div className="flex flex-col items-center justify-center h-full text-center">
                {!isSupported ? (
                     <p className="text-red-500">Speech recognition is not supported in your browser.</p>
                ) : (
                    <>
                        <div className="relative mb-8">
                            <button onClick={isListening ? stopListening : startListening} className="relative w-40 h-40 bg-brand-secondary-light rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-105">
                                <MicIcon className="w-16 h-16 text-brand-secondary"/>
                                {isListening && (
                                    <div className="absolute inset-0 rounded-full bg-brand-secondary opacity-50 animate-ping"></div>
                                )}
                            </button>
                        </div>
                        <p className="text-lg font-semibold text-brand-text mb-4">
                            {isListening ? "Listening..." : (transcript ? "Tap to record again" : "Tap to start recording")}
                        </p>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <div className="w-full p-4 bg-white rounded-lg min-h-[100px] text-brand-subtext text-left">
                            <p>{transcript || 'Your transcribed text will appear here.'}</p>
                        </div>
                         <button onClick={handleAnalyze} disabled={isLoading || !transcript.trim()} className="mt-6 w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg disabled:bg-gray-400">
                            {isLoading ? 'Analyzing...' : 'Analyze Mood'}
                        </button>
                    </>
                )}
            </div>
        </Layout>
    );
};

const MoodScanScreen = () => {
    const { navigate, addMoodEntry } = useAppContext();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [detectedMood, setDetectedMood] = useState<{emoji: string, mood: Mood} | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    
    useEffect(() => {
        const enableCamera = async () => {
            if (uploadedImage) {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                setError("Camera access is required. Please enable it in your browser settings.");
            }
        };

        enableCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [uploadedImage]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setError(null);
                setDetectedMood(null);
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleUseCameraClick = () => {
        setError(null);
        setDetectedMood(null);
        setUploadedImage(null);
    }

    const handleCaptureAndAnalyze = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setDetectedMood(null);
        setError(null);
        
        let base64Image: string | undefined;

        if (uploadedImage) {
            base64Image = uploadedImage.split(',')[1];
        } else {
            if (!videoRef.current || !canvasRef.current) {
                setError("Camera is not ready.");
                setIsLoading(false);
                return;
            }
            const video = videoRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                setError("Camera is not providing a valid image yet.");
                setIsLoading(false);
                return;
            }
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if(!context) {
                setError("Could not get canvas context");
                setIsLoading(false);
                return;
            }
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        }
        
        if (!base64Image) {
            setError("Could not get image data to analyze.");
            setIsLoading(false);
            return;
        }
        
        try {
            const result = await geminiService.analyzeImageMood(base64Image);
            setDetectedMood({ mood: result.mood, emoji: result.emoji });
            addMoodEntry({ ...result, source: 'Facial' });
        } catch (err) {
            console.error("Image analysis failed", err);
            setError("Could not analyze the image. Please try another one.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Layout title="Mood Scan">
            <div className="flex flex-col items-center text-center">
                <div className="relative w-full max-w-sm h-64 bg-gray-200 rounded-xl overflow-hidden shadow-inner mb-4">
                    {uploadedImage ? (
                        <img src={uploadedImage} alt="Uploaded preview" className="w-full h-full object-cover" />
                    ) : (
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    )}
                    
                    {!uploadedImage && error && (
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
                            <p className="text-white text-center">{error}</p>
                        </div>
                    )}
                    <div className="absolute inset-0 border-4 border-white/50 rounded-xl pointer-events-none"></div>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                />
                
                {detectedMood && (
                     <div className="my-4 p-4 bg-brand-secondary-light rounded-lg animate-fade-in">
                        <span className="text-4xl mr-2">{detectedMood.emoji}</span>
                        <span className="text-2xl font-bold text-brand-secondary">{detectedMood.mood}</span>
                    </div>
                )}
                
                {error && uploadedImage && <p className="text-red-500 text-sm my-2">{error}</p>}

                <button onClick={handleCaptureAndAnalyze} disabled={isLoading || (!uploadedImage && !!error)} className="mt-4 w-full max-w-sm bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg disabled:bg-gray-400">
                    {isLoading ? 'Analyzing...' : (uploadedImage ? 'Analyze Picture' : 'Scan My Mood')}
                </button>
                
                {uploadedImage ? (
                     <button onClick={handleUseCameraClick} className="mt-2 w-full max-w-sm text-brand-subtext py-2 rounded-xl hover:bg-gray-100">
                        Use Camera Instead
                    </button>
                ) : (
                    <button onClick={handleUploadClick} className="mt-2 w-full max-w-sm text-brand-subtext py-2 rounded-xl hover:bg-gray-100">
                        Upload a Picture
                    </button>
                )}

                <button onClick={() => navigate(Page.Home)} className="mt-2 w-full max-w-sm text-brand-subtext py-2 rounded-xl hover:bg-gray-100">
                    {detectedMood ? 'Done' : 'Skip'}
                </button>
            </div>
        </Layout>
    );
};


const MoodTrackerScreen = () => {
    const { moodHistory } = useAppContext();

    const now = new Date();
    
    const weekCutoff = new Date();
    weekCutoff.setDate(now.getDate() - 7);
    weekCutoff.setHours(0, 0, 0, 0);
    const weeklyMoods = moodHistory.filter(entry => new Date(entry.date) >= weekCutoff);

    const monthCutoff = new Date();
    monthCutoff.setDate(now.getDate() - 30);
    monthCutoff.setHours(0, 0, 0, 0);
    const monthlyMoods = moodHistory.filter(entry => new Date(entry.date) >= monthCutoff);
    
    const allTimeMoods = moodHistory;

    const StatsAndChartCard: FC<{ title: string, data: MoodEntry[] }> = ({ title, data }) => {
        const emotionStats = useMemo(() => {
            if (data.length === 0) return [];

            const counts = data.reduce((acc, entry) => {
                acc[entry.mood] = (acc[entry.mood] || 0) + 1;
                return acc;
            }, {} as Record<Mood, number>);
            
            const total = data.length;
            
            const emojiMap = moodHistory.reduce((acc, entry) => {
                if (!acc[entry.mood]) {
                    acc[entry.mood] = entry.emoji;
                }
                return acc;
            }, {} as Record<string, string>);

            return Object.entries(counts)
                .map(([mood, count]) => ({
                    mood: mood as Mood,
                    count,
                    percentage: Math.round((count / total) * 100),
                    emoji: emojiMap[mood] || '😐'
                }))
                .sort((a, b) => b.count - a.count);

        }, [data, moodHistory]);

        if (data.length === 0) {
            return (
                <div className="bg-brand-card p-4 rounded-xl shadow-sm">
                    <h2 className="text-xl font-bold text-brand-text mb-2">{title}</h2>
                    <div className="text-center py-6 text-brand-subtext">
                        <p>No mood data for this period.</p>
                    </div>
                </div>
            );
        }
        
        return (
             <div className="bg-brand-card p-4 rounded-xl shadow-sm">
                <h2 className="text-xl font-bold text-brand-text mb-3">{title}</h2>
                <h3 className="font-semibold text-brand-text mb-3">Emotion Breakdown</h3>
                <div className="space-y-3 mb-6">
                    {emotionStats.map(({ mood, percentage, emoji }) => (
                        <div key={mood}>
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="font-semibold text-brand-text flex items-center">{emoji} <span className="ml-2">{mood}</span></span>
                                <span className="text-brand-subtext">{percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-brand-secondary h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>

                <h3 className="font-semibold text-brand-text mb-3">Mood Trend</h3>
                <MoodChart data={data} />
            </div>
        );
    };

    return (
        <Layout title="Mood Tracker">
            {moodHistory.length > 0 ? (
                <div className="space-y-6">
                   <StatsAndChartCard title="Last 7 Days" data={weeklyMoods} />
                   <StatsAndChartCard title="Last 30 Days" data={monthlyMoods} />
                   <StatsAndChartCard title="All Time" data={allTimeMoods} />
                </div>
            ) : (
                <div className="text-center py-10 px-4 text-brand-subtext bg-brand-card rounded-xl shadow-sm">
                    <p className="text-lg font-semibold">No mood data yet.</p>
                    <p className="mt-2">Log your mood to start tracking your stats!</p>
                </div>
            )}
        </Layout>
    );
};

const RecommendationsScreen = () => {
    const { moodHistory } = useAppContext();
    const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

    const fetchRecommendations = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await geminiService.getRecommendations(moodHistory);
            setRecommendations(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [moodHistory]);
    
    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);
    
    useEffect(() => {
        // Cleanup speech on unmount
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    const handlePlayPause = (text: string) => {
        if (currentlyPlaying === text) {
            window.speechSynthesis.cancel();
            setCurrentlyPlaying(null);
        } else {
            window.speechSynthesis.cancel(); // Stop any other speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => {
                setCurrentlyPlaying(null);
            };
            utterance.onerror = () => {
                console.error("Speech synthesis error");
                setCurrentlyPlaying(null);
            }
            window.speechSynthesis.speak(utterance);
            setCurrentlyPlaying(text);
        }
    };

    const BreathingExerciseCard: FC<{ text: string }> = ({ text }) => {
        const isPlaying = currentlyPlaying === text;
        return (
            <div className="bg-brand-card p-4 rounded-xl shadow-sm flex items-center justify-between">
                <p className="text-brand-text flex-1 mr-4">{text}</p>
                <button
                    onClick={() => handlePlayPause(text)}
                    className="bg-brand-primary text-white rounded-full p-2 hover:bg-brand-primary-dark transition-colors"
                    aria-label={isPlaying ? 'Stop exercise' : 'Play exercise'}
                >
                    {isPlaying ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                </button>
            </div>
        );
    };
    
    const JournalPromptCard: FC<{ text: string }> = ({ text }) => (
        <div className="bg-brand-secondary-light p-4 rounded-xl shadow-sm text-center">
            <p className="text-brand-text font-semibold italic">“{text}”</p>
        </div>
    );

    const SpotifyPlaylistPreview: FC<{ playlist: SpotifyPlaylist }> = ({ playlist }) => (
        <a href={`https://open.spotify.com/search/${encodeURIComponent(playlist.title)}`} target="_blank" rel="noopener noreferrer" className="bg-[#1DB954]/10 p-4 rounded-xl shadow-sm flex items-center space-x-4 hover:bg-[#1DB954]/20 transition-colors">
            <div className="w-16 h-16 bg-gray-300 rounded-md flex-shrink-0 flex items-center justify-center">
                 <SpotifyIcon className="w-8 h-8 text-[#1DB954]" />
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-brand-text">{playlist.title}</h4>
                <p className="text-sm text-brand-subtext">{playlist.description}</p>
            </div>
        </a>
    );
    
    const YouTubeVideoPreview: FC<{ video: YouTubeVideo }> = ({ video }) => (
       <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`} target="_blank" rel="noopener noreferrer" className="bg-red-100 p-4 rounded-xl shadow-sm block hover:bg-red-200/70 transition-colors">
            <div className="w-full h-32 bg-gray-300 rounded-md mb-3 flex items-center justify-center">
                 <YouTubeIcon className="w-12 h-12 text-red-500" />
            </div>
            <h4 className="font-bold text-brand-text">{video.title}</h4>
            <p className="text-sm text-red-700 font-semibold">{video.type}</p>
        </a>
    );

    return (
        <Layout title="Recommendation Center">
            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            ) : recommendations ? (
                <div className="space-y-8">
                    <p className="text-center text-brand-subtext p-3 bg-brand-primary-light rounded-xl shadow-inner">
                        For when you're feeling <span className="font-bold text-brand-primary-dark">{recommendations.forMood.toLowerCase()}</span>, here are some ideas.
                    </p>
                    
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-brand-text mb-3">
                            <BreathingIcon className="w-6 h-6 text-brand-primary mr-2"/>
                            Breathing Exercises
                        </h3>
                        <div className="space-y-3">
                            {recommendations.breathing.map((item, index) => <BreathingExerciseCard key={index} text={item} />)}
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-brand-text mb-3">
                           <JournalIcon className="w-6 h-6 text-brand-secondary mr-2"/>
                            Journaling Prompts
                        </h3>
                        <div className="space-y-3">
                            {recommendations.journaling.map((item, index) => <JournalPromptCard key={index} text={item} />)}
                        </div>
                    </div>

                     <div>
                        <h3 className="flex items-center text-xl font-bold text-brand-text mb-3">
                           <MusicIcon className="w-6 h-6 text-green-500 mr-2"/>
                            Music Recommendations
                        </h3>
                        <div className="space-y-3">
                            {recommendations.music.map((item, index) => <SpotifyPlaylistPreview key={index} playlist={item} />)}
                        </div>
                    </div>

                    <div>
                        <h3 className="flex items-center text-xl font-bold text-brand-text mb-3">
                           <PlayIcon className="w-6 h-6 text-red-500 mr-2"/>
                            {recommendations.videos[0]?.type === 'Funny' ? 'Funny Videos' : 'Meditation Videos'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {recommendations.videos.map((item, index) => <YouTubeVideoPreview key={index} video={item} />)}
                        </div>
                    </div>

                </div>
            ) : (
                 <p className="text-center text-brand-subtext">Could not load recommendations. Please try again later.</p>
            )}
        </Layout>
    );
};

const SafetyScreen = () => {
    const { navigate, setHighDistressAlert } = useAppContext();

    const handleDismiss = () => {
        setHighDistressAlert(false);
        navigate(Page.Home);
    };

    return (
        <Layout title="Safety & Support">
            <div className="space-y-6 text-center">
                <p className="p-4 bg-yellow-100 text-yellow-800 rounded-lg shadow-inner">
                    We noticed you might be feeling distressed. Please know that support is available, and you are not alone.
                </p>

                <div className="bg-brand-card p-4 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg mb-2">Speak with a Counselor</h3>
                    <p className="text-brand-subtext mb-4">The 988 Suicide & Crisis Lifeline is a free, confidential service available 24/7.</p>
                    <a href="tel:988" className="w-full inline-flex items-center justify-center bg-brand-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-brand-primary-dark transition-colors shadow-lg">
                        <PhoneIcon className="w-5 h-5 mr-2" />
                        Call 988 Now
                    </a>
                </div>

                <div className="bg-brand-card p-4 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Emergency Contacts</h3>
                    <div className="space-y-3">
                         <div className="flex justify-between items-center">
                            <span className="text-brand-text">Family Member</span>
                            <a href="tel:123-456-7890" className="flex items-center text-brand-primary font-semibold hover:underline">
                                <PhoneIcon className="w-4 h-4 mr-1" /> Call
                            </a>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-brand-text">Close Friend</span>
                             <a href="tel:098-765-4321" className="flex items-center text-brand-primary font-semibold hover:underline">
                                <PhoneIcon className="w-4 h-4 mr-1" /> Call
                            </a>
                        </div>
                    </div>
                </div>

                <a href="tel:911" className="w-full inline-block bg-red-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors shadow-lg">
                    Call 911 for Immediate Emergency
                </a>

                <button onClick={handleDismiss} className="w-full text-brand-subtext py-2 mt-4 rounded-xl hover:bg-gray-100">
                    I'm okay for now, dismiss this.
                </button>
            </div>
        </Layout>
    );
};

const SupportChatScreen = () => {
    const { chatHistory, sendMessage, isAiTyping, initializeChat, navigate } = useAppContext();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        initializeChat();
    }, [initializeChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isAiTyping]);

    const handleSend = () => {
        if (input.trim()) {
            sendMessage(input.trim());
            setInput('');
        }
    };
    
    const handleQuickPick = (text: string) => {
        sendMessage(text);
    }

    const QuickPickButton: FC<{ text: string }> = ({ text }) => (
        <button
            onClick={() => handleQuickPick(text)}
            className="px-4 py-2 bg-brand-primary-light text-brand-primary-dark rounded-full text-sm font-semibold hover:bg-brand-primary/20 transition-colors"
        >
            {text}
        </button>
    );

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center p-4 border-b border-brand-border">
                <button onClick={() => navigate(Page.Home)} className="p-2 -ml-2 mr-2 rounded-full hover:bg-gray-200 transition-colors">
                    <BackArrowIcon className="w-6 h-6 text-brand-text" />
                </button>
                <h1 className="text-xl font-bold text-brand-text">Support Chat</h1>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-primary text-white rounded-br-lg' : 'bg-brand-card text-brand-text rounded-bl-lg'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isAiTyping && (
                    <div className="flex justify-start">
                         <div className="p-3 rounded-2xl bg-brand-card text-brand-text rounded-bl-lg">
                            <div className="flex items-center space-x-1">
                                <span className="w-2 h-2 bg-brand-subtext rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-brand-subtext rounded-full animate-bounce delay-150"></span>
                                <span className="w-2 h-2 bg-brand-subtext rounded-full animate-bounce delay-300"></span>
                            </div>
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </main>
            <footer className="p-4 border-t border-brand-border">
                {chatHistory.length <= 1 && (
                     <div className="flex flex-wrap gap-2 mb-3">
                        <QuickPickButton text="I'm feeling anxious" />
                        <QuickPickButton text="Suggest a breathing exercise" />
                        <QuickPickButton text="I want to journal" />
                    </div>
                )}
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your message..."
                        className="w-full p-3 border border-brand-border rounded-full focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                    <button onClick={handleSend} className="bg-brand-primary text-white rounded-full p-3 hover:bg-brand-primary-dark transition-colors shadow-md disabled:bg-gray-400" disabled={!input.trim()}>
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

// --- APP CONTAINER --- //

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Splash);
  const [user, setUser] = useState({ name: 'Alex' });
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [highDistressAlert, setHighDistressAlert] = useState(false);

  // Chat state
  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const navigate = (page: Page) => {
    setCurrentPage(page);
  };
  
  const addMoodEntry = (entry: Omit<MoodEntry, 'id' | 'date'>) => {
    const newEntry: MoodEntry = {
        ...entry,
        id: new Date().toISOString(),
        date: new Date(),
    };
    setMoodHistory(prev => [...prev, newEntry]);
    
    // Check for high distress moods
    if (['Sad', 'Angry', 'Anxious'].includes(newEntry.mood)) {
        setHighDistressAlert(true);
    }
  };

  const initializeChat = useCallback(() => {
    if (!chatSessionRef.current) {
        chatSessionRef.current = geminiService.startChatSession();
        setChatHistory([{ 
            id: 'init-1', 
            sender: 'ai', 
            text: "Hello! I'm your MindWell assistant. How can I support you right now?"
        }]);
    }
  }, []);

  const sendMessage = async (message: string) => {
    if (!chatSessionRef.current) return;

    const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: message
    };
    setChatHistory(prev => [...prev, userMessage]);
    setIsAiTyping(true);

    try {
        const response = await chatSessionRef.current.sendMessage({ message });
        const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: response.text.trim()
        };
        setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
        console.error("Chat error:", error);
         const errorMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: "I'm having a little trouble connecting right now. Please try again in a moment."
        };
        setChatHistory(prev => [...prev, errorMessage]);
    } finally {
        setIsAiTyping(false);
    }
  };


  const contextValue: AppContextType = {
    currentPage,
    navigate,
    user,
    setUser,
    moodHistory,
    addMoodEntry,
    highDistressAlert,
    setHighDistressAlert,
    chatHistory,
    sendMessage,
    isAiTyping,
    initializeChat,
  };

  const renderPage = () => {
    switch (currentPage) {
      case Page.Splash: return <SplashScreen />;
      case Page.Welcome: return <WelcomeScreen />;
      case Page.SignIn: return <SignInScreen />;
      case Page.SignUp: return <SignUpScreen />;
      case Page.Home: return <HomeScreen />;
      case Page.Journal: return <JournalScreen />;
      case Page.VoiceLog: return <VoiceLogScreen />;
      case Page.MoodScan: return <MoodScanScreen />;
      case Page.MoodTracker: return <MoodTrackerScreen />;
      case Page.Recommendations: return <RecommendationsScreen />;
      case Page.Safety: return <SafetyScreen />;
      case Page.SupportChat: return <SupportChatScreen />;
      default: return <SplashScreen />;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="max-w-md mx-auto h-screen bg-brand-bg shadow-2xl font-sans">
        {renderPage()}
      </div>
    </AppContext.Provider>
  );
};

export default App;