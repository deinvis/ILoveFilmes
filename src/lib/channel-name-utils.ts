
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
  'FHD', 'UHD', '4K', 'HEVC', 'H265',
  'HD', 'SD',
];

// Combine and sort by length (descending) to prioritize more specific tags
export const ALL_QUALITY_TAGS_ORDERED = [...new Set([...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS])]
  .sort((a, b) => b.length - a.length);

const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
// Escape separators for use in regex
const SEPARATORS_CHARS_ESCAPED = SEPARATORS_CHARS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');


export function extractChannelInfo(title?: string): ExtractedChannelInfo {
  if (!title || title.trim() === '') {
    return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  }
  const originalTrimmedTitle = title.trim();

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Allow variants like SD2, HD², FHD H265 2, FHD H265¹, etc.
    // Matches optional spaces, then any combination of digits or superscripts ¹²³
    const variantSuffixPattern = `(?:[\\s]*[¹²³\\d]*)?`; // Added ¹ to the superscript list
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex: (Base Name)(Separator or Required Space)(Full Quality Pattern at the end)
    // Group 1: Base Name (.+?) - non-greedy, one or more characters
    // Group 2: Separator - non-capturing group for the separator logic
    // Group 3: Full Quality Pattern
    const mainRegexString = `^(.+?)(\\s*(?:[${SEPARATORS_CHARS_ESCAPED}]|\\s)\\s+)(${fullQualityPatternString})$`;
    const mainRegex = new RegExp(mainRegexString, 'i'); // Case-insensitive for the whole match

    let match = originalTrimmedTitle.match(mainRegex);

    if (match && match[1] && match[3]) {
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[3].trim();
      if (potentialBaseName) { // Ensure baseName is not empty after trim
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }
  }

  // Fallback: if the entire title is just a quality tag (e.g., channel named "HD")
  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = `(?:[\\s]*[¹²³\\d]*)?`; // Added ¹
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;
    // Added 'i' flag for case-insensitive matching
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    if (qualityOnlyRegex.test(originalTrimmedTitle)) {
      return { baseName: originalTrimmedTitle, qualityTag: originalTrimmedTitle };
    }
  }

  // Default: No quality tag found by specific patterns
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
