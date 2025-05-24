
// src/lib/channel-name-utils.ts

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// ORDER MATTERS: LONGEST AND MOST SPECIFIC FIRST
const COMPLEX_QUALITY_TAGS: string[] = [
  'FHD H265', 'HD H265',
  'FHD HEVC', 'HD HEVC',
  '4K UHD', 'UHD 4K',
];

const SIMPLE_QUALITY_TAGS: string[] = [
  'FHD', 'UHD', '4K',
  'HD', 'SD',
  'HEVC', 'H265', // Individual codec tags
];

// Combine and sort by length (descending) to prioritize more specific tags
export const ALL_QUALITY_TAGS_ORDERED = [...new Set([...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS])]
  .sort((a, b) => b.length - a.length);

// Separators that might appear between channel name and quality tag
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATORS_CHARS_ESCAPED = SEPARATORS_CHARS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');


export function extractChannelInfo(title?: string): ExtractedChannelInfo {
  if (!title || title.trim() === '') {
    return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  }
  const originalTrimmedTitle = title.trim();

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = '(?:[\\s]*[²³\\d]*)?'; // Allows for variants like "SD2", "HD²"
    const fullQualityPatternString = tagRegexPart + variantSuffixPattern;

    // 1. Try to match: Base Name + one or more spaces + Full Quality Pattern at the end
    const mainRegexWithSpaceSeparator = new RegExp(`^(.+?)(\\s+)(${fullQualityPatternString})$`, 'i');
    let match = originalTrimmedTitle.match(mainRegexWithSpaceSeparator);

    if (match && match[1] && match[3]) {
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[3].trim();
      if (potentialBaseName) { // Ensure baseName is not empty
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }

    // 2. Try to match: Base Name + other separator + Full Quality Pattern at the end
    for (const sepChar of SEPARATORS_CHARS) {
      const escapedSep = sepChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mainRegexWithOtherSeparator = new RegExp(`^(.+?)(\\s*${escapedSep}\\s*)(${fullQualityPatternString})$`, 'i');
      match = originalTrimmedTitle.match(mainRegexWithOtherSeparator);
      if (match && match[1] && match[3]) {
        const potentialBaseName = match[1].trim();
        const matchedQualityTag = match[3].trim();
        if (potentialBaseName) {
          return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
        }
      }
    }
    
    // 3. Fallback: if the entire title is just the quality pattern (e.g., channel named "HD")
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    match = originalTrimmedTitle.match(qualityOnlyRegex);
    if (match && match[1]) {
      return { baseName: match[1].trim(), qualityTag: match[1].trim() };
    }
  }

  // Default: No quality tag found by specific patterns
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
