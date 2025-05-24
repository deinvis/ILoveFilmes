
export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// ORDER MATTERS: LONGEST AND MOST SPECIFIC FIRST
const COMPLEX_QUALITY_TAGS: string[] = [
  'FHD H265', 'FHD HEVC',
  'HD H265', 'HD HEVC',
  'SD H265', 'SD HEVC',
  '4K UHD', 'UHD 4K',
];

// These are simpler, often single-word tags, or common codes.
// Also ordered by length/specificity where overlap might occur (e.g., FHD before HD).
const SIMPLE_QUALITY_TAGS: string[] = [
  'FHD', 'UHD', '4K', 
  'HD', 'SD',        
  'HEVC', 'H265',    
];

// Combine and sort all tags: longest first to ensure more specific matches take precedence.
const ALL_QUALITY_TAGS_ORDERED = [...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS]
  .sort((a, b) => b.length - a.length);

// Separators that might be before the quality tag. Regex-escaped.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATORS_CHARS_ESCAPED = SEPARATORS_CHARS.map(s => `\\${s}`).join('');

// Regex part for a separator: requires at least one space OR one of the special separator characters,
// surrounded by optional spaces.
const SEPARATOR_REGEX_PART = `(?:\\s*(?:[${SEPARATORS_CHARS_ESCAPED}]|\\s)\\s+)`;
const SPECIAL_SEPARATOR_REGEX_PART = `[${SEPARATORS_CHARS_ESCAPED}]`;


export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  const originalTrimmedTitle = title.trim();

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    // Escape the tag for regex and allow flexible spacing within multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Suffix for variants like numbers, ², ³ (optional)
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex to match: (Base Name)(Separator)(Full Quality Pattern at end of string)
    // Separator must be present.
    const mainRegex = new RegExp(`^(.*?)${SEPARATOR_REGEX_PART}(${fullQualityPatternString})$`, 'i');
    const match = originalTrimmedTitle.match(mainRegex);

    if (match && match[1] && match[2]) { // match[1] is baseName, match[2] is the quality part from fullQualityPatternString
      const potentialBaseName = match[1].trim();
      if (potentialBaseName) { // Make sure baseName is not empty after trim
        return { baseName: potentialBaseName, qualityTag: match[2].trim() };
      }
    }

    // Fallback: if the entire title is just the quality pattern (e.g., a channel named "HD")
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    const qualityOnlyMatch = originalTrimmedTitle.match(qualityOnlyRegex);
    if (qualityOnlyMatch && qualityOnlyMatch[1]) {
      return { baseName: qualityOnlyMatch[1].trim(), qualityTag: qualityOnlyMatch[1].trim() };
    }
  }

  // If no defined quality tag was found with a separator, try to identify generic suffixes as a last resort
  let currentTitleForFallback = originalTrimmedTitle;
  let extractedQualityTagForFallback: string | undefined = undefined;

  if (currentTitleForFallback.includes(' ')) {
    const parts = currentTitleForFallback.split(/\s+/);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Condition for a "generic" suffix: 1-4 alphanumeric chars, possibly with ²,³
      // Important: This length (<=4) helps avoid misinterpreting parts of longer actual names or multi-word quality tags
      // that were not caught by the main loop (though they should have been if defined in ALL_QUALITY_TAGS_ORDERED).
      const isGenericSuffix = 
        lastPart.length >= 1 && 
        lastPart.length <= 4 && // Max 4 chars for truly generic suffixes
        /^[A-Z0-9]+[²³]?$/i.test(lastPart);
      
      const potentialBase = parts.slice(0, -1).join(" ").trim();

      if (isGenericSuffix && potentialBase) {
        const isNumericOnlySuffix = /^\d+[²³]?$/.test(lastPart);
        const knownChannelPrefixes = ["espn", "fox sports", "hbo", "globo", "discovery", "sportv", "telecine", "premiere", "record", "band", "sbt", "cnn", "history", "disney", "cnni", "axn", "sony"];
        
        let isLikelyChannelNumberContinuation = false;
        if (isNumericOnlySuffix) {
            for (const prefix of knownChannelPrefixes) {
                if (potentialBase.toLowerCase() === prefix.toLowerCase() || potentialBase.toLowerCase().startsWith(prefix.toLowerCase() + " ")) {
                    isLikelyChannelNumberContinuation = true;
                    break;
                }
            }
        }
        
        if (!isNumericOnlySuffix || lastPart.toLowerCase() === '4k' || (isNumericOnlySuffix && !isLikelyChannelNumberContinuation)) {
            currentTitleForFallback = potentialBase;
            extractedQualityTagForFallback = lastPart;
        }
      }
    }
  }

  return { baseName: currentTitleForFallback.trim(), qualityTag: extractedQualityTagForFallback };
}
