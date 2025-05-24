
/**
 * @fileOverview Utility functions for processing channel names to extract base name and quality.
 */

export interface ExtractedChannelInfo {
  baseName: string;
  qualityTag?: string;
}

// Order matters: more specific/longer tags first
const QUALITY_TAGS_PATTERNS: { tag: string; regex: RegExp }[] = [
  { tag: '4K UHD', regex: /\s*(4K\s*UHD)\s*$/i },
  { tag: 'UHD 4K', regex: /\s*(UHD\s*4K)\s*$/i },
  { tag: 'FHD H265', regex: /\s*(FHD\s*H265)\s*$/i },
  { tag: 'FHD HEVC', regex: /\s*(FHD\s*HEVC)\s*$/i },
  { tag: 'HD H265', regex: /\s*(HD\s*H265)\s*$/i },
  { tag: 'HD HEVC', regex: /\s*(HD\s*HEVC)\s*$/i },
  { tag: 'SD H265', regex: /\s*(SD\s*H265)\s*$/i },
  { tag: 'SD HEVC', regex: /\s*(SD\s*HEVC)\s*$/i },
  { tag: 'FHD', regex: /\s*(FHD)\s*$/i },
  { tag: 'UHD', regex: /\s*(UHD)\s*$/i },
  { tag: '4K', regex: /\s*(4K)\s*$/i },
  { tag: 'HD', regex: /\s*(HD)\s*$/i },
  { tag: 'SD', regex: /\s*(SD)\s*$/i },
  { tag: 'H265', regex: /\s*(H265)\s*$/i },
  { tag: 'HEVC', regex: /\s*(HEVC)\s*$/i },
];

// Separators that might be before the quality tag
const SEPARATORS = ['|', '-', '–', '—', '(', ')', '[', ']'];
const SEPARATOR_REGEX_STRING = `(?:[${SEPARATORS.map(s => `\\${s}`).join('')}]\\s*)?`;

export function extractChannelInfo(title: string): ExtractedChannelInfo {
  if (!title) return { baseName: 'Canal Desconhecido' };

  let currentTitle = title.trim();
  let qualityTag: string | undefined = undefined;

  for (const pattern of QUALITY_TAGS_PATTERNS) {
    const regex = new RegExp(`^(.*?)` + SEPARATOR_REGEX_STRING + `(${pattern.tag.replace(/\s/g, '\\s*')})(\\s*\\d*)$`, 'i');
    const match = currentTitle.match(regex);

    if (match) {
      const potentialBaseName = match[1].trim();
      const matchedQuality = match[2].trim();
      const trailingDigits = match[3] || ''; // e.g., the '2' in 'ESPN HD2'

      // Ensure we don't strip the entire name if it's just a quality tag
      if (potentialBaseName) {
        currentTitle = potentialBaseName;
        qualityTag = (qualityTag ? `${matchedQuality}${trailingDigits} ${qualityTag}` : `${matchedQuality}${trailingDigits}`).trim();
         // If a specific tag like "FHD H265" is found, we generally don't need to look for "FHD" or "H265" separately.
         // However, the current loop structure will continue. Simpler for now.
      }
    }
  }
  
  // A simpler pass for tags if they are just at the end without complex separators
  if (!qualityTag) {
      for (const pattern of QUALITY_TAGS_PATTERNS) {
          if (currentTitle.toUpperCase().endsWith(` ${pattern.tag.toUpperCase()}`)) {
              const base = currentTitle.substring(0, currentTitle.length - (pattern.tag.length + 1)).trim();
              if (base) {
                  currentTitle = base;
                  qualityTag = pattern.tag;
                  break; 
              }
          }
      }
  }


  // Normalize common channel name endings like " TV" or " CHANNEL" if they are not part of a significant name
  // currentTitle = currentTitle.replace(/\s+TV$/i, '').replace(/\s+CHANNEL$/i, '').trim();


  // If after all stripping, baseName is empty, revert to original title (minus any identified quality)
  if (!currentTitle.trim() && title.trim() !== (qualityTag || '').trim()) {
    currentTitle = title.replace(new RegExp(SEPARATOR_REGEX_STRING + `(${qualityTag?.replace(/\s/g, '\\s*')})(\\s*\\d*)$`, 'i'), '').trim();
  }
  if (!currentTitle.trim()) currentTitle = title; // Ultimate fallback

  return {
    baseName: currentTitle.trim(),
    qualityTag: qualityTag,
  };
}
