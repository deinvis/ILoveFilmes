
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments, ALWAYS UPPERCASE
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, from displayName)
}

const DEFAULT_GROUP_NAME = 'UNCATEGORIZED'; 

// Canonical core names (used after "REDE" stripping etc.) - these will be uppercased later.
// These are the "ideal" core names we want to map to.
const CN_LANCAMENTOS = "LANÇAMENTOS";
const CN_FICCAO_FANTASIA = "FICÇÃO E FANTASIA";
const CN_GLOBO = "GLOBO";
const CN_INFANTIL = "INFANTIL";
const CN_PREMIERE = "PREMIERE";
const CN_RECORD = "RECORD";


const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?)\s*[|:\-–—]\s*/i,
  /^(?:LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]?/i,
];

const CHANNEL_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:CANAIS|CANAL)\s*[|I:\-–—]\s*/i, 
  /^(?:CANAIS|CANAL)\s+/i, 
];
const MOVIE_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:FILMES?|MOVIES?|VOD\s*FILMES?|COLE[ÇC][ÃA]O\s*DE\s*FILMES?)\s*[|:\-–—]\s*/i,
];
const SERIES_PREFIX_STRIP_PATTERNS: RegExp[] = [
  /^(?:S[EÉ]RIES|TVSHOWS?|VOD\s*S[EÉ]RIES?|COLE[ÇC][ÃA]O\s*DE\s*S[EÉ]RIES?)\s*[|:\-–—]\s*/i,
];

function removeDiacritics(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function smartTitleCase(str: string): string {
  if (!str) return str;
  // Preserve already all-caps words if they are short or common acronyms
  if (/^[A-Z0-9\s]+$/.test(str) && (str.length <= 4 || ["UFC", "NBA", "NFL", "ESPN", "HBO", "MTV", "TNT", "SBT", "GNT"].includes(str))) {
    return str;
  }
  return str
    .split(/\s+/)
    .map(word => {
      if (word.length > 0) {
        if (/^[A-Z0-9]+$/.test(word) && (word.length <= 3 || ["UFC", "NBA", "NFL", "ESPN", "HBO", "MTV", "TNT", "SBT", "GNT"].includes(word.toUpperCase()))) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
      }
      return '';
    })
    .join(' ');
}


export function processGroupName(rawGroupNameInput?: string, mediaType?: MediaType): ProcessedGroupName {
  let nameToProcess = (rawGroupNameInput || '').trim();
  if (!nameToProcess) {
    nameToProcess = DEFAULT_GROUP_NAME;
  }

  for (const pattern of GENERIC_PREFIX_PATTERNS) {
    nameToProcess = nameToProcess.replace(pattern, '').trim();
  }

  let coreGroupName = nameToProcess;
  const originalCoreWasAllCaps = /^[A-Z0-9\s\W_]+$/.test(coreGroupName) && coreGroupName.length > 1 && !coreGroupName.includes('|');


  if (mediaType === 'channel') {
    for (const pattern of CHANNEL_PREFIX_STRIP_PATTERNS) {
      if (pattern.test(coreGroupName)) {
        coreGroupName = coreGroupName.replace(pattern, '').trim();
        break;
      }
    }
    if (removeDiacritics(coreGroupName.toLowerCase()) === "canais" || removeDiacritics(coreGroupName.toLowerCase()) === "canal") {
        coreGroupName = ""; // Will default to "CANAIS" later
    }
  } else if (mediaType === 'movie') {
    for (const pattern of MOVIE_PREFIX_STRIP_PATTERNS) {
      coreGroupName = coreGroupName.replace(pattern, '').trim();
    }
  } else if (mediaType === 'series') {
    for (const pattern of SERIES_PREFIX_STRIP_PATTERNS) {
      coreGroupName = coreGroupName.replace(pattern, '').trim();
    }
  }
  
  let normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();
  let processedCoreName = coreGroupName; // This will hold the cased version of the core

  // Singularize and normalize specific known plurals
  if (normalizedCoreForMatching.endsWith("s") && normalizedCoreForMatching.length > 1) {
    const singularAttempt = normalizedCoreForMatching.slice(0, -1);
    if (singularAttempt === "globo") { 
      processedCoreName = CN_GLOBO; normalizedCoreForMatching = "globo";
    } else if (singularAttempt === "infantil") { 
      processedCoreName = CN_INFANTIL; normalizedCoreForMatching = "infantil";
    }
  }
  
  // Normalize "rede xxx"
  if (normalizedCoreForMatching.startsWith("rede ")) {
    const afterRede = normalizedCoreForMatching.substring(5).trim();
    if (afterRede === "premiere") {
      processedCoreName = CN_PREMIERE; normalizedCoreForMatching = "premiere";
    } else if (afterRede === "record") {
      processedCoreName = CN_RECORD; normalizedCoreForMatching = "record";
    }
  }

  // Broad canonical categories (these don't get "CANAIS " prepended if they are for channels)
  let isBroadCanonical = false;
  if (["lancamento", "estreia", "cinema"].some(kw => normalizedCoreForMatching.includes(kw))) {
    processedCoreName = CN_LANCAMENTOS; isBroadCanonical = true;
  } else if ([/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/].some(p => p.test(normalizedCoreForMatching))) {
    processedCoreName = CN_FICCAO_FANTASIA; isBroadCanonical = true;
  } 
  // Specific item canonicals (these DO get "CANAIS " prepended if they are for channels)
  else if (normalizedCoreForMatching === "globo") { processedCoreName = CN_GLOBO; }
  else if (normalizedCoreForMatching === "infantil") { processedCoreName = CN_INFANTIL; }
  else if (normalizedCoreForMatching === "premiere") { processedCoreName = CN_PREMIERE; }
  else if (normalizedCoreForMatching === "record") { processedCoreName = CN_RECORD; }
  
  // Apply smart casing if not broadly canonical and not originally all caps
  if (!isBroadCanonical) {
    if (originalCoreWasAllCaps && processedCoreName.length > 0 && processedCoreName.length < 25) {
      // Already uppercased from original or assignment, or will be uppercased later
    } else {
      processedCoreName = smartTitleCase(processedCoreName);
    }
  }

  let finalDisplayName;
  if (mediaType === 'channel') {
    if (processedCoreName.trim() === '') { 
        finalDisplayName = "CANAIS";
    } else {
        const coreLowerNoDiacritics = removeDiacritics(processedCoreName.toLowerCase());
        const alreadyHasChannelsPrefix = coreLowerNoDiacritics.startsWith("canais") || coreLowerNoDiacritics.startsWith("canal");
        
        if (isBroadCanonical) { // Broad categories like "Lançamentos" should not get "CANAIS "
            finalDisplayName = processedCoreName;
        } else if (alreadyHasChannelsPrefix) {
            finalDisplayName = processedCoreName;
        } else {
            finalDisplayName = "CANAIS " + processedCoreName;
        }
    }
  } else { 
    finalDisplayName = processedCoreName.trim() === '' ? DEFAULT_GROUP_NAME : processedCoreName;
  }
  
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  if (finalDisplayName === '') finalDisplayName = DEFAULT_GROUP_NAME; 

  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();
  
  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey,
  };
}
