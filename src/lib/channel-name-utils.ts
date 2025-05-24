
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

const SIMPLE_QUALITY_TAGS: string[] = [
  'FHD', 'UHD', '4K', 
  'HD', 'SD',        
  'HEVC', 'H265',    
];

const ALL_QUALITY_TAGS_ORDERED = [...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS]
  .sort((a, b) => b.length - a.length);

const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATORS_CHARS_ESCAPED = SEPARATORS_CHARS.map(s => `\\${s}`).join('');

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  const originalTrimmedTitle = title.trim();

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`; // Allows variants like spaces, numbers, ², ³ after the tag
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex: (Base Name)(Separator: specific char OR space, surrounded by optional spaces)(Full Quality Pattern at end of string)
    // Group 1: Base Name (.+?) - one or more chars, non-greedy
    // Non-capturing group for separator: (?:\\s*(?:[${SEPARATORS_CHARS_ESCAPED}]|\\s)\\s+)
    //                                   Ensures a clear separation (special char or space, plus one or more trailing spaces)
    // Group 2: Full Quality Pattern (fullQualityPatternString)
    const mainRegex = new RegExp(`^(.+?)(?:\\s*(?:[${SEPARATORS_CHARS_ESCAPED}]|\\s)\\s+)(${fullQualityPatternString})$`, 'i');
    const match = originalTrimmedTitle.match(mainRegex);
    
    if (match && match[1] && match[2]) { 
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[2].trim();
      // Ensure baseName is not empty and not just spaces after trim
      if (potentialBaseName && potentialBaseName.length > 0) { 
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }
  }

  // Fallback check: If the entire title is just the quality pattern itself
  // (e.g., a channel named "HD" or "SD H265²")
  // This needs to be checked *after* the main loop to avoid prematurely matching
  // parts of longer names if a separator wasn't present.
  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    const qualityOnlyMatch = originalTrimmedTitle.match(qualityOnlyRegex);
    if (qualityOnlyMatch && qualityOnlyMatch[1]) {
      return { baseName: qualityOnlyMatch[1].trim(), qualityTag: qualityOnlyMatch[1].trim() };
    }
  }
  
  // If no defined quality tag was found by the loops above, return the original title as baseName.
  // The previous generic fallback for suffixes like "1", "2" might be too broad if specific tags are missed.
  // This makes the system rely on the explicit quality tag list.
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
