
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, canonicalized)
}

const DEFAULT_GROUP_NAME = 'Uncategorized';
const CANONICAL_LANCAMENTOS_DISPLAY_NAME = "Lançamentos";
const CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME = "Ficção e Fantasia";

// Patterns to match prefixes like "MOVIES | ", "CHANNELS - ", "SERIES : ", etc.
// These are very generic and might be applied before type-specific logic if needed,
// or incorporated into type-specific logic.
const GENERIC_MEDIA_TYPE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|s[eé]ries|tvshows?|canais|channels|vod|live|iptv|adulto(?:s)?|kids|infantil|esportes|noticias|document[aá]rios|uhd|fhd|sd|hd|4k|24h|24\/7|desenhos?|todos\s*os\s*g[êe]neros)\s*[|:\-–—]\s*/i,
];

/**
 * Removes diacritics (accents) from a string.
 * @param str The input string.
 * @returns The string without diacritics.
 */
function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Converts a string to a "smart" title case.
 * Keeps all-caps words (like "DC", "4K", "AÇÃO") as they are.
 * Capitalizes the first letter of other words/parts of words.
 * @param str The input string.
 * @returns The string in smart title case.
 */
function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => {
      if (word.length > 1 && word === word.toUpperCase() && !/\d/.test(word) && word.length <= 5) { // Keep existing all-caps words like "AÇÃO", "DC", but not very long ones
        return word;
      }
      // Handle words with slashes like "ANIMACAO/INFANTIL" -> "Animacao/Infantil"
      return word.split('/').map(part => {
        if (!part) return '';
        if (part.length > 1 && part === part.toUpperCase() && !/\d/.test(part) && part.length <= 5) {
            return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('/');
    })
    .join(' ');
}


export function processGroupName(rawName?: string, mediaType?: MediaType): ProcessedGroupName {
  if (!rawName || rawName.trim() === '') {
    return {
      displayName: DEFAULT_GROUP_NAME,
      normalizedKey: removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase())
    };
  }

  let currentName = rawName.trim();
  let baseNameForProcessing = currentName; // This will be the name after initial, general prefix stripping

  // Try a general prefix strip first, useful for mixed content like "ALL | SERIES | ACTION"
  for (const pattern of GENERIC_MEDIA_TYPE_PREFIX_PATTERNS) {
    const tempName = baseNameForProcessing.replace(pattern, '').trim();
    if (tempName.length > 0 && tempName.length < baseNameForProcessing.length) {
      baseNameForProcessing = tempName;
      // If a generic prefix was stripped, re-evaluate if the type-specific one still matches
      currentName = baseNameForProcessing;
      break; 
    }
  }
  
  // Type-specific structuring for displayName
  if (mediaType === 'movie' || mediaType === 'series') {
    // For movies/series, remove common prefixes like "FILMES | ", "SÉRIES - "
    const typeSpecificPrefixPattern = /^(?:filmes?|movies?|s[eé]ries|tvshows?|vod)\s*[|:\-–—]\s*/i;
    const coreName = currentName.replace(typeSpecificPrefixPattern, '').trim();
    if (coreName.length > 0) {
      currentName = coreName;
    }
  } else if (mediaType === 'channel') {
    // For channels, replace "|" with space.
    currentName = currentName.replace(/\s*\|\s*/g, ' ').trim();
    // If "canal(is)" is not in the name, prepend "Canais ".
    const channelKeywords = ['canal', 'canais'];
    const containsChannelKeyword = channelKeywords.some(kw => removeDiacritics(currentName.toLowerCase()).includes(kw));
    if (!containsChannelKeyword) {
      currentName = `Canais ${currentName}`;
    }
  }

  // If after prefix stripping, the name is empty, default to Uncategorized
  if (currentName.trim() === '') {
    currentName = DEFAULT_GROUP_NAME;
  }

  // Canonicalization rules (Lançamentos, Ficção e Fantasia)
  let displayName = currentName;
  const normalizedForCanonicalCheck = removeDiacritics(currentName.toLowerCase()).trim();

  const lancamentoKeywords = ["lancamento", "estreia", "cinema"];
  if (lancamentoKeywords.some(kw => normalizedForCanonicalCheck.includes(kw))) {
    displayName = CANONICAL_LANCAMENTOS_DISPLAY_NAME;
  } else {
    const ficcaoFantasiaPatterns = [/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/];
    if (ficcaoFantasiaPatterns.some(p => p.test(normalizedForCanonicalCheck))) {
      displayName = CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME;
    }
  }

  // Apply Smart Title Case unless it was canonicalized or was originally ALL CAPS
  // and is not a channel name that had "Canais " prepended.
  if (displayName === currentName) { // Only apply if not canonicalized
    // Check if the 'baseNameForProcessing' (name after GENERIC prefix strip) was all caps
    // And if the currentName (after type-specific strip) is essentially that base name
    const originalSegment = baseNameForProcessing;
    const currentSegment = currentName;

    if (originalSegment === originalSegment.toUpperCase() &&
        originalSegment.length > 1 &&
        !/\d/.test(originalSegment) && // ignore "4K" like things for this rule if they become just numbers
        originalSegment.length <= 15 && // Heuristic: very long all caps strings are probably not intentional titles
        displayName === currentSegment) { // Make sure we're applying to the non-canonicalized name
      displayName = originalSegment; // Preserve original all caps
    } else {
      displayName = smartTitleCase(displayName);
    }
  } else {
    // If it was canonicalized, it already has the desired capitalization.
  }


  if (displayName.trim() === '' || displayName === smartTitleCase(DEFAULT_GROUP_NAME) || displayName === DEFAULT_GROUP_NAME.toLowerCase()) {
      displayName = DEFAULT_GROUP_NAME;
  }

  const normalizedKey = removeDiacritics(displayName.toLowerCase()).trim();

  return {
    displayName: displayName,
    normalizedKey: normalizedKey
  };
}
