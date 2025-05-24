
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments (cleaned, original-like casing)
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, canonicalized)
}

// Patterns to match prefixes like "MOVIES | ", "CHANNELS - ", "SERIES : ", etc.
const MEDIA_TYPE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|s[eé]ries|tvshows?|canais|channels|vod|live|iptv|adulto(?:s)?|kids|infantil|esportes|noticias|document[aá]rios|uhd|fhd|sd|hd|4k|24h|24\/7|desenhos?)\s*[|:\-–—]\s*/i,
  // For prefixes that might just be the type itself without a clear separator, e.g., "CANAIS" followed by category.
  // This needs to be less greedy if types can be part of category names.
  // Example: "CANAIS ESPORTES" -> should probably become "ESPORTES"
  // For now, the separator is quite crucial.
];

const DEFAULT_GROUP_NAME = 'Uncategorized';
const CANONICAL_LANCAMENTOS_DISPLAY_NAME = "Lançamentos";
const CANONICAL_LANCAMENTOS_NORMALIZED_KEY = removeDiacritics(CANONICAL_LANCAMENTOS_DISPLAY_NAME.toLowerCase());


/**
 * Removes diacritics (accents) from a string.
 * @param str The input string.
 * @returns The string without diacritics.
 */
function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Processes a raw group name to produce a display-friendly version and a normalized key for grouping.
 * 1. Trims the raw name.
 * 2. Attempts to strip common media type or quality prefixes.
 * 3. Applies canonicalization rules (e.g., grouping "cinema" and "lançamentos" together).
 * 4. The result of stripping/canonicalization is the `displayName`.
 * 5. The `displayName` is then lowercased, diacritics are removed, and it's trimmed to produce the `normalizedKey` (if not already set by canonicalization).
 * @param rawName The raw group name from M3U (e.g., item.groupTitle or item.genre).
 * @returns An object with `displayName` and `normalizedKey`.
 */
export function processGroupName(rawName?: string): ProcessedGroupName {
  if (!rawName || rawName.trim() === '') {
    return {
      displayName: DEFAULT_GROUP_NAME,
      normalizedKey: removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase())
    };
  }

  let nameForProcessing = rawName.trim();

  for (const pattern of MEDIA_TYPE_PREFIX_PATTERNS) {
    const match = nameForProcessing.match(pattern);
    if (match && match[0]) {
      const potentialDisplayName = nameForProcessing.substring(match[0].length).trim();
      if (potentialDisplayName.length > 0) {
        nameForProcessing = potentialDisplayName;
        // Important: Only strip one prefix. If a category is "FILMES | AÇÃO | AVENTURA",
        // we'd get "AÇÃO | AVENTURA". Subsequent canonicalization might handle this further if needed.
        break;
      }
    }
  }

  // If after stripping prefixes, the name is empty, default to Uncategorized.
  if (nameForProcessing === '') {
    nameForProcessing = DEFAULT_GROUP_NAME;
  }

  let finalDisplayName = nameForProcessing;
  let finalNormalizedKey = removeDiacritics(nameForProcessing.toLowerCase()).trim();

  // Canonicalization Rules
  const tempNormalizedForRules = finalNormalizedKey; // Already lowercase, diacritic-free, trimmed

  // Rule for Lançamentos/Cinema
  const lancamentoKeywords = ["lancamento", "estreia"]; // "lancamentos" will be caught by "lancamento"
  const cinemaKeywords = ["cinema"]; // "cinemas" could be added if needed

  let isLancamentoOrCinema = false;
  for (const keyword of lancamentoKeywords) {
    if (tempNormalizedForRules.includes(keyword)) {
      isLancamentoOrCinema = true;
      break;
    }
  }
  if (!isLancamentoOrCinema) {
    // Check for "cinema" explicitly, or if it's part of a short phrase like "nos cinemas"
    // or "lancamentos cinema".
    // If `tempNormalizedForRules` directly is "cinema", it's a match.
    // If it *contains* "cinema" and is related to releases, it should also match.
    // The `includes("lancamento")` above already catches "lancamentos cinema".
    if (tempNormalizedForRules === "cinema" || cinemaKeywords.some(kw => tempNormalizedForRules.includes(kw))) {
        // Adding more specific check for "cinema" to not over-match,
        // e.g. "Cinema de Arte" should not become "Lançamentos".
        // If group name IS "cinema", or *starts with* "cinema" followed by generic terms.
        // This is tricky. Let's keep it simple: if it includes 'cinema' and wasn't already a 'lancamento'.
        // The previous `lancamentoKeywords.includes("lancamento")` would catch "lancamentos cinema".
        // So, this `cinemaKeywords` check is mostly for groups that are *just* "Cinema" or similar.
         if (cinemaKeywords.some(kw => tempNormalizedForRules.split(' ').includes(kw))) { // Check if 'cinema' is a whole word
            isLancamentoOrCinema = true;
         }
    }
  }

  if (isLancamentoOrCinema) {
    finalDisplayName = CANONICAL_LANCAMENTOS_DISPLAY_NAME;
    finalNormalizedKey = CANONICAL_LANCAMENTOS_NORMALIZED_KEY;
  }
  
  // Add other canonicalization rules here if needed, e.g.:
  // const animacaoInfantilKeywords = ["animacao/infantil", "infantil/animacao"];
  // if (animacaoInfantilKeywords.includes(tempNormalizedForRules)) {
  //   finalDisplayName = "Animação e Infantil";
  //   finalNormalizedKey = "animacao e infantil";
  // }


  // Fallback if keys are somehow empty after all processing
  if (finalDisplayName.trim() === '') {
    finalDisplayName = DEFAULT_GROUP_NAME;
  }
  if (finalNormalizedKey.trim() === '') {
    finalNormalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim() || removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase());
  }

  return {
    displayName: finalDisplayName,
    normalizedKey: finalNormalizedKey,
  };
}
