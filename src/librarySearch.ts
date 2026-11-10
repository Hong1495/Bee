import type { Album } from './data';

export function buildLibrarySearchIndex(albums: Album[]) {
  return new Map(albums.map(album => [album.id,
    `${album.title} ${album.artist} ${album.tracks.map(track => `${track.title} ${track.artist}`).join(' ')}`.toLowerCase()
  ]));
}

export function matchLibrary(albums: Album[], index: Map<string,string>, query: string) {
  const search = query.trim().toLowerCase();
  const matches = albums.filter(album => !search || index.get(album.id)?.includes(search));
  // Keep the artist column independent of the selected artist's albums.
  const artists = [...new Set(matches.map(album => album.artist))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const byArtist = new Map<string,Album[]>();
  for (const album of matches) {
    const group = byArtist.get(album.artist);
    if (group) group.push(album); else byArtist.set(album.artist,[album]);
  }
  return {matches,artists,byArtist};
}

export function selectSearchArtist(results: ReturnType<typeof matchLibrary>, artist: string) {
  const {matches,artists,byArtist} = results;
  const activeArtist = byArtist.has(artist) ? artist : artists[0] ?? '';
  return {matches, artists, activeArtist, artistAlbums:byArtist.get(activeArtist) ?? []};
}

export function searchLibrary(albums: Album[], index: Map<string,string>, query: string, artist: string) {
  return selectSearchArtist(matchLibrary(albums,index,query),artist);
}
