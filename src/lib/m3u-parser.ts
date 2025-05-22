import type { MediaItem, MediaType } from '@/types';

// This is a very basic placeholder for M3U parsing.
// A real M3U parser would be much more complex.
export function parseM3U(m3uStringOrUrl: string, playlistId: string): MediaItem[] {
  console.log(`Parsing M3U for playlist ID: ${playlistId}, (mock) content/url: ${m3uStringOrUrl}`);
  const items: MediaItem[] = [];
  const types: MediaType[] = ['channel', 'movie', 'series'];
  const commonPoster = 'https://placehold.co/300x450.png';

  for (let i = 1; i <= 15; i++) {
    const type = types[i % 3];
    let titlePrefix = '';
    let groupTitle = '';
    let dataAiHint = '';

    switch (type) {
      case 'channel':
        titlePrefix = 'Channel';
        groupTitle = i % 2 === 0 ? 'News Channels' : 'Entertainment Channels';
        dataAiHint = 'tv broadcast';
        break;
      case 'movie':
        titlePrefix = 'Movie';
        groupTitle = i % 2 === 0 ? 'Action Movies' : 'Comedy Movies';
        dataAiHint = 'movie poster';
        break;
      case 'series':
        titlePrefix = 'Series';
        groupTitle = i % 2 === 0 ? 'Sci-Fi Series' : 'Drama Series';
        dataAiHint = 'tv series';
        break;
    }

    items.push({
      id: `${playlistId}-${type}-${i}`,
      type: type,
      title: `${titlePrefix} ${i} (from P${playlistId.slice(0,2)})`,
      posterUrl: `${commonPoster}?t=${type}${i}&hint=${encodeURIComponent(dataAiHint)}`, // Added hint for placeholder
      streamUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`, // Placeholder stream
      description: `This is a mock description for ${titlePrefix} ${i}. It belongs to playlist ${playlistId}.`,
      genre: type === 'movie' ? (i % 2 === 0 ? 'Action' : 'Comedy') : (type === 'series' ? (i % 2 === 0 ? 'Sci-Fi' : 'Drama') : 'General'),
      groupTitle: groupTitle,
    });
  }
  return items;
}
