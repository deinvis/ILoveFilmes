
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, canonicalized)
}

const DEFAULT_GROUP_NAME = 'Uncategorized';
const CANONICAL_LANCAMENTOS_CORE = "Lançamentos";
const CANONICAL_FICCAO_FANTASIA_CORE = "Ficção e Fantasia";
const CANONICAL_GLOBO_CORE = "Globo";
const CANONICAL_INFANTIL_CORE = "Infantil";

// Very generic prefixes to remove first from any group name
const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:todos\s*os\s*g[êe]neros|all\s*genres|categorias?)\s*[|:\-–—]\s*/i,
  /^(?:lista|grupo|categoria)\s*[|:\-–—\s]?/i,
];

// Type-specific prefixes/patterns to identify the core part of the group name
const CHANNEL_PREFIX_PATTERNS: RegExp[] = [
  /^(?:canais|canal)\s*(?:[|i\-–—]\s*)?/i, // "CANAIS |", "Canais - ", "Canal ", "CANAIS", "canal"
];
const MOVIE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|vod\s*filmes?|cole[çc][ãa]o\s*de\s*filmes?)\s*[|:\-–—]\s*/i,
];
const SERIES_PREFIX_PATTERNS: RegExp[] = [
  /^(?:s[eé]ries|tvshows?|vod\s*s[eé]ries?|cole[çc][ãa]o\s*de\s*s[eé]ries?)\s*[|:\-–—]\s*/i,
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
 * Converts a string to "Smart Title Case".
 * Keeps existing all-caps words (like acronyms) if they are short or common.
 * Otherwise, capitalizes the first letter of each word.
 */
function smartTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(/\s+/)
    .map(word => {
      if (word.length > 0) {
        // Keep all-caps words like "4K", "HD", "DC", "UFC", "NBA", "NFL", "USA" or if it's purely an acronym
        if (/^[A-Z0-9]+$/.test(word) && (word.length <= 3 || ["UFC", "NBA", "NFL", "ESPN"].includes(word))) {
          return word;
        }
        // Capitalize first letter, rest lowercase
        return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
      }
      return '';
    })
    .join(' ');
}


export function processGroupName(rawGroupName?: string, mediaType?: MediaType): ProcessedGroupName {
  let nameToProcess = (rawGroupName || DEFAULT_GROUP_NAME).trim();

  // 1. Remove very generic prefixes from any group name
  for (const pattern of GENERIC_PREFIX_PATTERNS) {
    const tempName = nameToProcess.replace(pattern, '').trim();
    if (tempName.length > 0 && tempName.length < nameToProcess.length) {
      nameToProcess = tempName;
      break;
    }
  }

  // 2. Extract the "core" group name by removing type-specific prefixes/patterns
  //    This also handles cases where the group name might just be "CANAIS" or "FILMES"
  let coreGroupName = nameToProcess;
  let originalCoreWasAllCaps = /^[A-Z0-9\s\W_]+$/.test(coreGroupName) && coreGroupName.length > 1; // Check before type-specific strip

  if (mediaType === 'channel') {
    for (const pattern of CHANNEL_PREFIX_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        break;
      }
    }
  } else if (mediaType === 'movie') {
    for (const pattern of MOVIE_PREFIX_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        break;
      }
    }
  } else if (mediaType === 'series') {
    for (const pattern of SERIES_PREFIX_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        break;
      }
    }
  }

  // 3. Normalize common variations (e.g., plural to singular) on the coreGroupName
  let normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();

  if (normalizedCoreForMatching.endsWith("infantis")) {
    // Replace "Infantis" with "Infantil" in the original case version for canonical form
    if (coreGroupName.toLowerCase().endsWith("infantis")) {
        coreGroupName = coreGroupName.substring(0, coreGroupName.length - "infantis".length) + "Infantil";
        normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim(); // re-normalize after change
    }
  }
  if (normalizedCoreForMatching.endsWith("globos")) {
     if (coreGroupName.toLowerCase().endsWith("globos")) {
        coreGroupName = coreGroupName.substring(0, coreGroupName.length - "globos".length) + "Globo";
        normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim(); // re-normalize
     }
  }


  // 4. Canonicalization (applied to the potentially modified coreGroupName)
  let isCanonical = false;
  let finalDisplayName = coreGroupName; // Start with the processed core name

  if (coreGroupName) {
    const lancamentoKeywords = ["lancamento", "estreia", "cinema"];
    const ficcaoFantasiaPatterns = [/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/];
    const globoKeywords = ["globo"]; // "globos" was already handled above
    const infantilKeywords = ["infantil"];


    if (lancamentoKeywords.some(kw => normalizedCoreForMatching.includes(kw))) {
      finalDisplayName = CANONICAL_LANCAMENTOS_CORE;
      isCanonical = true;
    } else if (ficcaoFantasiaPatterns.some(p => p.test(normalizedCoreForMatching))) {
      finalDisplayName = CANONICAL_FICCAO_FANTASIA_CORE;
      isCanonical = true;
    } else if (globoKeywords.includes(normalizedCoreForMatching)) {
      finalDisplayName = CANONICAL_GLOBO_CORE;
      isCanonical = true;
    } else if (infantilKeywords.includes(normalizedCoreForMatching)) {
      finalDisplayName = CANONICAL_INFANTIL_CORE;
      isCanonical = true;
    }
  }

  // 5. Final capitalization for displayName (if not canonical)
  if (!isCanonical) {
    if (originalCoreWasAllCaps && coreGroupName.length > 1 && coreGroupName.length < 25 && /^[A-Z0-9\s]+$/.test(coreGroupName)) {
        finalDisplayName = coreGroupName.toUpperCase(); // Preserve original all-caps if it was like that
    } else {
        finalDisplayName = smartTitleCase(coreGroupName);
    }
  }
  
  // Handle cases where coreGroupName might have become empty after stripping prefixes
  if (!finalDisplayName.trim() && mediaType) {
     finalDisplayName = (mediaType === 'channel' ? "CANAIS" : (mediaType === 'movie' ? "FILMES" : "SÉRIES"));
     isCanonical = true; // Treat these as canonical base types
  } else if (!finalDisplayName.trim()) {
     finalDisplayName = DEFAULT_GROUP_NAME;
     isCanonical = true;
  }


  // 6. Prepend "CANAIS " if it's a channel and the name doesn't already imply it (and not canonical)
  if (mediaType === 'channel' && !isCanonical) {
    const displayNameLowerNoDiacritics = removeDiacritics(finalDisplayName.toLowerCase());
    if (!displayNameLowerNoDiacritics.includes("canal") && !displayNameLowerNoDiacritics.includes("canais")) {
      finalDisplayName = "CANAIS " + finalDisplayName;
    }
  }

  // 7. Ensure ALL final display names are uppercase
  finalDisplayName = finalDisplayName.toUpperCase();
  
  // 8. Generate normalizedKey (from the final display name, lowercased and diacritics removed)
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();
  
  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey,
  };
}

