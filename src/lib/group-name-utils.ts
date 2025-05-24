
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

const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:todos\s*os\s*g[êe]neros|all\s*genres|categorias?)\s*[|:\-–—]\s*/i,
];

const CHANNEL_SPECIFIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:canais|canal)\s*(?:[|i\-–—]\s*)?/i,
];

const VOD_SPECIFIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|s[eé]ries|tvshows?|vod|cole[çc][ãa]o)\s*[|:\-–—]\s*/i,
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

export function processGroupName(rawName?: string, mediaType?: MediaType): ProcessedGroupName {
  let currentName = (rawName || DEFAULT_GROUP_NAME).trim();

  // 1. Remove very generic prefixes that don't add semantic value to the group itself
  for (const pattern of GENERIC_PREFIX_PATTERNS) {
    const tempName = currentName.replace(pattern, '').trim();
    if (tempName.length > 0 && tempName.length < currentName.length) {
      currentName = tempName;
      break;
    }
  }

  let coreGroupName = currentName;
  let displayPrefix = "";
  let isCanonical = false;

  // 2. Type-specific cleaning to get the "core" of the group name
  if (mediaType === 'channel') {
    displayPrefix = "CANAIS ";
    let matchedChannelPrefix = false;
    for (const pattern of CHANNEL_SPECIFIC_PREFIX_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        matchedChannelPrefix = true;
        break;
      }
    }
    // If no specific "CANAIS |" like prefix was found, the coreGroupName is the whole thing,
    // but we still want to ensure "CANAIS " is prepended later if it's not already implied.
    // If coreGroupName became empty after prefix removal (e.g. "CANAIS | "), it's fine.
  } else if (mediaType === 'movie' || mediaType === 'series') {
    for (const pattern of VOD_SPECIFIC_PREFIX_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        break;
      }
    }
  }

  // 3. Canonicalization (applied to coreGroupName)
  if (coreGroupName) {
    const normalizedCoreForCanonicalCheck = removeDiacritics(coreGroupName.toLowerCase()).trim();
    const lancamentoKeywords = ["lancamento", "estreia", "cinema"];
    const ficcaoFantasiaPatterns = [/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/];
    const globoKeywords = ["globo", "globos"];

    if (lancamentoKeywords.some(kw => normalizedCoreForCanonicalCheck.includes(kw))) {
      coreGroupName = CANONICAL_LANCAMENTOS_CORE;
      isCanonical = true;
    } else if (ficcaoFantasiaPatterns.some(p => p.test(normalizedCoreForCanonicalCheck))) {
      coreGroupName = CANONICAL_FICCAO_FANTASIA_CORE;
      isCanonical = true;
    } else if (globoKeywords.includes(normalizedCoreForCanonicalCheck)) {
      coreGroupName = CANONICAL_GLOBO_CORE;
      isCanonical = true;
    }
  }

  // 4. Construct preliminary displayName
  let preliminaryDisplayName: string;

  if (mediaType === 'channel') {
    if (coreGroupName && coreGroupName.trim() !== '') {
      // If coreGroupName is canonical and already implies "Channels" (hypothetically), adjust displayPrefix
      // For now, always prepend for channels unless the core name *is* "CANAIS"
      if (coreGroupName.toUpperCase() === "CANAIS") { // Case where original was just "CANAIS"
        preliminaryDisplayName = "CANAIS";
      } else {
        preliminaryDisplayName = displayPrefix + coreGroupName;
      }
    } else {
      // Original group was "CANAIS | " or just "CANAIS", or became empty.
      preliminaryDisplayName = "CANAIS";
    }
  } else { // Movies or Series
    preliminaryDisplayName = (coreGroupName && coreGroupName.trim() !== '') ? coreGroupName : DEFAULT_GROUP_NAME;
  }
  
  // 5. Final Uppercase Conversion for display name
  const finalDisplayName = preliminaryDisplayName.toUpperCase();

  // 6. Generate normalizedKey (from the final display name, lowercased and diacritics removed)
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();
  
  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey,
  };
}
