
/**
 * @fileOverview Utility functions for processing channel names to extract base name and quality.
 */

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// Order matters: more specific/longer tags first
// Ensure no regex special characters in these tags, or escape them if necessary.
const QUALITY_TAGS_PATTERNS: { tag: string }[] = [
  // Combined resolution + codec first
  { tag: 'FHD H265' }, { tag: 'FHD HEVC' },
  { tag: 'HD H265' }, { tag: 'HD HEVC' },
  { tag: 'SD H265' }, { tag: 'SD HEVC' },

  // Resolution/Quality indicators (longer ones first if they are subsets of others)
  { tag: '4K UHD' },
  { tag: 'UHD 4K' },
  { tag: 'FHD' },
  { tag: 'UHD' },
  { tag: '4K' },

  // Standard Quality
  { tag: 'HD' },
  { tag: 'SD' },

  // Codecs alone (less common as primary quality tag, but possible)
  { tag: 'H265' },
  { tag: 'HEVC' },
];

// Separators that might be before the quality tag. Ensure regex special chars are escaped.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATORS_REGEX_PART = SEPARATORS_CHARS.map(s => `\\${s}`).join('');

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  const originalTrimmedTitle = title.trim();

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tag = pattern.tag;
    // Escape the tag for regex and allow flexible spacing within multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Suffix for variants like numbers, ², ³ (optional)
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`; // Allows space, digit, ², ³ zero or more times
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex to match:
    // 1. (Base Name)(Separator)(Full Quality Pattern at end of string)
    // OR
    // 2. (Full Quality Pattern at end of string) if it's the whole string
    // The separator part `(?:\\s*(?:[${SEPARATORS_REGEX_PART}]|\\s)\\s+)` requires at least one space or special separator
    const regexString = `^(.*?)(?:\\s*(?:[${SEPARATORS_REGEX_PART}]|\\s)\\s+)(${fullQualityPatternString})$|^(${fullQualityPatternString})$`;
    // Group 1: potentialBaseName (if separator matched)
    // Group 2: matchedQualityWithSeparator (if separator matched)
    // Group 3: matchedQualityOnly (if no separator, whole string is quality)
    const regex = new RegExp(regexString, 'i');
    const match = originalTrimmedTitle.match(regex);

    if (match) {
      if (match[1] !== undefined && match[2] !== undefined) {
        // Matched: BaseName Separator QualityPattern
        const potentialBaseName = match[1].trim();
        const matchedQuality = match[2].trim();
        if (potentialBaseName) { // Ensure baseName is not empty after trim
          return { baseName: potentialBaseName, qualityTag: matchedQuality };
        }
      } else if (match[3] !== undefined) {
        // Matched: QualityPattern (the whole string)
        const matchedQuality = match[3].trim();
        return { baseName: matchedQuality, qualityTag: matchedQuality };
      }
    }
  }

  // If no quality tag found after checking all patterns, the whole title is the baseName
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
