
// src/lib/channel-name-utils.ts

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// ORDER MATTERS: LONGEST AND MOST SPECIFIC FIRST
const COMPLEX_QUALITY_TAGS: string[] = [
  'FHD H265 HEVC', 'FHD H265', 'FHD HEVC', 'HD H265', 'HD HEVC',
  '4K UHD', 'UHD 4K', // Common variations of 4K
];

const SIMPLE_QUALITY_TAGS: string[] = [
  'FHD', 'UHD', '4K', 'HEVC', 'H265',
  'HD', 'SD',
];

// Combine and sort by length (descending) to prioritize more specific tags
export const ALL_QUALITY_TAGS_ORDERED = [...new Set([...COMPLEX_QUALITY_TAGS, ...SIMPLE_QUALITY_TAGS])]
  .sort((a, b) => b.length - a.length);

// Separators that might appear between channel name and quality tag
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
// Escaped version for use in regex character class
const SEPARATORS_CHARS_ESCAPED_FOR_REGEX_CLASS = SEPARATORS_CHARS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');

export function extractChannelInfo(title?: string): ExtractedChannelInfo {
  const originalTrimmedTitle = (title || '').trim();
  if (!originalTrimmedTitle) {
    return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  }

  // Specific override for "Globo SP Capital"
  if (originalTrimmedTitle.toUpperCase() === "GLOBO SP CAPITAL") {
    return { baseName: "Globo SP", qualityTag: "Capital" };
  }

  for (const coreTag of ALL_QUALITY_TAGS_ORDERED) {
    // Regex part for the core tag itself, allowing for multiple spaces within the tag
    const tagRegexPart = coreTag
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters in the tag
      .replace(/\s+/g, '[ \t\u00A0]+'); // Match one or more space-like characters for spaces within the tag

    // Regex for optional variant suffixes (e.g., "²", " 2", "¹")
    const variantSuffixPattern = `(?:[\\s\\d²³¹]*)?`; // Added ¹
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Attempt 1: Try with one or more space-like characters as a separator
    // Captures: (1: baseName) (2: space separator) (3: fullQualityPatternString)
    // Ensure the space separator is present and not just part of a word
    const spaceSeparatedRegexString = `^(.+?)([ \t\u00A0]+)(${fullQualityPatternString})$`;
    const spaceSeparatedRegex = new RegExp(spaceSeparatedRegexString, 'i');
    let match = originalTrimmedTitle.match(spaceSeparatedRegex);

    if (match && match[1] && match[3]) {
      const potentialBaseName = match[1].trim();
      const matchedQualityTag = match[3].trim();
      if (potentialBaseName) {
        return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
      }
    }

    // Attempt 2: Try with other defined separators
    for (const sepChar of SEPARATORS_CHARS) {
      const escapedSepChar = sepChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Captures: (1: baseName) (2: separator group) (3: fullQualityPatternString)
      const otherSeparatorRegexString = `^(.+?)([ \t\u00A0]*${escapedSepChar}[ \t\u00A0]*)(${fullQualityPatternString})$`;
      const otherSeparatorRegex = new RegExp(otherSeparatorRegexString, 'i');
      let sepMatch = originalTrimmedTitle.match(otherSeparatorRegex);

      if (sepMatch && sepMatch[1] && sepMatch[3]) {
        const potentialBaseName = sepMatch[1].trim();
        const matchedQualityTag = sepMatch[3].trim();
        if (potentialBaseName) {
          return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
        }
      }
    }
  }

  // Fallback: Check if the entire title is just a quality tag (e.g., "HD", "FHD H265¹")
  for (const coreTag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = coreTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[ \t\u00A0]+');
    const variantSuffixPattern = `(?:[\\s\\d²³¹]*)?`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');

    if (qualityOnlyRegex.test(originalTrimmedTitle)) {
      return { baseName: originalTrimmedTitle, qualityTag: originalTrimmedTitle };
    }
  }

  // Default: No specific quality tag pattern found
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
