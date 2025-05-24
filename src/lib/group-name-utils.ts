
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
      // Keep existing short all-caps words like "AÇÃO", "DC", "UFC", "NBA"
      // but not very long ones unless they contain numbers like "24 HORAS"
      if (word.length > 1 && word === word.toUpperCase() &&
          (!/\d/.test(word) && word.length <= 5 || /\d/.test(word) && word.length <= 10) ) {
        return word;
      }
      // Handle words with slashes like "ANIMACAO/INFANTIL" -> "Animacao/Infantil"
      return word.split('/').map(part => {
        if (!part) return '';
        if (part.length > 1 && part === part.toUpperCase() &&
            (!/\d/.test(part) && part.length <= 5 || /\d/.test(part) && part.length <= 10) ) {
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

  let nameToProcess = rawName.trim();

  // 1. General prefix stripping (optional, can be aggressive)
  // For example, if a group is "CHANNELS | ABERTOS", this might strip "CHANNELS | "
  // For "MOVIES | AÇÃO", this might strip "MOVIES | "
  let baseNameAfterGenericStrip = nameToProcess;
  for (const pattern of GENERIC_MEDIA_TYPE_PREFIX_PATTERNS) {
    const tempName = nameToProcess.replace(pattern, '').trim();
    if (tempName.length > 0 && tempName.length < nameToProcess.length) {
      baseNameAfterGenericStrip = tempName;
      break; 
    }
  }
  nameToProcess = baseNameAfterGenericStrip; // Continue processing with potentially stripped name

  // 2. Type-specific cleaning to get the "core" of the group name
  let coreGroupName = nameToProcess;
  if (mediaType === 'movie' || mediaType === 'series') {
    // More aggressive prefix stripping for VOD
    const typeSpecificPrefixPattern = /^(?:filmes?|movies?|s[eé]ries|tvshows?|vod|cole[çc][ãa]o|categorias?)\s*[|:\-–—]\s*/i;
    const cleaned = coreGroupName.replace(typeSpecificPrefixPattern, '').trim();
    if (cleaned.length > 0 || coreGroupName.match(typeSpecificPrefixPattern)) { // Apply if pattern matched or something was cleaned
        coreGroupName = cleaned;
    }
  } else if (mediaType === 'channel') {
    // For channels, just remove the pipe separator
    coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim();
  }

  if (coreGroupName.trim() === '') {
    coreGroupName = DEFAULT_GROUP_NAME;
  }

  // 3. Canonicalization (applied to coreGroupName, affects finalDisplayName)
  let finalDisplayName = coreGroupName;
  let isCanonical = false;
  const normalizedCoreForCanonicalCheck = removeDiacritics(coreGroupName.toLowerCase()).trim();

  const lancamentoKeywords = ["lancamento", "estreia", "cinema"];
  if (lancamentoKeywords.some(kw => normalizedCoreForCanonicalCheck.includes(kw))) {
    finalDisplayName = CANONICAL_LANCAMENTOS_DISPLAY_NAME;
    isCanonical = true;
  } else {
    const ficcaoFantasiaPatterns = [/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/];
    if (ficcaoFantasiaPatterns.some(p => p.test(normalizedCoreForCanonicalCheck))) {
      finalDisplayName = CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME;
      isCanonical = true;
    }
  }
  
  // 4. Smart Title Case or Preserve ALL CAPS for the 'core' name (if not canonicalized)
  if (!isCanonical) {
    // Use 'nameToProcess' (which is the name *before* VOD specific prefix stripping or channel pipe removal)
    // for the all-caps check to better reflect original intent if it was like "ALL CAPS GROUP"
    // but 'coreGroupName' for actual smart title casing.
    const originalSegmentForAllCapsCheck = nameToProcess; 
    if (originalSegmentForAllCapsCheck === originalSegmentForAllCapsCheck.toUpperCase() &&
        originalSegmentForAllCapsCheck.length > 1 &&
        !/\d/.test(originalSegmentForAllCapsCheck) && // Ignore "4K"
        originalSegmentForAllCapsCheck.length <= 15) { // Heuristic for intentional all caps
      finalDisplayName = coreGroupName; // Use the coreGroupName but it will be cased by this rule
                                        // If coreGroupName was "ABERTOS", it stays "ABERTOS"
    } else {
      finalDisplayName = smartTitleCase(coreGroupName);
    }
  }

  // 5. Channel-specific prepending (if not canonicalized and applies)
  if (mediaType === 'channel' && !isCanonical) {
    const channelKeywords = ['canal', 'canais'];
    const checkName = removeDiacritics(finalDisplayName.toLowerCase());
    const containsChannelKeyword = channelKeywords.some(kw => checkName.includes(kw));

    if (!containsChannelKeyword) {
      finalDisplayName = `Canais ${finalDisplayName}`;
    }
  }
  
  // Default if somehow empty or just 'uncategorized' after processing
  if (finalDisplayName.trim() === '' || removeDiacritics(finalDisplayName.trim().toLowerCase()) === DEFAULT_GROUP_NAME.toLowerCase()) {
    finalDisplayName = DEFAULT_GROUP_NAME;
  }
  
  // The normalizedKey should always be based on the finalDisplayName
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey
  };
}
