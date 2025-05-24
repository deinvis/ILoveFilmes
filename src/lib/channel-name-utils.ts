
// src/lib/channel-name-utils.ts

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// ORDER MATTERS: LONGEST AND MOST SPECIFIC FIRST
const COMPLEX_QUALITY_TAGS: string[] = [
  'FHD H265', 'FHD HEVC',
  'HD H265', 'HD HEVC',
  '4K UHD', 'UHD 4K',
];

const SIMPLE_QUALITY_TAGS: string[] = [
  'FHD', 'UHD', '4K', 
  'HD', 'SD',        
  'HEVC', 'H265',    
];

const ALL_QUALITY_TAGS_ORDERED = [...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS]
  .sort((a, b) => b.length - a.length);

// Separators that might appear between channel name and quality tag
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title || title.trim() === '') {
    return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  }
  const originalTrimmedTitle = title.trim();

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    // Regex for the tag itself (e.g., "FHD H265" -> "FHD\s+H265")
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Regex for optional variant suffixes like ², ³, or numbers (e.g., " SD2")
    // Allows spaces within these variants too (e.g. "SD 2")
    const variantSuffixPattern = "(?:[\\s]*[²³\\d]*)?"; 
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Main attempt: Base Name + one or more spaces + Full Quality Pattern at the end
    // Group 1: Base Name (.+?) - one or more chars, non-greedy
    // Group 2: One or more spaces (separator)
    // Group 3: Full Quality Pattern 
    const mainRegexWithSpaceSeparator = new RegExp(`^(.+?)(\\s+)(${fullQualityPatternString})$`, 'i');
    let match = originalTrimmedTitle.match(mainRegexWithSpaceSeparator);

    if (match && match[1] && match[3]) {
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[3].trim();
      if (potentialBaseName) { // Ensure baseName is not empty
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }

    // Fallback: Check if the entire title is just the quality pattern itself
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    match = originalTrimmedTitle.match(qualityOnlyRegex);
    if (match && match[1]) {
      return { baseName: match[1].trim(), qualityTag: match[1].trim() };
    }
  }

  // Fallback for other separators if space separation didn't work
  for (const sep of SEPARATORS_CHARS) {
    // Escape the separator for use in regex
    const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const tag of ALL_QUALITY_TAGS_ORDERED) {
      const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const variantSuffixPattern = "(?:[\\s]*[²³\\d]*)?";
      const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

      // Base Name + optional spaces + separator + optional spaces + Full Quality Pattern
      const regexWithOtherSeparator = new RegExp(`^(.+?)(?:\\s*${escapedSep}\\s*)(${fullQualityPatternString})$`, 'i');
      let match = originalTrimmedTitle.match(regexWithOtherSeparator);
      if (match && match[1] && match[2]) {
        const potentialBaseName = match[1].trim();
        const matchedQualityTag = match[2].trim();
        if (potentialBaseName) {
          return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
        }
      }
    }
  }
  
  // If no quality tag was found by any method
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
