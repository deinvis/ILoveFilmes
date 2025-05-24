
/**
 * @fileOverview Utility functions for processing channel names to extract base name and quality.
 */

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// Order matters: more specific/longer tags first
const QUALITY_TAGS_PATTERNS: { tag: string }[] = [
  // Specific combinations first
  { tag: 'FHD H265' }, { tag: 'FHD HEVC' },
  { tag: '4K UHD' },   // Combined resolution + quality indicator
  { tag: 'UHD 4K' },   // Combined resolution + quality indicator
  { tag: 'HD H265' }, { tag: 'HD HEVC' },
  { tag: 'SD H265' }, { tag: 'SD HEVC' },

  // Resolution/Quality indicators (longer ones first if they are subsets of others)
  { tag: 'FHD' },
  { tag: 'UHD' },
  { tag: '4K' },

  // Standard Quality
  { tag: 'HD' },
  { tag: 'SD' },

  // Codecs alone (can be part of a quality string or standalone)
  { tag: 'H265' },
  { tag: 'HEVC' },
];

// Separators that might be before the quality tag. Ensure regex special chars are escaped.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATOR_REGEX_PART = `(?:[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]\\s*|\\s+)`; // Separator char OR just whitespace

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido' };
  const originalTrimmedTitle = title.trim();

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tag = pattern.tag;
    // Regex for the tag itself, allowing for internal spaces in multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Regex for optional variant suffix (², ³, numbers).
    // This suffix is PART of the full quality string.
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`;

    // Construct full quality pattern: TAG + optional SUFFIX
    const fullQualityRegexString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex 1: Try to match (BASE_NAME) (SEPARATOR_OR_SPACE) (FULL_QUALITY_PATTERN)$
    const mainRegex = new RegExp(`^(.*?)${SEPARATOR_REGEX_PART}(${fullQualityRegexString})$`, 'i');
    let match = originalTrimmedTitle.match(mainRegex);

    if (match) {
      const potentialBaseName = match[1] ? match[1].trim() : '';
      const matchedFullQuality = match[2].trim(); // This is (tag + suffix)

      if (potentialBaseName) {
        // Ensure the baseName isn't empty after trimming
        return { baseName: potentialBaseName, qualityTag: matchedFullQuality };
      }
      // If potentialBaseName is empty here, it means the separator was at the beginning.
      // e.g. title "| HD". This case should be caught by qualityOnlyRegex below.
    }

    // Regex 2: If the title IS ONLY the full quality pattern (no base name, no preceding separator)
    const qualityOnlyRegex = new RegExp(`^(${fullQualityRegexString})$`, 'i');
    match = originalTrimmedTitle.match(qualityOnlyRegex);
    if (match) {
      const matchedFullQuality = match[1].trim();
      // If the entire title is just the quality string, baseName is the title itself.
      return { baseName: originalTrimmedTitle, qualityTag: matchedFullQuality };
    }
  }

  // If no specific quality tag pattern found after all iterations
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
