// Music's scripting dictionary is the API boundary; no UI scripting or credentials.
function run(argv) {
  const request = JSON.parse(argv[0]);
  const music = Application('com.apple.Music');
  if (request.operation === 'status' && !music.running()) return JSON.stringify({ running:false, playing:false, position:0, canPrevious:false, canNext:false, track:null });
  if (request.operation === 'connect') {
    music.launch();
    // Reading a protected property triggers the macOS Automation consent dialog.
    return JSON.stringify({ playlists:music.libraryPlaylists.length });
  }
  const library = music.libraryPlaylists[0];
  // Bee keeps the source order because playing an individual Music track does
  // not reliably populate Music's private Up Next queue.
  function sourceFor(id) {
    if (request.context && request.context.ids.indexOf(id) >= 0) return request.context;
    try {
      const list = music.currentPlaylist;
      return {ids:list.tracks.persistentID(), name:list.name(), playlistId:list.persistentID()};
    } catch (_) { return {ids:[], name:'', playlistId:null}; }
  }
  function navigation(id) {
    const source = sourceFor(id), index = source.ids.indexOf(id);
    return {canPrevious:index > 0, canNext:index >= 0 && index < source.ids.length - 1};
  }
  function playInSource(id, source) {
    let collection = library.tracks;
    if (source.playlistId) {
      const lists = music.userPlaylists.whose({persistentID:source.playlistId})();
      if (lists.length) collection = lists[0].tracks;
    }
    const matches = collection.whose({persistentID:id})();
    if (!matches.length) throw new Error('歌曲已不在播放来源中，请刷新资料库');
    music.play(matches[0], {once:true});
  }
  if (request.operation === 'library') {
    const tracks = library.tracks;
    const ids = tracks.persistentID();
    const names = tracks.name(), artists = tracks.artist(), albumArtists = tracks.albumArtist();
    const albums = tracks.album(), durations = tracks.duration(), years = tracks.year();
    const genres = tracks.genre(), discs = tracks.discNumber(), numbers = tracks.trackNumber();
    const added = tracks.dateAdded();
    const rows = ids.map((id, i) => ({id, title:names[i], artist:artists[i], albumArtist:albumArtists[i],
      album:albums[i], duration:durations[i], year:years[i], genre:genres[i], disc:discs[i], number:numbers[i],
      added:added[i] ? new Date(added[i]).getTime() : 0}));
    const lists = music.userPlaylists;
    const listIds = lists.persistentID(), listNames = lists.name(), kinds = lists.specialKind();
    return JSON.stringify({ tracks:rows, playlists:listIds.map((id,i) => ({id, name:listNames[i], kind:String(kinds[i])})).filter(p => p.kind.toLowerCase() === 'none') });
  }
  if (request.operation === 'playlist') {
    const list = music.userPlaylists.whose({persistentID:request.id})();
    if (!list.length) throw new Error('播放列表已不存在，请刷新资料库');
    return JSON.stringify(list[0].tracks.persistentID());
  }
  if (request.operation === 'play') {
    let source;
    if (request.playlistId) {
      const lists = music.userPlaylists.whose({persistentID:request.playlistId})();
      if (!lists.length) throw new Error('播放列表已不存在，请刷新资料库');
      source = {ids:lists[0].tracks.persistentID(),name:lists[0].name(),playlistId:request.playlistId};
    } else {
      source = {ids:request.trackIds || [request.id],name:request.sourceName || '',playlistId:null};
    }
    const first = request.playlistId ? source.ids[0] : request.id;
    if (!first) throw new Error('播放列表没有可播放的歌曲');
    if (source.ids.indexOf(first) < 0) throw new Error('歌曲已不在播放来源中，请刷新资料库');
    playInSource(first,source);
    return JSON.stringify({context:source});
  }
  if (request.operation === 'queue') {
    if (!music.running() || String(music.playerState()) === 'stopped') return JSON.stringify({name:'', tracks:[], shuffle:false});
    const current = music.currentTrack.persistentID(), source = sourceFor(current);
    const offset = source.ids.indexOf(current);
    // Bulk properties avoid hundreds of Apple Event round trips for a queue.
    const tracks = library.tracks, ids = tracks.persistentID();
    const names = tracks.name(), artists = tracks.artist(), durations = tracks.duration();
    const positions = new Map(ids.map((id,i) => [id,i]));
    const rows = offset < 0 ? [] : source.ids.map((id,i) => {
      const position = positions.get(id);
      return position === undefined ? null : {id,title:names[position],artist:artists[position],duration:durations[position],current:i===offset};
    }).filter(Boolean);
    return JSON.stringify({name:source.name,shuffle:false,tracks:rows});
  }
  if (request.operation === 'next' || request.operation === 'previous') {
    if (!music.running() || String(music.playerState()) === 'stopped') return '{}';
    const current = music.currentTrack.persistentID(), source = sourceFor(current);
    const index = source.ids.indexOf(current);
    const target = index + (request.operation === 'next' ? 1 : -1);
    if (index < 0 || target < 0 || target >= source.ids.length) return '{}';
    playInSource(source.ids[target],source);
    return JSON.stringify({context:source});
  }
  if (request.operation === 'pause') { music.pause(); return '{}'; }
  if (request.operation === 'toggle') { music.playpause(); return '{}'; }
  if (request.operation === 'status') {
    const state = String(music.playerState());
    if (state === 'stopped') return JSON.stringify({running:true, playing:false, position:0, canPrevious:false, canNext:false, track:null});
    const t = music.currentTrack;
    const id = t.persistentID();
    const bounds = navigation(id);
    if (id === request.id) return JSON.stringify({running:true, playing:state === 'playing', position:music.playerPosition(), canPrevious:bounds.canPrevious, canNext:bounds.canNext, unchanged:true, track:null});
    return JSON.stringify({running:true, playing:state === 'playing', position:music.playerPosition(), canPrevious:bounds.canPrevious, canNext:bounds.canNext, track:{id, title:t.name(),
      artist:t.artist(), albumArtist:t.albumArtist(), album:t.album(), duration:t.duration(), year:t.year(), genre:t.genre(), disc:t.discNumber(), number:t.trackNumber(), added:0}});
  }
  throw new Error('未知的音乐操作');
}
