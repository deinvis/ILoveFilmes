
/**
 * @fileOverview Utility functions for processing channel names to extract base name and quality.
 */

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// Order matters: more specific/longer tags first
const QUALITY_TAGS_PATTERNS: { tag: string }[] = [
  // Combined tags first
  { tag: '4K UHD' }, { tag: 'UHD 4K' },
  { tag: 'FHD H265' }, { tag: 'FHD HEVC' },
  { tag: 'HD H265' }, { tag: 'HD HEVC' },
  { tag: 'SD H265' }, { tag: 'SD HEVC' },
  // Individual tags
  { tag: 'FHD' }, { tag: 'UHD' }, { tag: '4K' },
  { tag: 'HD' }, { tag: 'SD' },
  { tag: 'H265' }, { tag: 'HEVC' },
];

// Separators that might be before the quality tag. Ensure regex special chars are escaped.
const SEPARATORS_CHARS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATOR_REGEX_STRING = `(?:[${SEPARATORS_CHARS.map(s => `\\${s}`).join('')}]\\s*)?`;


export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido' };

  const originalTrimmedTitle = title.trim();

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    // Construct the regex for the current quality tag pattern
    // It should match: (capture base)(optional separator)(capture tag)(capture variant like 2 or ²)$
    const tagForRegex = pattern.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const regex = new RegExp(
      `^(.*?)${SEPARATOR_REGEX_STRING}(${tagForRegex})([\\s\\d²³]*)?$`,
      'i'
    );

    const match = originalTrimmedTitle.match(regex);

    if (match) {
      let potentialBaseName = match[1] ? match[1].trim() : '';
      const matchedQualityFromPattern = match[2].trim(); // The core tag like "SD", "HD"
      const trailingVariantInfo = match[3] ? match[3].trim() : '';
      const fullQualityStr = `${matchedQualityFromPattern}${trailingVariantInfo ? `${trailingVariantInfo.startsWith(' ') ? '' : ' '}${trailingVariantInfo}` : ''}`.trim();


      // If potentialBaseName is empty, it means the entire title was the quality tag (e.g. title="HD")
      // In this case, the baseName should be the original title itself.
      if (potentialBaseName === '' && originalTrimmedTitle.toUpperCase() === fullQualityStr.toUpperCase()) {
        return { baseName: originalTrimmedTitle, qualityTag: fullQualityStr };
      }
      
      // If potentialBaseName is not empty, we found a clear base and quality.
      if (potentialBaseName) {
        return { baseName: potentialBaseName, qualityTag: fullQualityStr };
      }
    }
  }

  // If no patterns matched the complex structure, try a simpler check
  // for tags at the very end without an explicit separator (but possibly a space)
  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const tagForRegex = pattern.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    // Regex: (capture base)(whitespace OR start of string)(capture tag with variant)$
    const simplerRegex = new RegExp(`^(.*?)(?:\\s+|^)(${tagForRegex}[\\s\\d²³]*)$`, 'i');
    const simplerMatch = originalTrimmedTitle.match(simplerRegex);

    if (simplerMatch) {
      const potentialBaseName = simplerMatch[1] ? simplerMatch[1].trim() : '';
      const fullQualityStr = simplerMatch[2].trim();

      if (potentialBaseName === '' && originalTrimmedTitle.toUpperCase() === fullQualityStr.toUpperCase()) {
        return { baseName: originalTrimmedTitle, qualityTag: fullQualityStr };
      }
      if (potentialBaseName) {
        return { baseName: potentialBaseName, qualityTag: fullQualityStr };
      }
    }
  }


  // If no quality tag was found by any pattern
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
