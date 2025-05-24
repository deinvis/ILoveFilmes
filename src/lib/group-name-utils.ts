
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments (cleaned, original-like casing)
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed)
}

// Patterns to match prefixes like "MOVIES | ", "CHANNELS - ", "SERIES : ", etc.
// They aim to capture the prefix part including the separator to strip it.
const MEDIA_TYPE_PREFIX_PATTERNS: RegExp[] = [
  /^(?:filmes?|movies?|s[eé]ries|tvshows?|canais|channels|vod|live|iptv|adulto(?:s)?|kids|infantil|esportes|noticias|document[aá]rios|uhd|fhd|sd|hd|4k|24h)\s*[|:-]\s*/i,
  // More complex/combined prefixes could be added if needed, e.g. /^(?:canais\s+esportes)\s*[|:-]\s*/i
];

const DEFAULT_GROUP_NAME = 'Uncategorized';

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
 * 2. Attempts to strip common media type or quality prefixes (e.g., "MOVIES | ", "CANAIS UHD - ").
 * 3. The result of stripping (or the original trimmed name if no prefix matched) is the `displayName`.
 * 4. The `displayName` is then lowercased, diacritics are removed, and it's trimmed to produce the `normalizedKey`.
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

  let nameForDisplay = rawName.trim();

  for (const pattern of MEDIA_TYPE_PREFIX_PATTERNS) {
    const match = nameForDisplay.match(pattern);
    if (match && match[0]) {
      const potentialDisplayName = nameForDisplay.substring(match[0].length).trim();
      if (potentialDisplayName.length > 0) {
        nameForDisplay = potentialDisplayName;
        break;
      }
    }
  }

  if (nameForDisplay === '') {
    nameForDisplay = DEFAULT_GROUP_NAME;
  }

  let normalizedKey = nameForDisplay.toLowerCase();
  normalizedKey = removeDiacritics(normalizedKey);
  normalizedKey = normalizedKey.trim();


  return {
    displayName: nameForDisplay, // Preserves casing of the cleaned or original name
    normalizedKey: normalizedKey === '' ? removeDiacritics(DEFAULT_GROUP_NAME.toLowerCase()) : normalizedKey,
  };
}

