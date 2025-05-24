
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
  'FHD', 'UHD', '4K', // Specific resolutions/standards
  'HD', 'SD',         // Common qualities
  'HEVC', 'H265',     // Common codecs
  'JDD',              // Added based on user example "ESPN JDD"
                       // Add other common single-word/code tags here, e.g., 'HDR', 'DV'
];

// Combine and sort all tags: longest first to ensure more specific matches take precedence.
const ALL_QUALITY_TAGS_ORDERED = [...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS]
  .sort((a, b) => b.length - a.length);

// Separators that might be before the quality tag. Regex-escaped.
const SEPARATORS_CHARS_ESCAPED = ['|', '-', '–', '—', '(', ')', '[', ']']
  .map(s => `\\${s}`).join('');
// Regex part for a separator: requires at least one space OR one of the special separator characters,
// surrounded by optional spaces.
const SEPARATOR_REGEX_PART = `(?:\\s*(?:[${SEPARATORS_CHARS_ESCAPED}]|\\s)\\s+)`;


export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  let currentTitle = title.trim();
  let extractedQualityTag: string | undefined = undefined;

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    // Escape the tag for regex and allow flexible spacing within multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Suffix for variants like numbers, ², ³ (optional)
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex to match: (Base Name)(Separator)(Full Quality Pattern at end of string)
    // OR (Full Quality Pattern at end of string) if it's the whole string
    const regex = new RegExp(`^(.*?)${SEPARATOR_REGEX_PART}(${fullQualityPatternString})$|^(${fullQualityPatternString})$`, 'i');
    const match = currentTitle.match(regex);

    if (match) {
      if (match[1] !== undefined && match[2] !== undefined && match[1].trim() !== '') {
        // Matched: BaseName Separator QualityPattern
        currentTitle = match[1].trim();
        extractedQualityTag = match[2].trim();
        // Found the most specific quality tag, break loop
        break; 
      } else if (match[3] !== undefined) {
        // Matched: QualityPattern (the whole string)
        // The baseName is the quality pattern itself, and qualityTag is also it.
        return { baseName: currentTitle, qualityTag: currentTitle };
      }
    }
  }

  // After the loop, currentTitle holds the base name and extractedQualityTag holds the quality.
  // A final check for very short suffixes if no known tag was found and extractedQualityTag is still undefined.
  // This is the heuristic part to catch things like "ESPN XYZ" where XYZ isn't a predefined quality tag.
  if (!extractedQualityTag && currentTitle.includes(' ')) {
    const parts = currentTitle.split(/\s+/);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Condition for a "generic" suffix: 1-4 alphanumeric chars, possibly with ²,³
      const isGenericSuffix = 
        lastPart.length >= 1 && 
        lastPart.length <= 4 &&
        /^[A-Z0-9]+[²³]?$/i.test(lastPart);
      
      const potentialBase = parts.slice(0, -1).join(" ").trim();

      if (isGenericSuffix && potentialBase !== '') {
        const isNumericOnlySuffix = /^\d+[²³]?$/.test(lastPart);
        const knownChannelPrefixes = ["espn", "fox sports", "hbo", "globo", "discovery", "sportv", "telecine", "premiere", "record", "band", "sbt", "cnn", "history", "disney"]; // Add more as needed
        
        let isLikelyChannelNumberContinuation = false;
        if (isNumericOnlySuffix) {
            for (const prefix of knownChannelPrefixes) {
                // Check if potentialBase exactly matches a known prefix that often has numbers (e.g. "ESPN" for "ESPN 2")
                if (potentialBase.toLowerCase() === prefix) {
                    isLikelyChannelNumberContinuation = true;
                    break;
                }
            }
        }
        
        // Split if:
        // 1. The suffix is NOT numeric (e.g., "JDD", "ABC")
        // OR
        // 2. The suffix IS numeric BUT it's a known quality like "4K"
        // OR
        // 3. The suffix IS numeric BUT the base part is NOT a known channel prefix that typically has numbers (less common scenario for this fallback)
        if (!isNumericOnlySuffix || lastPart.toLowerCase() === '4k' || (isNumericOnlySuffix && !isLikelyChannelNumberContinuation)) {
            currentTitle = potentialBase;
            extractedQualityTag = lastPart;
        }
      }
    }
  }

  return { baseName: currentTitle.trim(), qualityTag: extractedQualityTag };
}

