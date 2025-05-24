
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments, ALWAYS UPPERCASE
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, from displayName)
}

const DEFAULT_GROUP_NAME_UPPERCASE = 'UNCATEGORIZED';

// These are broad categories that should not be prefixed with "CANAIS" even if mediaType is channel
const BROAD_CANONICAL_CATEGORIES = ["LANÇAMENTOS", "FICÇÃO E FANTASIA"]; // These are already in uppercase

// Map of normalized core group name variations to their canonical *display* core name (uppercase)
// The values here are the desired form of the *core* part before "CANAIS " is prepended or toUpperCase is applied.
const CANONICAL_CORE_DISPLAY_MAP: Record<string, string> = {
  // Normalization for "Lançamentos"
  "lancamento": "LANÇAMENTOS",
  "estreia": "LANÇAMENTOS",
  "cinema": "LANÇAMENTOS",
  // Normalization for "Ficção e Fantasia"
  "ficcao e fantasia": "FICÇÃO E FANTASIA",
  "ficcao/fantasia": "FICÇÃO E FANTASIA",
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
  // Normalization for "Disney PPV"
  "disney plus": "DISNEY PPV",
  "disney +": "DISNEY PPV",
  "disneyppv": "DISNEY PPV",
  "disney ppv serie b": "DISNEY PPV",
  // Normalization for "HBO MAX"
  "hbo": "HBO MAX",
  "hbo max": "HBO MAX",
  "rede hbo": "HBO MAX",
  // Normalization for "24 Horas"
  "24 horas": "24 HORAS", // Display with space
  "24horas": "24 HORAS",  // Input without space, display with space
  // Normalization for "UHD 4K"
  "uhd": "UHD 4K",
  "uhd 4k": "UHD 4K", // ensure it maps to itself if already correct
  // Normalization for "Telecine"
  "telecine": "TELECINE",
  "rede telecine": "TELECINE",
  // Add other specific mappings here. Key is normalized (lowercase, no diacritics).
};


const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?|LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]*/i,
];

const CHANNEL_SPECIFIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:CANAIS|CANAL)\s*[|I:\-–—]\s*/i,
  /^(?:CANAIS|CANAL)\s+-\s*/i,
  /^(?:CANAIS|CANAL)\s+/i,
];
const MOVIE_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:FILMES?|MOVIES?|VOD\s*FILMES?|COLE[ÇC][ÃA]O\s*DE\s*FILMES?)\s*[|:\-–—\s]*/i,
];
const SERIES_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:S[EÉ]RIES|TVSHOWS?|VOD\s*S[EÉ]RIES?|COLE[ÇC][ÃA]O\s*DE\s*S[EÉ]RIES?)\s*[|:\-–—\s]*/i,
];

function removeDiacritics(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

  // 2. Extract Core Group Name (removing type-specific prefixes and standalone pipes)
  let coreGroupName = nameToProcess;
  const specificPrefixPatterns =
    mediaType === 'channel' ? CHANNEL_SPECIFIC_PREFIX_PATTERNS :
    mediaType === 'movie' ? MOVIE_PREFIX_STRIP_PATTERNS :
    mediaType === 'series' ? SERIES_PREFIX_STRIP_PATTERNS :
    [];

  for (const pattern of specificPrefixPatterns) {
    if (pattern.test(coreGroupName)) {
      coreGroupName = coreGroupName.replace(pattern, '').trim();
      break; 
    }
  }
  // For channels, also replace any remaining pipes with space. For others, this is less common.
  if (mediaType === 'channel') {
    coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim();
  }
  coreGroupName = coreGroupName.replace(/^[-–—:]\s*/, '').trim(); // Remove leading separators if any left

  // 3. Normalize Core Group Name for Matching
  let normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();
   // Specific string replacements on the normalizedCoreForMatching for better map key matching
  if (normalizedCoreForMatching.includes("disney ppv serie b")) {
    normalizedCoreForMatching = "disney ppv serie b";
  } else if (normalizedCoreForMatching.includes("disneyppv")) {
    normalizedCoreForMatching = "disneyppv";
  } else if (normalizedCoreForMatching.includes("disney plus") || normalizedCoreForMatching.includes("disney +")) {
    normalizedCoreForMatching = "disney plus";
  }
  if (normalizedCoreForMatching.includes("24 horas")) {
    normalizedCoreForMatching = "24 horas"; 
  } else if (normalizedCoreForMatching.includes("24horas")) {
    normalizedCoreForMatching = "24horas"; 
  }

  // 4. Map to Canonical Core Display Name (which is already uppercase in the map)
  let canonicalDisplayCore = CANONICAL_CORE_DISPLAY_MAP[normalizedCoreForMatching] || coreGroupName.toUpperCase();

  // 5. Construct finalDisplayName
  let finalDisplayName = canonicalDisplayCore;

  if (mediaType === 'channel') {
    const isBroad = BROAD_CANONICAL_CATEGORIES.includes(canonicalDisplayCore.toUpperCase());
    const coreAlreadyHasChannels = /^(CANAIS|CANAL)\b/i.test(removeDiacritics(canonicalDisplayCore));

    if (!isBroad && canonicalDisplayCore.trim() !== '' && !coreAlreadyHasChannels) {
      finalDisplayName = "CANAIS " + canonicalDisplayCore;
    } else if (canonicalDisplayCore.trim() === '' || (coreAlreadyHasChannels && canonicalDisplayCore.toUpperCase().replace(/\s+/g, '') === "CANAIS")) { 
      finalDisplayName = "CANAIS";
    } else {
      finalDisplayName = canonicalDisplayCore; // It's broad, or already correctly prefixed, or is just the core
    }
  }

  if (!finalDisplayName || finalDisplayName.trim() === '') {
    finalDisplayName = DEFAULT_GROUP_NAME_UPPERCASE;
  }

  // 6. Ensure final display name is entirely uppercase and trimmed
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  // Final specific formatting tweaks
  if (finalDisplayName === "CANAIS 24HORAS") { // If it became this due to map key
      finalDisplayName = "CANAIS 24 HORAS";
  }
  if (finalDisplayName === "CANAIS UHD") { // If it became this
      finalDisplayName = "CANAIS UHD 4K";
  }


  // 7. Generate normalizedKey
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey || removeDiacritics(DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()),
  };
}
