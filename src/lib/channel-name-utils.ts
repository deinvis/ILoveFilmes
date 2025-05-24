
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
// Space is NOT included here as it's handled differently in the main regex logic.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SPECIAL_SEPARATOR_REGEX_PART = `[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]`;


export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido' };
  const originalTrimmedTitle = title.trim();

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tag = pattern.tag;
    // Regex for the tag itself, allowing for internal spaces in multi-word tags
    const tagRegexPart = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Regex for optional variant suffix (², ³, numbers, and spaces within/after them)
    const variantSuffixPattern = `(?:[\\s\\d²³]*)`; 

    // Construct full quality pattern: TAG + optional SUFFIX
    const fullQualityPattern = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex to match: (BaseName)(SeparatorOrSpace)(FullQualityPattern) at the end of the string
    // Group 1: (.*?) - BaseName (non-greedy)
    // Group 2: (\\s*(?:${SPECIAL_SEPARATOR_REGEX_PART}|\\s)\\s*) - Separator part: 
    //          optional leading spaces, then (a special separator char OR a literal space), then optional trailing spaces.
    //          This group ensures there is *some* form of separation.
    // Group 3: (${fullQualityPattern}) - The full quality tag pattern
    const mainRegex = new RegExp(`^(.*?)([\\s]*(${SPECIAL_SEPARATOR_REGEX_PART}|\\s)[\\s]*)(${fullQualityPattern})$`, 'i');
    
    const match = originalTrimmedTitle.match(mainRegex);

    if (match) {
      const potentialBaseName = match[1].trim(); // Base Name
      // const separatorUsed = match[2].trim(); // The actual separator, if needed for debugging
      const matchedFullQuality = match[4].trim(); // Full Quality Tag (tag + suffix)

      if (potentialBaseName) { // Ensure baseName is not empty
        return { baseName: potentialBaseName, qualityTag: matchedFullQuality };
      }
    }

    // Fallback: If the entire title is just the quality pattern (e.g., channel named "HD" or "SD²")
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPattern})$`, 'i');
    const qualityOnlyMatch = originalTrimmedTitle.match(qualityOnlyRegex);
    if (qualityOnlyMatch) {
      const matchedFullQuality = qualityOnlyMatch[1].trim();
      return { baseName: originalTrimmedTitle, qualityTag: matchedFullQuality };
    }
  }

  // If no quality tag from the list is successfully extracted
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
