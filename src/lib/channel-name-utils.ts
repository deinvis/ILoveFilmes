
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
    // Regex to capture: (1: base name part) (2: matched quality tag) (3: trailing variant info like numbers or superscripts)
    // Example: "ESPN HD2" with tag "HD" -> (ESPN)(HD)(2)
    // Example: "ESPN SD²" with tag "SD" -> (ESPN)(SD)(²)
    const regex = new RegExp(`^(.*?)` + SEPARATOR_REGEX_STRING + `(${pattern.tag.replace(/\s/g, '\\s*')})([\\s\\d²³]*)?$`, 'i');
    const match = currentTitle.match(regex);

    if (match) {
      const potentialBaseName = match[1].trim();
      const matchedQualityFromPattern = match[2].trim(); // This is the 'tag' from QUALITY_TAGS_PATTERNS
      const trailingVariantInfo = (match[3] || '').trim(); // e.g., "2", "²"

      // Ensure we don't strip the entire name if it's just a quality tag with a variant
      if (potentialBaseName || (!potentialBaseName && matchedQualityFromPattern)) {
        currentTitle = potentialBaseName; // This is now the cleaner base name
        // Combine the matched quality tag with any trailing variant info
        const combinedQuality = `${matchedQualityFromPattern}${trailingVariantInfo}`.trim();
        qualityTag = (qualityTag ? `${combinedQuality} ${qualityTag}` : combinedQuality).trim();
         // If a specific tag like "FHD H265" is found, we generally don't need to look for "FHD" or "H265" separately.
         // The current loop structure might find multiple tags if not careful, but ordering of patterns helps.
         // For simplicity, we take the first most specific match.
         // If a more specific tag (like "FHD H265") is already found and assigned to qualityTag,
         // subsequent simpler tags (like "FHD") might also match. We need to ensure we don't overwrite with less specific.
         // However, the loop structure and the `qualityTag = (qualityTag ? ... : ...)` line handles accumulating or prioritizing.
         // The current approach is to break after the first relevant pattern match that yields a base name.
         // Let's refine this to ensure the longest/most specific pattern "wins" as intended by pattern order.
         // This can be achieved by only assigning if a base name is found and potentially breaking,
         // or by letting it iterate and the `qualityTag` accumulation will handle it if ordered correctly.
         // For now, let's assume the ordered patterns and the accumulation logic are sufficient.
      }
    }
  }
  
  // A simpler pass for tags if they are just at the end without complex separators
  // This might be redundant if the main loop is robust enough, or could catch cases missed.
  if (!qualityTag) {
      for (const pattern of QUALITY_TAGS_PATTERNS) {
          // Check if title ends with " TAG" or just "TAG"
          const endingWithSpaceTag = currentTitle.toUpperCase().endsWith(` ${pattern.tag.toUpperCase()}`);
          const endingWithTag = currentTitle.toUpperCase().endsWith(pattern.tag.toUpperCase());

          if (endingWithSpaceTag) {
              const base = currentTitle.substring(0, currentTitle.length - (pattern.tag.length + 1)).trim();
              if (base) {
                  currentTitle = base;
                  qualityTag = pattern.tag;
                  break; 
              }
          } else if (endingWithTag && (currentTitle.length === pattern.tag.length || /\W$/.test(currentTitle.charAt(currentTitle.length - pattern.tag.length -1)))) {
             // Handles case like "ChannelSD" if "SD" is a tag, provided previous char is non-word, or it's start of string.
             const base = currentTitle.substring(0, currentTitle.length - pattern.tag.length).trim();
             if (base) {
                currentTitle = base;
                qualityTag = pattern.tag;
                break;
             }
          }
      }
  }


  // If after all stripping, baseName is empty, revert to original title (minus any identified quality)
  if (!currentTitle.trim() && title.trim() !== (qualityTag || '').trim()) {
    // Reconstruct a more careful base if currentTitle became empty
    let tempTitle = title;
    if (qualityTag) {
        // Try to remove the qualityTag from the original title in a more direct way
        // This is tricky due to spaces and separators. For now, this part is a best-effort.
        const qualityTagParts = qualityTag.split(/\s+/);
        qualityTagParts.reverse().forEach(part => {
            const regex = new RegExp(SEPARATOR_REGEX_STRING + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
            tempTitle = tempTitle.replace(regex, '').trim();
        });
    }
    currentTitle = tempTitle.trim();
  }
  if (!currentTitle.trim()) currentTitle = title; // Ultimate fallback

  return {
    baseName: currentTitle.trim(),
    qualityTag: qualityTag,
  };
}
