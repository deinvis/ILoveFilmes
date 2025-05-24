
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
// These are very generic and might be applied before type-specific logic if needed.
const GENERIC_MEDIA_TYPE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:todos\s*os\s*g[êe]neros|all\s*genres|categorias?)\s*[|:\-–—]\s*/i,
];

/**
 * Removes diacritics (accents) from a string.
 * @param str The input string.
 * @returns The string without diacritics.
 */
function removeDiacritics(str: string): string {
  if (!str) return '';
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
      if (word.length > 1 && word === word.toUpperCase() &&
          (!/\d/.test(word) && word.length <= 5 || /\d/.test(word) && word.length <= 10) ) {
        return word;
      }
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
  const originalRawName = rawName || DEFAULT_GROUP_NAME;
  let nameToProcess = originalRawName.trim();

  // 1. Remove very generic prefixes that don't add semantic value to the group itself
  for (const pattern of GENERIC_MEDIA_TYPE_PREFIX_PATTERNS) {
    const tempName = nameToProcess.replace(pattern, '').trim();
    if (tempName.length > 0 && tempName.length < nameToProcess.length) {
      nameToProcess = tempName;
      break; 
    }
  }
  
  let coreGroupName = nameToProcess;
  let finalDisplayName = '';
  let isCanonical = false;

  // 2. Type-specific cleaning to get the "core" of the group name for VOD or pre-process channels
  if (mediaType === 'movie' || mediaType === 'series') {
    const typeSpecificPrefixPattern = /^(?:filmes?|movies?|s[eé]ries|tvshows?|vod|cole[çc][ãa]o)\s*[|:\-–—]\s*/i;
    const cleaned = coreGroupName.replace(typeSpecificPrefixPattern, '').trim();
    if (cleaned.length > 0 || coreGroupName.match(typeSpecificPrefixPattern)) {
        coreGroupName = cleaned;
    }
  } else if (mediaType === 'channel') {
    // For channels, the "core" is what's left after removing "Canais/Canal" and separators
    // e.g., "Canais | Abertos" -> "Abertos"; "CHILENOS" -> "CHILENOS"
    const channelPrefixExtractRegex = /^(?:canais|canal)\s*(?:[|i\-–—]\s*)?(.*)$/i;
    const extractMatch = nameToProcess.match(channelPrefixExtractRegex);
    
    if (extractMatch && extractMatch[1] && extractMatch[1].trim() !== "") {
      coreGroupName = extractMatch[1].trim();
    } else if (!channelPrefixExtractRegex.test(nameToProcess) && nameToProcess.trim() !== "") {
      // If it doesn't start with "Canais/Canal" and isn't empty, the whole thing is the core
      coreGroupName = nameToProcess.trim();
    } else {
      // Original was "Canais", "Canal", or "Canais | ", etc.
      coreGroupName = ""; // This will result in "CANAIS" as display name
    }
  }
  
  // 3. Canonicalization (applied to coreGroupName)
  if (coreGroupName) {
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
  }

  // 4. Final Display Name construction and capitalization
  if (!isCanonical) {
    let capitalizedCoreName: string;
    if (coreGroupName.trim() === '') { // Handle if coreGroupName ended up empty
        capitalizedCoreName = ''; 
    } else if (
      coreGroupName === coreGroupName.toUpperCase() &&
      coreGroupName.length > 0 &&
      (!/\d/.test(coreGroupName) && coreGroupName.length <= 15 || /\d/.test(coreGroupName))
    ) {
      capitalizedCoreName = coreGroupName;
    } else {
      capitalizedCoreName = smartTitleCase(coreGroupName);
    }

    if (mediaType === 'channel') {
      if (capitalizedCoreName) {
        finalDisplayName = `CANAIS ${capitalizedCoreName}`;
      } else {
        // If core was empty (e.g., original "Canais" or "Canais | "), display just "CANAIS"
        finalDisplayName = "CANAIS";
      }
    } else { // Movies or Series
      finalDisplayName = capitalizedCoreName || DEFAULT_GROUP_NAME; // Fallback if core became empty
    }
  }
  
  // Default if somehow empty or becomes "Uncategorized" after all processing
  if (finalDisplayName.trim() === '' || 
      (removeDiacritics(finalDisplayName.trim().toLowerCase()) === DEFAULT_GROUP_NAME.toLowerCase() && 
       finalDisplayName !== DEFAULT_GROUP_NAME) // allow "Uncategorized" if it was truly the only name
      ) {
    if (mediaType === 'channel') {
        finalDisplayName = "CANAIS Diversos"; // More specific default for channels
    } else {
        finalDisplayName = DEFAULT_GROUP_NAME;
    }
  }
  
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey
  };
}
