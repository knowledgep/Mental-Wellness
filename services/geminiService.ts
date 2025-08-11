import { GoogleGenAI, GenerateContentResponse, Type, Chat } from "@google/genai";
import { MoodEntry, Mood, Recommendations, SpotifyPlaylist, YouTubeVideo } from './types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const textModel = 'gemini-2.5-flash';
const visionModel = 'gemini-2.5-flash'; // Flash model supports images

export const startChatSession = (): Chat => {
    const chat = ai.chats.create({
        model: textModel,
        config: {
            systemInstruction: "You are MindWell, a friendly and empathetic AI wellness assistant. Your goal is to provide a safe space for users to express their feelings. Offer supportive words, calming suggestions like breathing exercises or journaling prompts, and be a good listener. If a user asks for music, suggest a type of relaxing music. If they ask to journal, encourage them and perhaps offer a prompt. Keep your responses concise and gentle."
        }
    });
    return chat;
};


export const analyzeTextMood = async (text: string): Promise<{ mood: Mood, emoji: string, notes: string }> => {
  const prompt = `Analyze the mood from the following journal entry and provide a brief, gentle, one-sentence summary of its feeling. Entry: "${text}"`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: { 
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emoji: { 
              type: Type.STRING,
              description: "A single emoji representing the mood."
            },
            mood: {
              type: Type.STRING,
              description: "A one-word mood descriptor.",
              enum: ['Happy', 'Sad', 'Neutral', 'Anxious', 'Calm', 'Excited', 'Tired', 'Angry', 'Content']
            },
            notes: {
              type: Type.STRING,
              description: "A brief, gentle, one-sentence summary of the entry's feeling."
            }
          },
          required: ["emoji", "mood", "notes"]
        }
      }
    });
    const resultJson = JSON.parse(response.text.trim());
    return resultJson as { mood: Mood, emoji: string, notes: string };

  } catch (error) {
    console.error("Error analyzing text mood:", error);
    return { mood: 'Neutral', emoji: '😐', notes: 'Could not analyze mood.' };
  }
};

export const analyzeImageMood = async (base64Image: string): Promise<{ mood: Mood, emoji: string, notes: string }> => {
  const prompt = `Analyze the dominant mood of the person in this image.`;
  
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Image,
    },
  };
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: visionModel,
        contents: { parts: [{text: prompt}, imagePart] },
        config: { 
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    emoji: {
                        type: Type.STRING,
                        description: "A single emoji representing the dominant mood."
                    },
                    mood: {
                        type: Type.STRING,
                        description: "A one-word mood descriptor.",
                        enum: ['Happy', 'Sad', 'Neutral', 'Anxious', 'Calm', 'Excited', 'Tired', 'Angry', 'Content']
                    }
                },
                required: ["emoji", "mood"]
            }
        }
    });
    const resultJson = JSON.parse(response.text.trim());
    if (resultJson.mood && resultJson.emoji) {
        return { mood: resultJson.mood as Mood, emoji: resultJson.emoji, notes: `Detected a ${resultJson.mood.toLowerCase()} expression.` };
    }
    throw new Error('Invalid JSON response format from API for image analysis.');
  } catch (error) {
    console.error("Error analyzing image mood:", error);
    return { mood: 'Neutral', emoji: '😐', notes: 'Could not determine mood from image.' };
  }
};

const defaultRecommendations: Recommendations = {
  forMood: 'Neutral',
  breathing: ["Take 5 deep breaths.", "Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.", "Focus on your breath for one minute."],
  journaling: ["What is one thing you are grateful for today?", "Describe a small moment of joy you experienced.", "What is something you can let go of?"],
  music: [{ title: 'Acoustic Calm', description: 'Gentle instrumental guitar to soothe your mind.' }, { title: 'Lofi Beats', description: 'Relaxing hip hop beats for focus and chill.' }],
  videos: [{ title: '5-Minute Guided Meditation for Beginners', type: 'Meditation' }, { title: 'Peaceful Forest Stream Sounds', type: 'Meditation' }]
};

export const getRecommendations = async (moodHistory: MoodEntry[]): Promise<Recommendations> => {
  const latestEntry = moodHistory.length > 0 ? moodHistory[moodHistory.length - 1] : null;
  const latestMood = latestEntry?.mood || 'Neutral';

  if (moodHistory.length === 0) {
    console.log("No mood history, returning default recommendations.");
    return defaultRecommendations;
  }
  
  const videoType = ['Sad', 'Anxious', 'Angry', 'Tired'].includes(latestMood) ? 'Meditation' : 'Funny';

  const prompt = `You are a caring and empathetic mental wellness assistant. The user's most recent mood is '${latestMood}'.
  Based on this mood, provide supportive recommendations in JSON format.
  - Suggest 3 simple, calming breathing exercises.
  - Suggest 3 gentle journaling prompts relevant to the mood.
  - Suggest 2 music playlists. For each, provide a catchy title and a short, one-sentence description, like a Spotify playlist.
  - Suggest 2 ${videoType} video ideas. For each, provide a short, clickable title, like a YouTube video.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    breathing: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of 3 short, actionable breathing exercises."
                    },
                    journaling: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of 3 insightful journaling prompts tailored to the mood."
                    },
                    music: {
                        type: Type.ARRAY,
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING, description: "Catchy title for a music playlist." },
                                description: { type: Type.STRING, description: "A short, one-sentence description for the playlist." }
                            },
                            required: ["title", "description"]
                        },
                        description: "List of 2 music playlist recommendations."
                    },
                    videos: {
                        type: Type.ARRAY,
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING, description: "A short, clickable title for a video." },
                                type: { type: Type.STRING, enum: ['Meditation', 'Funny'], description: "The type of video." }
                            },
                             required: ["title", "type"]
                        },
                        description: `List of 2 ${videoType} video recommendations.`
                    }
                },
                required: ["breathing", "journaling", "music", "videos"]
            }
        }
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    return { ...parsed, forMood: latestMood } as Recommendations;
    
  } catch (error) {
    console.error("Error getting recommendations:", error);
    // Return mood-specific fallback
    const fallback = { ...defaultRecommendations, forMood: latestMood };
    
    switch (latestMood) {
        case 'Sad':
            fallback.journaling = ["What's one small thing that could bring you comfort right now?", "Write a letter to your sadness, what would you say?", "Recall a memory that once made you happy."];
            fallback.music = [{ title: 'Hopeful Ambient', description: 'Gentle soundscapes to lift your spirits.' }, { title: 'Comforting Classics', description: 'Familiar, soothing classical pieces.' }];
            fallback.videos = [{ title: '10-Min Meditation for Sadness', type: 'Meditation' }, { title: 'Guided Visualization: Your Safe Place', type: 'Meditation' }];
            break;
        case 'Anxious':
            fallback.journaling = ["What is within my control right now?", "List 5 things you can see, 4 you can touch, 3 you can hear.", "Write down your worries and then physically close the book on them."];
            fallback.music = [{ title: 'Binaural Beats for Anxiety', description: 'Frequencies designed to calm the mind.' }, { title: 'Nature Sounds: Rain on a Window', description: 'The soothing sound of gentle rain.' }];
            fallback.videos = [{ title: 'Body Scan Meditation for Anxiety', type: 'Meditation' }, { title: 'Guided Breathing for Panic Attacks', type: 'Meditation' }];
            break;
        case 'Angry':
            fallback.journaling = ["What is the root cause of this anger?", "Write down everything you want to scream, then tear up the paper.", "What is a productive action I can take with this energy?"];
            fallback.music = [{ title: 'Power Rock Anthems', description: 'High-energy tracks to release tension.' }, { title: 'Intense Classical', description: 'Dramatic orchestral pieces to match your intensity.' }];
            fallback.videos = [{ title: 'Walking Meditation to Release Anger', type: 'Meditation' }, { title: 'Try This When You Feel Angry (Guided Practice)', type: 'Meditation' }];
            break;
        case 'Happy':
        case 'Excited':
            fallback.journaling = ["What are three things that contributed to this feeling?", "How can you share this positive energy with others?", "Describe this feeling in as much detail as possible."];
            fallback.music = [{ title: 'Good Vibes Only', description: 'Upbeat pop and indie tracks to keep the energy high.' }, { title: 'Dance Party USA', description: 'Non-stop hits that make you want to move.' }];
            fallback.videos = [{ title: 'Try Not to Laugh Challenge', type: 'Funny' }, { title: 'Cute Animals Compilation', type: 'Funny' }];
            break;
    }
    
    return fallback;
  }
};