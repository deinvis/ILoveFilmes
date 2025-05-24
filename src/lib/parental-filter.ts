
import type { MediaItem } from '@/types';

const ADULT_KEYWORDS = ["xxx", "adultos"]; // lowercase for case-insensitive comparison

export function applyParentalFilter(items: MediaItem[], parentalControlEnabled: boolean): MediaItem[] {
  if (!parentalControlEnabled) {
    return items;
  }
  return items.filter(item => {
    const lowerTitle = item.title.toLowerCase();
    // Ensure groupTitle and genre are treated as empty strings if undefined, to prevent errors
    const lowerGroupTitle = (item.groupTitle || "").toLowerCase();
    const lowerGenre = (item.genre || "").toLowerCase();

    for (const keyword of ADULT_KEYWORDS) {
      if (lowerTitle.includes(keyword) || lowerGroupTitle.includes(keyword) || lowerGenre.includes(keyword)) {
        return false; // Exclude item if keyword found in title, groupTitle, or genre
      }
    }
    return true; // Include item
  });
}
