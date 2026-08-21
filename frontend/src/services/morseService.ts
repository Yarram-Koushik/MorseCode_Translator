/**
 * Client-Side Deterministic Morse Code Engine (ITU-R M.1677-1 standard).
 */

export const ITU_MORSE_TABLE: Record<string, string> = {
  // Letters
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',

  // Numbers
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',

  // Punctuation
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-', '@': '.--.-.',

  // Special Prosigns
  SOS: '...---...',
  SK: '...-.-',
  AR: '.-.-.',
  BT: '-...-',
  AS: '.-...',
  KA: '-.-.-',
  HH: '........',
};

export const MORSE_TO_CHAR_TABLE: Record<string, string> = Object.entries(ITU_MORSE_TABLE).reduce(
  (acc, [char, morse]) => {
    acc[morse] = char;
    return acc;
  },
  {} as Record<string, string>
);
MORSE_TO_CHAR_TABLE['...---...'] = 'SOS';

export interface MorseToken {
  char: string;
  morse: string;
  valid: boolean;
  isProsign?: boolean;
}

export class MorseService {
  public static encode(text: string): { morse: string; confidence: number; tokens: MorseToken[] } {
    if (!text || !text.trim()) {
      return { morse: '', confidence: 1.0, tokens: [] };
    }

    const words = text.trim().split(/\s+/);
    const encodedWords: string[] = [];
    const tokens: MorseToken[] = [];
    let total = 0;
    let valid = 0;

    for (const word of words) {
      const upperWord = word.toUpperCase();
      // Check prosign
      if (ITU_MORSE_TABLE[upperWord] && upperWord.length > 1) {
        const m = ITU_MORSE_TABLE[upperWord];
        encodedWords.push(m);
        total++;
        valid++;
        tokens.push({ char: upperWord, morse: m, valid: true, isProsign: true });
      } else {
        const wordChars: string[] = [];
        for (const char of upperWord) {
          total++;
          if (ITU_MORSE_TABLE[char]) {
            const m = ITU_MORSE_TABLE[char];
            wordChars.push(m);
            valid++;
            tokens.push({ char, morse: m, valid: true });
          } else {
            wordChars.push('?');
            tokens.push({ char, morse: '?', valid: false });
          }
        }
        encodedWords.push(wordChars.join(' '));
      }
    }

    return {
      morse: encodedWords.join(' / '),
      confidence: total > 0 ? Number((valid / total).toFixed(2)) : 1.0,
      tokens,
    };
  }

  public static decode(morse: string): { text: string; confidence: number; tokens: MorseToken[] } {
    if (!morse || !morse.trim()) {
      return { text: '', confidence: 1.0, tokens: [] };
    }

    // Normalize delimiters
    const normalized = morse
      .trim()
      .replace(/\s*[/\|]\s*/g, ' / ')
      .replace(/\s{3,}/g, ' / ')
      .replace(/\s{2}/g, ' / ');

    const words = normalized.split(' / ');
    const decodedWords: string[] = [];
    const tokens: MorseToken[] = [];
    let total = 0;
    let valid = 0;

    for (const wordMorse of words) {
      const symbols = wordMorse.split(' ').filter((s) => s.trim().length > 0);
      const decodedChars: string[] = [];

      for (const sym of symbols) {
        total++;
        if (MORSE_TO_CHAR_TABLE[sym]) {
          const c = MORSE_TO_CHAR_TABLE[sym];
          decodedChars.push(c);
          valid++;
          tokens.push({ char: c, morse: sym, valid: true });
        } else {
          decodedChars.push('');
          tokens.push({ char: '', morse: sym, valid: false });
        }
      }
      decodedWords.push(decodedChars.join(''));
    }

    return {
      text: decodedWords.join(' '),
      confidence: total > 0 ? Number((valid / total).toFixed(2)) : 0.0,
      tokens,
    };
  }
}
