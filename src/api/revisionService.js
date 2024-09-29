import axiosInstance from 'src/api/axiosInstance';
import { GameType } from 'src/api/GameType';

class CacheInfoBuilds {
  constructor(major, minor = null) {
    this.major = major;
    this.minor = minor;
  }
}

class CacheInfo {
  constructor({
                id,
                scope,
                game,
                environment,
                language,
                builds,
                timestamp = null,
                sources = [],
                valid_indexes = null,
                indexes = null,
                valid_groups = null,
                groups = null,
                valid_keys = null,
                keys = null,
                size = null,
                blocks = null,
                disk_store_valid = null,
              }) {
    this.id = id;
    this.scope = scope;
    this.game = game;
    this.environment = environment;
    this.language = language;
    this.builds = builds.map(build => new CacheInfoBuilds(build.major, build.minor));
    this.timestamp = timestamp;
    this.sources = sources;
    this.valid_indexes = valid_indexes;
    this.indexes = indexes;
    this.valid_groups = valid_groups;
    this.groups = groups;
    this.valid_keys = valid_keys;
    this.keys = keys;
    this.size = size;
    this.blocks = blocks;
    this.disk_store_valid = disk_store_valid;
  }
}

const useRevisionService = () => {
  const cache = {};

  const fetchCacheData = async (game) => {
    if (!cache[game]) {
      try {
        const url = game === GameType.ALL ? '/public/caches' : `/public/caches?game=${game}`;
        const { data } = await axiosInstance.get(url);
        cache[game] = data.map(item => new CacheInfo(item));
      } catch (error) {
        console.error('Failed to fetch data:', error);
        cache[game] = []; // Ensure cache entry exists even on error
      }
    }
    return cache[game];
  };

  const sortBuilds = (gameData) => {
    return gameData
      .flatMap(item => item.builds)
      .sort((a, b) => b.major - a.major)
      .map(build => build.major);
  };

  const getData = (game) => fetchCacheData(game);
  const getBuilds = async (game) => sortBuilds(await fetchCacheData(game));

  return {
    getData,
    getBuilds,
    getOldschool: () => getData(GameType.OLDSCHOOL),
    getRunescape: () => getData(GameType.RUNESCAPE),
    getDarkscape: () => getData(GameType.DARKSCAPE),
    getDotd: () => getData(GameType.DOTD),
    getAll: () => getData(GameType.ALL),
    getOldschoolBuilds: () => getBuilds(GameType.OLDSCHOOL),
    getRunescapeBuilds: () => getBuilds(GameType.RUNESCAPE),
    getDarkscapeBuilds: () => getBuilds(GameType.DARKSCAPE),
    getDotdBuilds: () => getBuilds(GameType.DOTD),
    getAllBuilds: () => getBuilds(GameType.ALL),
  };
};

export default useRevisionService;
