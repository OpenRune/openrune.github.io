import oldschoolIcon from '../assets/images/oldschool.png';
import runescape742Icon from '../assets/images/runescape.png';

export const serversData = [
  {
    icon: oldschoolIcon,
    description: 'Latest Oldschool Data',
    ip: 'https://osrs.openrune.dev/',
    name: 'Oldschool',
    isPublic: true,
  },
  {
    icon: runescape742Icon,
    description: 'Runescape data from 742',
    ip: 'https://osrs.openrune.dev/',
    name: 'Runescape 742',
    isPublic: true,
  }
];


const getCachedServer = () => {
  const cachedServer = localStorage.getItem('selectedServer');
  return cachedServer ? JSON.parse(cachedServer) : null;
};


const saveServerToCache = (server) => {
  localStorage.setItem('selectedServer', JSON.stringify(server));
};

export const getServerData = () => {
  const cachedServer = getCachedServer();
  if (cachedServer) {
    return cachedServer;
  }
  return serversData[0];
};


export const getIp = async (path) => {
  try {
    const server = getServerData();
    const response = await fetch(`http://localhost:8090/${path}`);  // You can change the port based on your setup
    if (response.ok) {
        return `http://localhost:8090/${path}`;
    }
    return `${server.ip}/${path}`;
  } catch (error) {
    const server = getServerData();
    return `${server.ip}/${path}`;
  }
};

export const getPublicFetch = async (path) => {
  try {
    const response = await fetch(await getIp(`public/${path}`));

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return await response;
  } catch (error) {
    console.error('Error fetching from server:', error);
    throw new Error('Error fetching data');
  }
};

export const setSelectedServer = (serverName) => {
  const selectedServer = serversData.find((server) => server.name === serverName.name);
  if (!selectedServer) {
    throw new Error('Server not found');
  }
  saveServerToCache(selectedServer);
};
