
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
const BROAD_CANONICAL_CATEGORIES = ["LANÇAMENTOS", "FICÇÃO E FANTASIA"];

// Map of normalized core group name variations to their canonical *display* core name
// The values here are the desired form of the *core* part before "CANAIS " is prepended or toUpperCase is applied.
const CANONICAL_CORE_DISPLAY_MAP: Record<string, string> = {
  "lancamento": "Lançamentos",
  "estreia": "Lançamentos",
  "cinema": "Lançamentos",
  "ficcao e fantasia": "Ficção e Fantasia",
  "ficcao/fantasia": "Ficção e Fantasia",
  "globo": "GLOBO",
  "globos": "GLOBO",
  "infantil": "INFANTIS", // Display plural
  "infantis": "INFANTIS",
  "premiere": "PREMIERE",
  "rede premiere": "PREMIERE",
  "record": "RECORD",
  "rede record": "RECORD",
  "disney plus": "DISNEY PPV",
  "disney +": "DISNEY PPV",
  "disneyppv": "DISNEY PPV",
  "disney ppv serie b": "DISNEY PPV", // Specific case
  "hbo": "HBO MAX",
  "hbo max": "HBO MAX",
  "rede hbo": "HBO MAX",
  "24 horas": "24 HORAS", // Display with space
  "24horas": "24 HORAS", // Display with space
  "uhd": "UHD 4K",
  // Add other specific mappings here. Key is normalized (lowercase, no diacritics).
};


const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?|LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]*/i,
];

// Prefixes specific to media types, typically including the type name itself
const CHANNEL_SPECIFIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:CANAIS|CANAL)\s*[|I:\-–—]\s*/i, // "CANAIS | ", "CANAL I ", etc.
  /^(?:CANAIS|CANAL)\s+-\s*/i,      // "CANAIS - ", "CANAL - "
  /^(?:CANAIS|CANAL)\s+/i,          // "CANAIS ", "CANAL " (space after)
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

  // 2. Extract Core Group Name (removing type-specific prefixes and standalone pipes if not channels)
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
  // For channels, replace pipe with space. For others, remove entirely (already handled by prefix strip)
  if (mediaType === 'channel') {
    coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim();
  }


  // 3. Normalize Core Group Name for Matching
  let normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();
   // Specific string replacements on the normalizedCoreForMatching for better matching
  if (normalizedCoreForMatching.includes("disney ppv serie b")) { // more specific first
    normalizedCoreForMatching = "disney ppv serie b";
  } else if (normalizedCoreForMatching.includes("disneyppv")) {
    normalizedCoreForMatching = "disneyppv";
  } else if (normalizedCoreForMatching.includes("disney plus") || normalizedCoreForMatching.includes("disney +")) {
    normalizedCoreForMatching = "disney plus"; // Normalize to one form for map key
  }
  if (normalizedCoreForMatching.includes("24 horas")) {
    normalizedCoreForMatching = "24 horas"; // Keep space for map key
  } else if (normalizedCoreForMatching.includes("24horas")) {
    normalizedCoreForMatching = "24horas"; // Keep no space for map key
  }


  // 4. Map to Canonical Core Display Name
  let canonicalDisplayCore = coreGroupName; // Default to the cleaned coreGroupName

  if (CANONICAL_CORE_DISPLAY_MAP[normalizedCoreForMatching]) {
    canonicalDisplayCore = CANONICAL_CORE_DISPLAY_MAP[normalizedCoreForMatching];
  }
  // Fallback for keywords if direct map match fails (e.g., "Lançamentos de Cinema" -> "Lançamentos")
  else if (["lancamento", "estreia", "cinema"].some(kw => normalizedCoreForMatching.includes(kw))) {
    canonicalDisplayCore = CANONICAL_CORE_DISPLAY_MAP["lancamento"];
  }
  else if (["ficcao e fantasia", "ficcao/fantasia"].some(kw => normalizedCoreForMatching.includes(kw))) {
    canonicalDisplayCore = CANONICAL_CORE_DISPLAY_MAP["ficcao e fantasia"];
  }


  // 5. Construct finalDisplayName
  let finalDisplayName = canonicalDisplayCore;

  if (mediaType === 'channel') {
    const isBroadCategory = BROAD_CANONICAL_CATEGORIES.includes(canonicalDisplayCore.toUpperCase());
    const coreAlreadyHasChannels = /^(CANAIS|CANAL)\b/i.test(removeDiacritics(canonicalDisplayCore));

    if (!isBroadCategory && canonicalDisplayCore.trim() !== '' && !coreAlreadyHasChannels) {
      finalDisplayName = "CANAIS " + canonicalDisplayCore;
    } else if (canonicalDisplayCore.trim() === '' || (coreAlreadyHasChannels && canonicalDisplayCore.trim().length <= "CANAIS".length +1 )) { // handles "CANAIS" or "CANAL" alone
      finalDisplayName = "CANAIS";
    } else {
      finalDisplayName = canonicalDisplayCore; // It's broad, or already has "CANAIS", or is just "CANAIS"
    }
  }

  if (!finalDisplayName || finalDisplayName.trim() === '') {
    finalDisplayName = DEFAULT_GROUP_NAME_UPPERCASE;
  }

  // 6. Convert to Uppercase and trim
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  // Ensure "24 HORAS" has a space if it became "24HORAS" due to earlier processing
  if (finalDisplayName.endsWith("24HORAS") && !finalDisplayName.endsWith(" 24HORAS")) {
      finalDisplayName = finalDisplayName.replace("24HORAS", "24 HORAS");
  }


  // 7. Generate normalizedKey
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey || removeDiacritics(DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()),
  };
}
