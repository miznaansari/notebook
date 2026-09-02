/**
 * High-performance, instantaneous Hindi (Devanagari) to Hinglish (Roman/Latin alphabet) transliterator.
 * Runs in sub-millisecond time for real-time live voice dictation.
 */

const vowels: Record<string, string> = {
  "अ": "a",
  "आ": "aa",
  "इ": "i",
  "ई": "ee",
  "उ": "u",
  "ऊ": "oo",
  "ऋ": "ri",
  "ए": "e",
  "ऐ": "ai",
  "ओ": "o",
  "औ": "au",
  "अं": "an",
  "अः": "ah",
};

const matras: Record<string, string> = {
  "ा": "a",
  "ि": "i",
  "ी": "ee",
  "ु": "u",
  "ू": "oo",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ं": "n",
  "ँ": "n",
  "ः": "h",
  "्": "", // Halant (cancels inherent 'a')
};

const consonants: Record<string, string> = {
  "क": "k",
  "ख": "kh",
  "ग": "g",
  "घ": "gh",
  "ङ": "ng",
  "च": "ch",
  "छ": "chh",
  "ज": "j",
  "झ": "jh",
  "ञ": "ny",
  "ट": "t",
  "ठ": "th",
  "ड": "d",
  "ढ": "dh",
  "ण": "n",
  "त": "t",
  "थ": "th",
  "द": "d",
  "ध": "dh",
  "न": "n",
  "प": "p",
  "फ": "ph",
  "ब": "b",
  "भ": "bh",
  "म": "m",
  "य": "y",
  "र": "r",
  "ल": "l",
  "व": "v",
  "श": "sh",
  "ष": "sh",
  "स": "s",
  "ह": "h",
  "क़": "q",
  "ख़": "kh",
  "ग़": "gh",
  "ज़": "z",
  "ड़": "r",
  "ढ़": "rh",
  "फ़": "f",
  "य़": "y",
};

const commonWords: Record<string, string> = {
  "नमस्ते": "Namaste",
  "नमस्कार": "Namaskar",
  "है": "hai",
  "हूँ": "hoon",
  "हैं": "hain",
  "हो": "ho",
  "था": "tha",
  "थी": "thi",
  "थे": "the",
  "क्या": "kya",
  "कैसे": "kaise",
  "कहाँ": "kahan",
  "कब": "kab",
  "क्यों": "kyon",
  "कौन": "kaun",
  "कितना": "kitna",
  "कितने": "kitne",
  "कितनी": "kitni",
  "हाँ": "haan",
  "नहीं": "nahi",
  "ना": "na",
  "और": "aur",
  "लेकिन": "lekin",
  "परंतु": "parantu",
  "अगर": "agar",
  "मगर": "magar",
  "तो": "to",
  "भी": "bhi",
  "ही": "hi",
  "तक": "tak",
  "से": "se",
  "का": "ka",
  "की": "ki",
  "के": "ke",
  "को": "ko",
  "में": "mein",
  "पर": "par",
  "लिए": "liye",
  "वाला": "wala",
  "वाले": "wale",
  "वाली": "wali",
  "यह": "yeh",
  "वह": "woh",
  "ये": "ye",
  "वे": "woh",
  "हम": "hum",
  "तुम": "tum",
  "आप": "aap",
  "मेरा": "mera",
  "मेरी": "meri",
  "मेरे": "mere",
  "तेरा": "tera",
  "तेरी": "teri",
  "तेरे": "tere",
  "उसका": "uska",
  "उसकी": "uski",
  "उसके": "uske",
  "हमारा": "hamara",
  "हमारी": "hamari",
  "हमारे": "hamare",
  "आपका": "aapka",
  "आपकी": "aapki",
  "आपके": "aapke",
  "आज": "aaj",
  "कल": "kal",
  "परसों": "parson",
  "अभी": "abhi",
  "बाद": "baad",
  "पहले": "pehle",
  "करो": "karo",
  "करें": "karein",
  "कर": "kar",
  "करना": "karna",
  "किया": "kiya",
  "गया": "gaya",
  "गई": "gayi",
  "गए": "gaye",
  "जाओ": "jao",
  "जाना": "jana",
  "आओ": "aao",
  "आना": "aana",
  "देना": "dena",
  "दो": "do",
  "लो": "lo",
  "लेना": "lena",
  "लिखो": "likho",
  "लिखना": "likhna",
  "पढ़ो": "padho",
  "बोलो": "bolo",
  "सुनो": "suno",
  "देखो": "dekho",
  "मीटिंग": "meeting",
  "प्रोजेक्ट": "project",
  "टास्क": "task",
  "नोट्स": "notes",
  "क्लाइंट": "client",
  "पेमेंट": "payment",
  "लॉगिन": "login",
  "यूजर": "user",
  "पासवर्ड": "password",
  "अपडेट": "update",
  "डिलीट": "delete",
  "सेव": "save",
};

/**
 * Check if text has any Devanagari Hindi characters.
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Transliterates a single Devanagari Hindi word to Hinglish.
 */
function transliterateWord(word: string): string {
  // Check direct dictionary first
  if (commonWords[word]) {
    return commonWords[word];
  }

  let result = "";
  const chars = Array.from(word);
  const len = chars.length;

  for (let i = 0; i < len; i++) {
    const char = chars[i];
    const nextChar = i + 1 < len ? chars[i + 1] : "";
    const isNextHalant = nextChar === "्";
    const isNextMatra = nextChar in matras && !isNextHalant;

    if (char in consonants) {
      result += consonants[char];
      // Inherent 'a' is added if not followed by a matra, halant, or at the end of word (schwa deletion)
      if (!isNextHalant && !isNextMatra) {
        if (i < len - 1) {
          result += "a";
        }
      }
    } else if (char in vowels) {
      result += vowels[char];
    } else if (char in matras) {
      result += matras[char];
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Converts any text containing Hindi Devanagari into natural, clean Hinglish.
 * English words, punctuation, spaces, numbers are fully preserved.
 */
export function toHinglish(text: string): string {
  if (!text || !containsDevanagari(text)) {
    return text;
  }

  // Regex to match Devanagari words vs non-Devanagari tokens
  return text.replace(/[\u0900-\u097F]+/g, (match) => {
    return transliterateWord(match);
  });
}
