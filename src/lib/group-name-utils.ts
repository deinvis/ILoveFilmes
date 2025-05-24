
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, from displayName)
}

const DEFAULT_GROUP_NAME_UPPERCASE = 'UNCATEGORIZED';

// Broad categories - these will be used as is and NOT prefixed by "CANAIS" etc.
const BROAD_CANONICAL_CATEGORIES_MAP: Record<string, string> = {
  "lancamentos": "LANÇAMENTOS",
  "estreias": "LANÇAMENTOS",
  "cinema": "LANÇAMENTOS",
  "ficcao e fantasia": "FICÇÃO E FANTASIA",
  "ficcao/fantasia": "FICÇÃO E FANTASIA",
};

// Map of normalized core group name variations to their canonical *display* core name.
// The values here are the desired form of the *core* part before "CANAIS " is prepended or toUpperCase is applied.
// These keys should be lowercase and without diacritics. Values are the target display form.
const CANONICAL_CORE_DISPLAY_MAP: Record<string, string> = {
  // For Channels
  "globo": "GLOBO",
  "globos": "GLOBO",
  "infantil": "INFANTIS", // Target display name
  "infantis": "INFANTIS",
  "premiere": "PREMIERE",
  "rede premiere": "PREMIERE",
  "record": "RECORD",
  "rede record": "RECORD",
  "disney plus": "DISNEY PPV",
  "disney +": "DISNEY PPV",
  "disneyppv": "DISNEY PPV",
  "disney ppv serie b": "DISNEY PPV",
  "disney ppv i serie b": "DISNEY PPV",
  "hbo": "HBO MAX",
  "hbo max": "HBO MAX",
  "rede hbo": "HBO MAX",
  "ppv hbo max": "HBO MAX",
  "24 horas": "24 HORAS", // Note the space for display
  "24horas": "24 HORAS",
  "uhd": "UHD 4K",
  "uhd 4k": "UHD 4K",
  "telecine": "TELECINE",
  "rede telecine": "TELECINE",
  "ppv esportes": "PAY-PER-VIEW", // Consolidating under PAY-PER-VIEW

  // For Movies/Series (some might overlap, specific logic for mediaType handles it)
  "lancamentos cinema": "LANÇAMENTOS", // Broad category
  "lancamentos legendados": "LANÇAMENTOS", // Broad category
  // "acao": "AÇÃO" - handled by toUpperCase
  // "comedia": "COMÉDIA" - handled by toUpperCase + diacritics
};

const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?|LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]*/i,
];

// Prefixes to strip to get the "core" name for channels
const CHANNEL_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:CANAIS|CANAL)\s*[|I:\-–—]\s*/i,
  /^(?:CANAIS|CANAL)\s+-\s*/i,
  /^(?:CANAIS|CANAL)\s+/i,
];

// Prefixes to strip for movies/series IF there is no '|' to split by first
const MOVIE_SERIES_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:FILMES?|S[EÉ]RIES|MOVIES?|TVSHOWS?|VOD\s*(?:FILMES?|S[EÉ]RIES?)|COLE[ÇC][ÃA]O\s*DE\s*(?:FILMES?|S[EÉ]RIES?))\s*[|:\-–—\s]*/i,
];

function removeDiacritics(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function smartTitleCase(str: string): string {
  if (!str || str.trim() === '') return '';
  // If the string is all uppercase (and not just 1-2 chars like "4K" or "DC"), convert to title case
  // Otherwise, assume it's already mixed case or correctly cased.
  const isLikelyAcronymOrShortCode = /^[A-Z0-9\s\/&-]{1,4}$/.test(str.trim());
  const isAllCaps = str === str.toUpperCase();

  if (isAllCaps && !isLikelyAcronymOrShortCode && str.length > 4) {
    return str.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
  }
  // For already mixed-case or short all-caps, just ensure first letter is capital if it's a single word
  if (!str.includes(' ') && str.length > 0) {
     //return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(); // simpler title case for single words
  }
  // This part is tricky; for now, the main capitalization will be toUpperCase at the end.
  // The purpose here was to make "ANIMACAO/INFANTIL" from "animacao/infantil" but toUpperCase handles the final output.
  return str; // Return as is for now, rely on toUpperCase later
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

  let coreGroupName = nameToProcess;

  // 2. Media Type Specific Cleaning to get coreGroupName
  if (mediaType === 'channel') {
    let matchedChannelPrefix = false;
    for (const pattern of CHANNEL_PREFIX_STRIP_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        matchedChannelPrefix = true;
        break;
      }
    }
    // If no "CANAIS" prefix was found, also clean up pipes for channels
    if (!matchedChannelPrefix) {
        coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim();
    }
    coreGroupName = coreGroupName.replace(/^[-–—:]\s*/, '').trim();

  } else if (mediaType === 'movie' || mediaType === 'series') {
    const pipeIndex = coreGroupName.indexOf('|');
    if (pipeIndex !== -1) {
        coreGroupName = coreGroupName.substring(pipeIndex + 1).trim();
    } else {
        for (const pattern of MOVIE_SERIES_PREFIX_STRIP_PATTERNS) {
            if (pattern.test(coreGroupName)) {
                coreGroupName = coreGroupName.replace(pattern, '').trim();
                break;
            }
        }
    }
    coreGroupName = coreGroupName.replace(/^[-–—:]\s*/, '').trim();
  }


  // 3. Normalize coreGroupName for matching canonicals (lowercase, no diacritics)
  const normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();

  // 4. Map to Canonical Core Display Name OR use the cleaned coreGroupName
  let canonicalCoreName = CANONICAL_CORE_DISPLAY_MAP[normalizedCoreForMatching] || coreGroupName;

  // Check for broad categories after attempting specific canonical mapping
  const broadCanonicalCategory = BROAD_CANONICAL_CATEGORIES_MAP[normalizedCoreForMatching];
  if (broadCanonicalCategory) {
    canonicalCoreName = broadCanonicalCategory; // Broad categories override others if matched
  }

  let finalDisplayName = canonicalCoreName.trim();

  // 5. Prefix "CANAIS " for channels if not a broad category and if needed
  if (mediaType === 'channel' &&
      finalDisplayName &&
      finalDisplayName !== DEFAULT_GROUP_NAME_UPPERCASE &&
      !Object.values(BROAD_CANONICAL_CATEGORIES_MAP).includes(finalDisplayName.toUpperCase()) // Check against uppercased broad map values
    ) {
    const normalizedFinalDisplayNameCheck = removeDiacritics(finalDisplayName.toLowerCase());
    if (!normalizedFinalDisplayNameCheck.startsWith("canais") && !normalizedFinalDisplayNameCheck.startsWith("canal")) {
      finalDisplayName = "CANAIS " + finalDisplayName;
    }
  }

  if (!finalDisplayName.trim() || finalDisplayName === DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()) {
    finalDisplayName = mediaType === 'channel' ? "CANAIS" : DEFAULT_GROUP_NAME_UPPERCASE;
  }
  
  // 6. Final conversion to ALL CAPS for display
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  if (finalDisplayName === "CANAIS UNCATEGORIZED") { // Fix potential "CANAIS UNCATEGORIZED"
      finalDisplayName = "CANAIS";
  }
  if (finalDisplayName === "" && mediaType === 'channel') { // Ensure channel groups are not empty
      finalDisplayName = "CANAIS";
  }


  // 7. Generate normalizedKey from the final display name
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();

  return {
    displayName: finalDisplayName || DEFAULT_GROUP_NAME_UPPERCASE,
    normalizedKey: normalizedKey || removeDiacritics(DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()),
  };
}
