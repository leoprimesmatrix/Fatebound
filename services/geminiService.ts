import { GoogleGenAI } from "@google/genai";
import { Realm, Card } from '../types';

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Fallback arrays for when API is unavailable or quota exceeded
const FALLBACK_COMMENTARY = [
  "A devastating blow shakes the arena!",
  "The magical energy intensifies!",
  "A strategic masterstroke!",
  "The very ground trembles from that attack!",
  "Power surges through the battlefield!",
  "An unexpected turn of events!",
  "The crowd roars in anticipation!",
  "Pure skill on display!"
];

const FALLBACK_TIPS = [
  "Save your high-cost cards for a decisive turn.",
  "Don't forget to use your Champion's ability if you have spare Mana.",
  "Control the board by removing enemy minions early.",
  "Sometimes it's better to wait than to play a card just because you can.",
  "Watch your health - don't let it drop too low!",
  "Combine spell effects for maximum impact."
];

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const generateBattleCommentary = async (
  cardName: string, 
  realm: Realm, 
  isPlayer: boolean
): Promise<string> => {
  // Immediate fallback if no AI instance
  if (!ai) return `${isPlayer ? 'You' : 'Opponent'} played ${cardName}!`;

  try {
    const prompt = `
      Context: A fantasy card battle game "Fatebound: Duel of Realms".
      Action: The ${isPlayer ? 'Player' : 'Enemy'} casts "${cardName}" belonging to the ${realm}.
      Task: Write a single, short, dramatic sentence (max 15 words) describing this action visually.
      Tone: Epic, intense.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    // Graceful fallback on error (e.g. quota exceeded)
    console.warn("Gemini API unavailable, using fallback.");
    return `${isPlayer ? 'You' : 'Opponent'} uses ${cardName}. ${getRandom(FALLBACK_COMMENTARY)}`;
  }
};

export const getTacticalTip = async (
  hand: Card[], 
  enemyHealth: number,
  playerMana: number
): Promise<string> => {
  if (!ai) return getRandom(FALLBACK_TIPS);

  try {
    const handNames = hand.map(c => `${c.name} (Cost: ${c.cost}, Val: ${c.value})`).join(', ');
    const prompt = `
      Context: Card game strategy.
      State: Enemy HP: ${enemyHealth}, My Mana: ${playerMana}.
      Hand: ${handNames}.
      Task: Give 1 short sentence of tactical advice on what to prioritize.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    return getRandom(FALLBACK_TIPS);
  }
};