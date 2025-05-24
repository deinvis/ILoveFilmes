
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, canonicalized)
}

// Patterns to match prefixes like "MOVIES | ", "CHANNELS - ", "SERIES : ", etc.
const MEDIA_TYPE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|s[eé]ries|tvshows?|canais|channels|vod|live|iptv|adulto(?:s)?|kids|infantil|esportes|noticias|document[aá]rios|uhd|fhd|sd|hd|4k|24h|24\/7|desenhos?)\s*[|:\-–—]\s*/i,
];

const DEFAULT_GROUP_NAME = 'Uncategorized';
const CANONICAL_LANCAMENTOS_DISPLAY_NAME = "Lançamentos";
const CANONICAL_LANCAMENTOS_NORMALIZED_KEY = removeDiacritics(CANONICAL_LANCAMENTOS_DISPLAY_NAME.toLowerCase());
const CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME = "Ficção e Fantasia";
const CANONICAL_FICCAO_FANTASIA_NORMALIZED_KEY = removeDiacritics(CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME.toLowerCase().replace(/\s*e\s*/, ' ')); // "ficcao fantasia"


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
 * Keeps all-caps words (like "DC", "4K") as they are.
 * Capitalizes the first letter of other words/parts of words.
 * @param str The input string.
 * @returns The string in smart title case.
 */
function smartTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => {
      if (word.length > 1 && word === word.toUpperCase()) return word; // Keep existing all-caps words like "DC", "AÇÃO"
      // Handle words with slashes like "ANIMACAO/INFANTIL" -> "Animacao/Infantil"
      return word.split('/').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('/');
    })
    .join(' ');
}


export function processGroupName(rawName?: string): ProcessedGroupName {
  if (!rawName || rawName.trim() === '') {
    return { 
      displayName: DEFAULT_GROUP_NAME, 
      normalizedKey: removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase()) 
    };
  }

  let nameAfterPrefixStrip = rawName.trim();
  const originalFormBeforeSmartCase = nameAfterPrefixStrip; // Keep original form for all-caps check

  for (const pattern of MEDIA_TYPE_PREFIX_PATTERNS) {
    const match = nameAfterPrefixStrip.match(pattern);
    if (match && match[0]) {
      const potentialDisplayName = nameAfterPrefixStrip.substring(match[0].length).trim();
      if (potentialDisplayName.length > 0) {
        nameAfterPrefixStrip = potentialDisplayName;
        break;
      }
    }
  }

  if (nameAfterPrefixStrip === '') {
    nameAfterPrefixStrip = DEFAULT_GROUP_NAME;
  }
  
  // Determine normalized key for rule checking first
  const normalizedKeyForRules = removeDiacritics(nameAfterPrefixStrip.toLowerCase()).trim();
  let finalNormalizedKey = normalizedKeyForRules;
  let finalDisplayName = nameAfterPrefixStrip; // Base display name on this

  // Canonicalization Rules (these set both displayName and can affect finalNormalizedKey)
  const lancamentoKeywords = ["lancamento", "estreia"];
  const cinemaKeywords = ["cinema"];
  let isLancamentoOrCinema = false;
  lancamentoKeywords.forEach(keyword => { if (normalizedKeyForRules.includes(keyword)) isLancamentoOrCinema = true; });
  if (!isLancamentoOrCinema && cinemaKeywords.some(kw => normalizedKeyForRules.includes(kw) && normalizedKeyForRules.split(' ').includes(kw))) {
    isLancamentoOrCinema = true;
  }

  if (isLancamentoOrCinema) {
    finalDisplayName = CANONICAL_LANCAMENTOS_DISPLAY_NAME; // "Lançamentos"
    finalNormalizedKey = CANONICAL_LANCAMENTOS_NORMALIZED_KEY;
  } else {
    const ficcaoFantasiaPatterns = [/^ficcao\s*[e&]\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*[e&]\s*ficcao$/, /^fantasia\/ficcao$/];
    let isFiccaoFantasia = false;
    for (const pattern of ficcaoFantasiaPatterns) {
      if (pattern.test(normalizedKeyForRules)) {
        isFiccaoFantasia = true;
        break;
      }
    }
    if (isFiccaoFantasia) {
      finalDisplayName = CANONICAL_FICCAO_FANTASIA_DISPLAY_NAME; // "Ficção e Fantasia"
      finalNormalizedKey = CANONICAL_FICCAO_FANTASIA_NORMALIZED_KEY;
    } else {
      // Default casing rule: if original (after prefix strip) was all caps, keep it. Else, Smart Title Case.
      // Check against the form *before* any smartTitleCase was applied.
      if (nameAfterPrefixStrip === originalFormBeforeSmartCase && nameAfterPrefixStrip === nameAfterPrefixStrip.toUpperCase() && nameAfterPrefixStrip !== DEFAULT_GROUP_NAME.toUpperCase()) {
         finalDisplayName = nameAfterPrefixStrip; // Keep original ALL CAPS
      } else {
         finalDisplayName = smartTitleCase(nameAfterPrefixStrip);
      }
    }
  }
  
  // Ensure default is handled if somehow empty
  if (finalDisplayName.trim() === '' || finalDisplayName === smartTitleCase(DEFAULT_GROUP_NAME).trim()) {
      finalDisplayName = DEFAULT_GROUP_NAME; // "Uncategorized"
  }
  if (finalNormalizedKey.trim() === '') { // Should use the key derived from rules or initial normalization
      finalNormalizedKey = removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase());
  }

  return { 
    displayName: finalDisplayName, 
    normalizedKey: finalNormalizedKey 
  };
}
