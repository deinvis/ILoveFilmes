
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
const SEPARATORS_CHARS_ESCAPED_FOR_REGEX_CLASS = SEPARATORS_CHARS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');


export function extractChannelInfo(title?: string): ExtractedChannelInfo {
  const originalTrimmedTitle = (title || '').trim();
  if (!originalTrimmedTitle) {
    return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  }

  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // ¹²³ are common superscripts for variants. \d for other numbers like 2, 3, etc.
    const variantSuffixPattern = `(?:[\\s]*[¹²³\\d]*)?`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Attempt 1: Try to match with one or more spaces as the separator
    const spaceSeparatedRegexString = `^(.+?)(\\s+)(${fullQualityPatternString})$`;
    const spaceSeparatedRegex = new RegExp(spaceSeparatedRegexString, 'i');
    let match = originalTrimmedTitle.match(spaceSeparatedRegex);

    if (match && match[1] && match[3]) {
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[3].trim();
      if (potentialBaseName) { // Ensure baseName isn't empty
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }

    // Attempt 2: If space separation didn't work, try with other defined separators
    if (!match) {
      for (const sepChar of SEPARATORS_CHARS) {
        const escapedSepChar = sepChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Regex: (Base Name)(OptionalSpaces SEPARATOR OptionalSpaces)(Full Quality Pattern)
        // Group 1: Base Name
        // Group 2: Separator part (we don't use this group directly)
        // Group 3: Full Quality Tag
        const otherSeparatorRegexString = `^(.+?)(\\s*${escapedSepChar}\\s*)(${fullQualityPatternString})$`;
        const otherSeparatorRegex = new RegExp(otherSeparatorRegexString, 'i');
        let sepMatch = originalTrimmedTitle.match(otherSeparatorRegex);

        if (sepMatch && sepMatch[1] && sepMatch[3]) {
          const potentialBaseName = sepMatch[1].trim();
          const matchedQualityTag = sepMatch[3].trim();
          if (potentialBaseName) { // Ensure baseName isn't empty
            return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
          }
        }
      }
    }
  }

  // Fallback: Check if the entire title is just a quality tag (e.g., channel named "HD")
  for (const tag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const variantSuffixPattern = `(?:[\\s]*[¹²³\\d]*)?`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');

    if (qualityOnlyRegex.test(originalTrimmedTitle)) {
      return { baseName: originalTrimmedTitle, qualityTag: originalTrimmedTitle };
    }
  }

  // Default: No specific quality tag pattern found by the above methods
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
