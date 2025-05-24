
/**
 * @fileOverview Utility functions for processing and normalizing group names.
 */
import type { MediaType } from '@/types';

interface ProcessedGroupName {
  displayName: string; // Name suitable for display and URL segments, ALWAYS UPPERCASE
  normalizedKey: string; // Name suitable for internal grouping logic (lowercase, trimmed, diacritics removed, from displayName)
}

const DEFAULT_GROUP_NAME_UPPERCASE = 'UNCATEGORIZED';

// Canonical constants for core group names (these will be the final form of the "core" part)
const CN_LANCAMENTOS = "LANÇAMENTOS";
const CN_FICCAO_FANTASIA = "FICÇÃO E FANTASIA";
const CN_GLOBO = "GLOBO";
const CN_INFANTIS = "INFANTIS"; // Changed from INFANTIL
const CN_PREMIERE = "PREMIERE";
const CN_RECORD = "RECORD";
const CN_DISNEY_PPV = "DISNEY PPV";
const CN_HBO_MAX = "HBO MAX";
const CN_24HORAS = "24HORAS";


const GENERIC_PREFIX_PATTERNS: RegExp[] = [
  /^(?:TODOS\s*OS\s*G[ÊE]NEROS|ALL\s*GENRES|CATEGORIAS?|LISTA|GRUPO|CATEGORIA)\s*[|:\-–—\s]*/i,
];

// Prefixes more specific to channels, often including "CANAIS" or "CANAL"
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

  // 2. Extract Core Group Name (removing type-specific prefixes and standalone pipes)
  let coreGroupName = nameToProcess;
  const specificPrefixPatterns =
    mediaType === 'channel' ? CHANNEL_SPECIFIC_PREFIX_PATTERNS :
    mediaType === 'movie' ? MOVIE_PREFIX_STRIP_PATTERNS :
    mediaType === 'series' ? SERIES_PREFIX_STRIP_PATTERNS :
    [];

  for (const pattern of specificPrefixPatterns) {
    if (pattern.test(coreGroupName)) { // Check if pattern matches before replacing
      coreGroupName = coreGroupName.replace(pattern, '').trim();
      break; // Often, only one specific prefix applies
    }
  }
  coreGroupName = coreGroupName.replace(/\s*\|\s*/g, ' ').trim(); // Replace remaining pipes with space


  // 3. Pre-Normalization for Specific String Manipulations on the core name
  let normalizedCoreForMatching = removeDiacritics(coreGroupName.toLowerCase()).trim();
  
  if (normalizedCoreForMatching.includes("24 horas")) {
    normalizedCoreForMatching = normalizedCoreForMatching.replace(/\s*24\s*horas/g, CN_24HORAS.toLowerCase());
  }
  
  // 4. Canonicalization Mapping (using normalizedCoreForMatching)
  let canonicalCoreName = coreGroupName; // Start with the cleaned coreGroupName

  if (["lancamento", "estreia", "cinema"].some(kw => normalizedCoreForMatching.includes(kw))) {
    canonicalCoreName = CN_LANCAMENTOS;
  } else if ([/^ficcao\s*e\s*fantasia$/, /^ficcao\/fantasia$/, /^fantasia\s*e\s*ficcao$/, /^fantasia\/ficcao$/].some(p => p.test(normalizedCoreForMatching))) {
    canonicalCoreName = CN_FICCAO_FANTASIA;
  } else if (normalizedCoreForMatching === "globo" || normalizedCoreForMatching === "globos") {
    canonicalCoreName = CN_GLOBO;
  } else if (normalizedCoreForMatching === "infantil" || normalizedCoreForMatching === "infantis") {
    canonicalCoreName = CN_INFANTIS;
  } else if (normalizedCoreForMatching === "premiere" || normalizedCoreForMatching === "rede premiere") {
    canonicalCoreName = CN_PREMIERE;
  } else if (normalizedCoreForMatching === "record" || normalizedCoreForMatching === "rede record") {
    canonicalCoreName = CN_RECORD;
  } else if (normalizedCoreForMatching.startsWith("disney plus") || normalizedCoreForMatching.startsWith("disney +") || normalizedCoreForMatching.startsWith("disneyppv") || normalizedCoreForMatching.includes("disney ppv")) {
     //This catches "disney ppv serie b" too if "serie b" is secondary
    canonicalCoreName = CN_DISNEY_PPV;
  } else if (normalizedCoreForMatching.startsWith("hbo max") || normalizedCoreForMatching === "hbo") {
    canonicalCoreName = CN_HBO_MAX;
  } else if (normalizedCoreForMatching === "24horas") { // If pre-normalization already made it "24horas"
    canonicalCoreName = CN_24HORAS;
  }
  // If no specific canonical mapping, use the coreGroupName (which might have been affected by the "24 horas" to "24HORAS" change if done on coreGroupName directly)
  // For safety, ensure canonicalCoreName uses the result of specific string manipulations if any.
  if (coreGroupName.toLowerCase().replace(/\s/g, '').includes("24horas") && canonicalCoreName !== CN_24HORAS) {
     // If the original core contained "24horas" (e.g. from "CANAIS | 24HORAS") and it wasn't caught by other canonicals
     // ensure the CN_24HORAS is used if it matches.
     // This needs the pre-normalization step to also modify coreGroupName if a general toUpperCase is applied later.
     // Let's ensure the pre-normalization output is what canonicalCoreName uses if no other map hits.
     if (normalizedCoreForMatching.endsWith(CN_24HORAS.toLowerCase())) { // check if the *result* of pre-norm is just 24horas
        canonicalCoreName = CN_24HORAS;
     } else {
        // If coreGroupName itself was "24HORAS" or "24 horas", it should become CN_24HORAS
        // This is slightly tricky due to the order.
        // Let's assume coreGroupName is now the result of the "24 horas" -> "24HORAS" transformation if it happened.
        // The current `coreGroupName` would be "CANAIS 24HORAS" if pre-norm worked on it.
        // Let's simplify: if `normalizedCoreForMatching` *is* CN_24HORAS.toLowerCase(), then `canonicalCoreName` is `CN_24HORAS`.
        if (normalizedCoreForMatching === CN_24HORAS.toLowerCase()) {
             canonicalCoreName = CN_24HORAS;
        }
     }
  }


  // 5. Construct displayName
  let finalDisplayName = canonicalCoreName; // Default to the (possibly canonicalized) core name
  const isBroadCanonicalCategory = [CN_LANCAMENTOS, CN_FICCAO_FANTASIA].includes(canonicalCoreName);

  if (mediaType === 'channel' && !isBroadCanonicalCategory) {
    if (!canonicalCoreName || canonicalCoreName.trim() === '') {
      finalDisplayName = "CANAIS";
    } else if (!removeDiacritics(canonicalCoreName.toUpperCase()).startsWith("CANAIS ") && !removeDiacritics(canonicalCoreName.toUpperCase()).startsWith("CANAL ")) {
      finalDisplayName = "CANAIS " + canonicalCoreName;
    } else {
      finalDisplayName = canonicalCoreName; // It already starts with CANAIS/CANAL or is a broad category
    }
  } else if (!finalDisplayName || finalDisplayName.trim() === '') {
    finalDisplayName = DEFAULT_GROUP_NAME_UPPERCASE;
  }
  
  // 6. Final Touches to displayName
  finalDisplayName = finalDisplayName.toUpperCase().trim();
  if (finalDisplayName === '') finalDisplayName = DEFAULT_GROUP_NAME_UPPERCASE;


  // 7. Generate normalizedKey
  const normalizedKey = removeDiacritics(finalDisplayName.toLowerCase()).trim();
  
  return {
    displayName: finalDisplayName,
    normalizedKey: normalizedKey || removeDiacritics(DEFAULT_GROUP_NAME_UPPERCASE.toLowerCase()),
  };
}

