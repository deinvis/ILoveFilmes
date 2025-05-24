
/**
 * @fileOverview Utility functions for processing channel names to extract base name and quality.
 */

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string; // This will now be the full suffix, e.g., "RJ SD", "FHD H265²"
}

// Order matters: more specific/longer tags first
const QUALITY_TAGS_PATTERNS: { tag: string }[] = [
  // Specific combinations first
  { tag: 'FHD H265' }, { tag: 'FHD HEVC' },
  { tag: '4K UHD' },   // Combined resolution + quality indicator
  { tag: 'UHD 4K' },   // Combined resolution + quality indicator
  { tag: 'HD H265' }, { tag: 'HD HEVC' },
  { tag: 'SD H265' }, { tag: 'SD HEVC' },

  // Resolution/Quality indicators (longer ones first if they are subsets of others)
  { tag: 'FHD' },
  { tag: 'UHD' },
  { tag: '4K' },

  // Standard Quality
  { tag: 'HD' },
  { tag: 'SD' },

  // Codecs alone (can be part of a quality string or standalone)
  { tag: 'H265' },
  { tag: 'HEVC' },
];

// Separators that might be before the quality tag. Ensure regex special chars are escaped.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SPECIAL_SEPARATOR_REGEX_PART = `[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]`;

const REGIONAL_INDICATORS_ORDERED: string[] = [ // Order from more specific/longer if needed
  "RJ", "SP", "MG", "RS", "PR", "SC", "BA", "CE", "PE", "DF", "ES", "GO", "MA", "MT", "MS", "PA", "PB", "PI", "RN", "RO", "RR", "SE", "TO", "AM", "AC", "AP",
  "POA", "SSA", "REC", "BH", "CUR", "FLN", "CAMPINAS",
  "NACIONAL", "LOCAL", "SAT", "REGIONAL"
].map(r => r.toUpperCase()); // Ensure uppercase


export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  const originalTrimmedTitle = title.trim();

  let nameAfterQualityStrip = originalTrimmedTitle;
  let coreQualityWithVariant: string | undefined = undefined;

  // 1. Extract Core Quality + Variant Suffix from the end
  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tag = pattern.tag;
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex: (Anything)(Optional Separator OR Just Space)(FullQualityPattern)$
    // Group 1: (.*?) - Potential nameBeforeQuality (non-greedy)
    // Group 2: (\\s*(?:${SPECIAL_SEPARATOR_REGEX_PART}|\\s+)?\\s*) - Optional Separator or just spaces
    // Group 4: (${fullQualityPatternString}) - The full quality tag pattern itself
    const qualityRegex = new RegExp(`^(.*?)([\\s]*(${SPECIAL_SEPARATOR_REGEX_PART}|\\s+)?\\s*)(${fullQualityPatternString})$`, 'i');
    const match = nameAfterQualityStrip.match(qualityRegex);

    if (match) {
      const potentialNamePart = match[1].trim();
      const separatorOrSpace = match[2]; 
      const matchedQuality = match[4].trim();

      if (potentialNamePart || (separatorOrSpace && separatorOrSpace.trim() !== '')) {
        nameAfterQualityStrip = potentialNamePart;
        coreQualityWithVariant = matchedQuality;
        break; 
      }
    } else {
      const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
      if (nameAfterQualityStrip.match(qualityOnlyRegex)) {
        coreQualityWithVariant = nameAfterQualityStrip.trim();
        nameAfterQualityStrip = ""; 
        break;
      }
    }
  }

  let currentBaseName = nameAfterQualityStrip.trim();
  let extractedRegionalModifier: string | undefined = undefined;

  // 2. Extract Regional Modifier from the end of `currentBaseName` (which is nameAfterQualityStrip)
  if (currentBaseName) {
    const words = currentBaseName.split(/\s+/);
    if (words.length > 0) {
      const lastWord = words[words.length - 1].toUpperCase();
      // Check if the last word is a known regional indicator
      if (REGIONAL_INDICATORS_ORDERED.includes(lastWord)) {
        // Only strip if it's not the only word making up 'currentBaseName'
        // OR if coreQualityWithVariant exists (e.g. "RJ SD" -> currentBaseName="RJ", coreQuality="SD")
        if (words.length > 1 || coreQualityWithVariant) {
          extractedRegionalModifier = words.pop()?.trim(); // remove and get it
          currentBaseName = words.join(" ").trim();
        }
        // If words.length was 1 and it's regional (e.g. currentBaseName="RJ"),
        // currentBaseName remains "RJ", extractedRegionalModifier becomes "RJ"
        // This will be handled by displayQualityTag construction.
         else if (words.length === 1) {
            extractedRegionalModifier = lastWord;
            // currentBaseName is already lastWord
        }
      }
    }
  }

  // Construct the final display qualityTag
  let displayQualityTag: string | undefined = undefined;
  if (extractedRegionalModifier && coreQualityWithVariant) {
    displayQualityTag = `${extractedRegionalModifier} ${coreQualityWithVariant}`;
  } else if (coreQualityWithVariant) {
    displayQualityTag = coreQualityWithVariant;
  } else if (extractedRegionalModifier) {
    displayQualityTag = extractedRegionalModifier;
  }

  // Finalize baseName
  // If currentBaseName is empty, it means the original title was entirely quality/regional parts.
  // In this scenario, the original title itself should be considered the baseName.
  if (currentBaseName === "" && originalTrimmedTitle !== "") {
    currentBaseName = originalTrimmedTitle;
    // If the whole title was just a quality/regional tag, that tag is the qualityTag
    // This is implicitly covered as displayQualityTag would be populated.
    // Example: Title "HD". coreQualityWithVariant="HD". currentBaseName becomes "HD". displayQualityTag="HD".
    // Example: Title "RJ SD". core="SD", regional="RJ". currentBaseName becomes "RJ SD". displayQualityTag="RJ SD".
  }

  return { baseName: currentBaseName.trim(), qualityTag: displayQualityTag?.trim() };
}
