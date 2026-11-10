export type Track = { id: string; title: string; duration: number; artist: string; disc: number; number: number };
export type Album = { id: string; title: string; artist: string; year: string; genre: string; color: string; ink: string; artwork: string; added: number; tracks: Track[] };
export type MusicTrack = { id: string; title: string; duration: number; artist: string; albumArtist: string; album: string; year: number; genre: string; disc: number; number: number; added: number };
export type MusicPlaylist = { id: string; name: string };
export const albumKey = (track: MusicTrack) => JSON.stringify([track.album || '未知专辑', track.albumArtist || track.artist || '未知艺术家']);
export function groupAlbums(tracks: MusicTrack[]): Album[] {
  const grouped = new Map<string, Album>();
  for (const song of tracks) {
    const id = albumKey(song);
    let album = grouped.get(id);
    if (!album) {
      album = { id, title:song.album || '未知专辑', artist:song.albumArtist || song.artist || '未知艺术家', year:song.year ? String(song.year) : '', genre:song.genre, color:'#b8bdc5', ink:'#30343b', artwork:'/artwork/placeholder.svg', added:song.added || 0, tracks:[] };
      grouped.set(id, album);
    }
    album.added = Math.max(album.added, song.added || 0);
    album.tracks.push({id:song.id, title:song.title || '未命名歌曲', duration:song.duration || 0, artist:song.artist, disc:song.disc || 1, number:song.number || 0});
  }
  for (const album of grouped.values()) album.tracks.sort((a,b) => a.disc-b.disc || a.number-b.number);
  return [...grouped.values()].sort((a,b) => b.added-a.added);
}
export const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
