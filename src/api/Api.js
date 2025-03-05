export const serversData = [
  { name: 'Oldschool', ip: 'http://192.168.1.1:8080', isPublic: true },
  { name: 'Runescape 742', ip: 'http://192.168.1.2:8081', isPublic: true },
  { name: 'Vorkath', ip: 'http://192.168.1.3:8082', isPublic: false },
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

const getIp = async (path) => {
  try {
    const response = await fetch(`http://localhost:8090/${path}`);  // You can change the port based on your setup
    if (response.ok) {
      return `http://localhost:8090/${path}`;
    }
    throw new Error('Localhost unavailable');
  } catch (error) {
    const server = getServerData();
    return server.ip;
  }
};

export const getPublicFetch = async (path) => {
  const server = getServerData();

  try {
    const response = await fetch(await getIp(`/public/${path}`));
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
