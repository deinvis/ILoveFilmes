
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments, ALWAYS UPPERCASE
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, from displayName)
}

const DEFAULT_GROUP_NAME_UPPERCASE = 'UNCATEGORIZED';

// Broad categories that should NOT be prefixed with "CANAIS" if mediaType is channel,
// and should retain their specific casing from this map.
const BROAD_CANONICAL_CATEGORIES_MAP: Record<string, string> = {
  "lancamentos": "LANÇAMENTOS",
  "estreias": "LANÇAMENTOS",
  "cinema": "LANÇAMENTOS", // Typically 'movie' type, but if a channel group is named this
  "ficcao e fantasia": "FICÇÃO E FANTASIA",
  "ficcao/fantasia": "FICÇÃO E FANTASIA",
};

// Map of normalized core group name variations to their canonical *display* core name (ALL CAPS).
// The values here are the desired form of the *core* part before "CANAIS " is prepended or toUpperCase is applied.
const CANONICAL_CORE_DISPLAY_MAP: Record<string, string> = {
  // Normalization for "Globo"
  "globo": "GLOBO",
  "globos": "GLOBO",
  // Normalization for "Infantis"
  "infantil": "INFANTIS",
  "infantis": "INFANTIS",
  // Normalization for "Premiere"
  "premiere": "PREMIERE",
  "rede premiere": "PREMIERE",
  // Normalization for "Record"
  "record": "RECORD",
  "rede record": "RECORD",
  // Normalization for "Disney PPV" (and Serie B variant)
  "disney plus": "DISNEY PPV",
  "disney +": "DISNEY PPV",
  "disneyppv": "DISNEY PPV",
  "disney ppv serie b": "DISNEY PPV", // Consolidate "Serie B" under main Disney PPV
  "disney ppv i serie b": "DISNEY PPV", // Another variant
  // Normalization for "HBO MAX"
  "hbo": "HBO MAX",
  "hbo max": "HBO MAX",
  "rede hbo": "HBO MAX",
  "ppv hbo max": "HBO MAX", // Consolidate PPV HBO MAX
  // Normalization for "24 Horas"
  "24 horas": "24 HORAS",
  "24horas": "24 HORAS",
  // Normalization for "UHD 4K"
  "uhd": "UHD 4K",
  "uhd 4k": "UHD 4K",
  // Normalization for "Telecine"
  "telecine": "TELECINE",
  "rede telecine": "TELECINE",
  // Normalization for "PPV Esportes"
  "ppv esportes": "PAY-PER-VIEW", // Group general PPV sports under PAY-PER-VIEW
  // Other specific mappings can be added here. Key is normalized (lowercase, no diacritics).
};

const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?|LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]*/i,
];

// Prefixes to strip for channels to get the "core" name, also removes the pipe
const CHANNEL_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:CANAIS|CANAL)\s*[|I:\-–—]\s*/i, // "CANAIS | ", "CANAL I "
  /^(?:CANAIS|CANAL)\s+-\s*/i,          // "CANAIS - "
  /^(?:CANAIS|CANAL)\s+/i,              // "CANAIS " (if followed by more)
];

// Prefixes to strip for movies/series
const MOVIE_SERIES_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:FILMES?|S[EÉ]RIES|MOVIES?|TVSHOWS?|VOD\s*(?:FILMES?|S[EÉ]RIES?)|COLE[ÇC][ÃA]O\s*DE\s*(?:FILMES?|S[EÉ]RIES?))\s*[|:\-–—\s]*/i,
];


function removeDiacritics(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function smartTitleCase(str: string): string {
  if (!str) return '';
  // Convert to lowercase then capitalize words, preserving all-caps words (2+ chars)
  return str.toLowerCase().replace(/\b(\w)|[A-Z]{2,}\b/g, (match, firstLetter) => {
    if (firstLetter) return firstLetter.toUpperCase(); // First letter of a word
    if (match.length >= 2) return match; // All caps word (like DC, UFC)
    return match.toUpperCase(); 
  });
}


export function processGroupName(rawGroupNameInput?: string, mediaType?: MediaType): ProcessedGroupName {
  let nameToProcess = (rawGroupNameInput || '').trim();
  if (!nameToProcess) {
    nameToProcess = DEFAULT_GROUP_NAME_UPPERCASE;
  }

  // 1. Initial generic prefix cleaning
  for (const pattern of GENERIC_PREFIX_PATTERNS) {
    nameToProcess = nameToProcess.replace(pattern, '').trim();
  }

  // 2. Extract Core Group Name
  let coreGroupName = nameToProcess;
  const specificPrefixPatterns =
    mediaType === 'channel' ? CHANNEL_PREFIX_STRIP_PATTERNS :
    (mediaType === 'movie' || mediaType === 'series') ? MOVIE_SERIES_PREFIX_STRIP_PATTERNS :
    [];

  for (const pattern of specificPrefixPatterns) {
    if (pattern.test(coreGroupName)) {
      coreGroupName = coreGroupName.replace(pattern, '').trim();
      // For channels, we might have removed "CANAIS " but "GLOBO" remains.
      // For others, like "FILMES | AÇÃO", coreGroupName becomes "AÇÃO".
      break;
    }
  }
  // For channels, also explicitly remove standalone pipes if any pattern missed them
  if (mediaType === 'channel') {
    coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim();
  }
  coreGroupName = coreGroupName.replace(/^[-–—:]\s*/, '').trim();


  // 3. Normalize Core Group Name for Matching (lowercase, no diacritics)
  const normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();

  // 4. Map to Canonical Display Name (which are ALL CAPS in the map values)
  // First check broad categories (which have specific casing and are not prefixed by "CANAIS ")
  const broadCanonicalName = BROAD_CANONICAL_CATEGORIES_MAP[normalizedCoreForMatching];

  let finalDisplayName: string;

  if (broadCanonicalName && mediaType === 'channel') { // Broad categories apply as-is for channels.
    finalDisplayName = broadCanonicalName;
  } else {
    // Apply core specific canonical map, or use the processed coreGroupName
    let canonicalCoreNamePart = CANONICAL_CORE_DISPLAY_MAP[normalizedCoreForMatching] || coreGroupName.toUpperCase();

    if (mediaType === 'channel') {
      if (canonicalCoreNamePart && canonicalCoreNamePart.trim() !== '' && canonicalCoreNamePart !== DEFAULT_GROUP_NAME_UPPERCASE) {
        // Check if the core name itself (after canonical map) already starts with "CANAIS"
        // This handles cases where a canonical name might be like "CANAIS ESPECIAIS"
        if (!/^CANAIS(\s|$)/i.test(removeDiacritics(canonicalCoreNamePart))) {
          finalDisplayName = "CANAIS " + canonicalCoreNamePart;
        } else {
          finalDisplayName = canonicalCoreNamePart;
        }
      } else {
        // If coreGroupName was empty after stripping, or it mapped to empty, default to "CANAIS"
        finalDisplayName = "CANAIS";
      }
    } else { // For movies and series
      finalDisplayName = canonicalCoreNamePart || DEFAULT_GROUP_NAME_UPPERCASE;
    }
  }

  // 5. Final pass to ensure ALL CAPS and trim.
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  if (!finalDisplayName) { // Should not happen if DEFAULT_GROUP_NAME_UPPERCASE is set
      finalDisplayName = DEFAULT_GROUP_NAME_UPPERCASE;
  }
  
  // 6. Generate normalizedKey from the final display name
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey || removeDiacritics(DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()),
  };
}
