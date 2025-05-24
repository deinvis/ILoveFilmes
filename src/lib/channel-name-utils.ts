
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
  // Must be checked case-insensitively and handle potential variations if any
  if (originalTrimmedTitle.toUpperCase() === "GLOBO SP CAPITAL") {
    return { baseName: "Globo SP", qualityTag: "Capital" };
  }

  for (const coreTag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = coreTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \t\u00A0]+/g, '[ \t\u00A0]+');
    const variantSuffixPattern = `(?:[ \t\u00A0]*[¹²³\\d]*)?`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;

    // Regex: (baseName)(separator_group)(quality_group_at_end)
    // Separator group: (one or more standard spaces) OR (a special char from SEPARATORS_CHARS surrounded by optional literal spaces)
    const separatorPattern = `(?:\\s+|(?:[ ]*[${SEPARATORS_CHARS_ESCAPED_FOR_REGEX_CLASS}][ ]*))`;

    const mainRegex = new RegExp(
        `^(.+?)(${separatorPattern})(${fullQualityPatternString})$`,
        'i' // Case-insensitive
    );
    const match = originalTrimmedTitle.match(mainRegex);

    if (match && match[1] && match[3]) {
        const potentialBaseName = match[1].trim();
        const matchedQualityTag = match[3].trim();
        if (potentialBaseName) {
            // console.log(`extractChannelInfo MATCHED: title="${originalTrimmedTitle}", coreTag="${coreTag}" -> baseName="${potentialBaseName}", qualityTag="${matchedQualityTag}"`);
            return { baseName: potentialBaseName, qualityTag: matchedQualityTag };
        }
    }
  }

  // Fallback: Check if the entire title is just a quality tag (e.g., "HD", "FHD H265¹")
  for (const coreTag of ALL_QUALITY_TAGS_ORDERED) {
    const tagRegexPart = coreTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \t\u00A0]+/g, '[ \t\u00A0]+');
    const variantSuffixPattern = `(?:[ \t\u00A0]*[¹²³\\d]*)?`;
    const fullQualityPatternString = `${tagRegexPart}${variantSuffixPattern}`;
    const qualityOnlyRegex = new RegExp(`^(${fullQualityPatternString})$`, 'i');

    if (qualityOnlyRegex.test(originalTrimmedTitle)) {
        // console.log(`extractChannelInfo FALLBACK (Quality Only): title="${originalTrimmedTitle}" -> baseName="${originalTrimmedTitle}", qualityTag="${originalTrimmedTitle}"`);
        return { baseName: originalTrimmedTitle, qualityTag: originalTrimmedTitle };
    }
  }
  
  // Default: No specific quality tag pattern found, return original title as baseName
  // console.log(`extractChannelInfo DEFAULT: title="${originalTrimmedTitle}" -> baseName="${originalTrimmedTitle}", qualityTag=undefined`);
  return { baseName: originalTrimmedTitle, qualityTag: undefined };
}
