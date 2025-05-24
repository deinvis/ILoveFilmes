
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
  { tag: '4K UHD' },   // Combined resolution + quality indicator
  { tag: 'UHD 4K' },   // Combined resolution + quality indicator
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
// This part is not currently used in the simplified logic but kept for reference if needed.
// const SPECIAL_SEPARATOR_REGEX_PART = `[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]`;

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido', qualityTag: undefined };
  const originalTrimmedTitle = title.trim();

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tag = pattern.tag; // e.g., "FHD H265", "HD", "SD"
    // Escape the tag for regex and allow flexible spacing within multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Suffix for variants like numbers, ², ³
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex breakdown:
    // ^(.*?)                        : Group 1 (potentialBaseName) - anything, non-greedy
    // (                             : Group 2 (separatorBlock) - one of the following:
    //    \\s+                       :   At least one space
    //    |                          :   OR
    //    \\s*[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]\\s*  : A separator char, surrounded by optional spaces
    // )
    // (${fullQualityPatternString}) : Group 3 (matchedQuality) - the full quality pattern
    // $                             : End of the string
    const qualityRegexString = `^(.*?)(?:\\s+|\\s*[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]\\s*)(${fullQualityPatternString})$`;
    const qualityRegex = new RegExp(qualityRegexString, 'i');
    const match = originalTrimmedTitle.match(qualityRegex);

    if (match) {
      const potentialBaseName = match[1].trim();
      const matchedQuality = match[2].trim(); // Group 2 is now the quality pattern string

      if (potentialBaseName) {
        // Ensure we are not stripping something that looks like a quality tag
        // but is actually part of a multi-word base name if the tag is very short (e.g. "SD")
        // This check is a bit heuristic.
        if (tag.length <= 2 && potentialBaseName.toUpperCase().endsWith(tag.toUpperCase())) {
             // Avoid cases like "NEWS SD CHANNEL" being split into "NEWS" and "SD CHANNEL" if "SD" is a tag.
             // If "SD CHANNEL" is a quality tag, it should be in QUALITY_TAGS_PATTERNS.
        } else {
            return { baseName: potentialBaseName, qualityTag: matchedQuality };
        }
      }
    }

    // Fallback: if the entire title is just the quality tag (e.g., channel named "HD")
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');
    if (originalTrimmedTitle.match(qualityOnlyRegex)) {
      return { baseName: originalTrimmedTitle, qualityTag: originalTrimmedTitle };
    }
  }

  // If no quality tag found, the whole title is the baseName
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
