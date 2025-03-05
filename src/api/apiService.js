import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const ServerContext = createContext(null);

export const ServerProvider = ({ children }) => {
  const serversData = [
    { name: 'Oldschool', ip: 'http://192.168.1.1:8080', isPublic: true },
    { name: 'Runescape 742', ip: 'http://192.168.1.2:8081', isPublic: true },
    { name: 'Local', ip: 'http://127.0.0.1:8090', isPublic: true },
    { name: 'Vorkath', ip: 'http://192.168.1.3:8082', isPublic: false },
  ];

  const [selectedServer, setSelectedServer] = useState(null);

  // Initialize selected server from localStorage or default server
  useEffect(() => {
    const savedServer = localStorage.getItem('selectedServer');
    if (savedServer) {
      setSelectedServer(JSON.parse(savedServer));
    } else {
      const defaultServer = serversData.find((server) => server.name === 'Oldschool');
      setSelectedServer(defaultServer);
      localStorage.setItem('selectedServer', JSON.stringify(defaultServer));
    }
  }, []);

  // Set selected server and save to localStorage
  const selectServer = (server) => {
    setSelectedServer(server);
    localStorage.setItem('selectedServer', JSON.stringify(server));
  };

  return (
    <ServerContext.Provider value={{ selectedServer, selectServer, serversData }}>
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => useContext(ServerContext);

// Axios instance creation based on selected server
const useAxiosInstance = () => {
  const { selectedServer } = useServer();
  return axios.create({
    baseURL: selectedServer?.ip || 'http://localhost:8080', // Fallback to localhost
  });
};

// Request function to handle different HTTP methods
const request = async (method, endpointType, path, data = null, token = null) => {
  const axiosInstance = useAxiosInstance();
  const url = `/${endpointType}/${path}`;

  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  switch (method) {
    case 'GET':
      return await axiosInstance.get(url, config);
    case 'POST':
      return await axiosInstance.post(url, data, config);
    case 'PUT':
      return await axiosInstance.put(url, data, config);
    case 'DELETE':
      return await axiosInstance.delete(url, config);
    default:
      throw new Error(`Unsupported request method: ${method}`);
  }
};

// Public API functions
export const getPublicFetch = (path) => fetch(`${useServer().ip}/public/${path}`);
export const postPublic = (path, data) => request('POST', 'public', path, data);

// Private API functions
export const getPrivate = (path, token) => request('GET', 'private', path, null, token);
export const postPrivate = (path, data, token) => request('POST', 'private', path, data, token);
export const putPrivate = (path, data, token) => request('PUT', 'private', path, data, token);
export const deletePrivate = (path, token) => request('DELETE', 'private', path, null, token);

// Auth-related functions
export const registerUser = (username, email, password) => {
  return postPublic('register', { username, email, password });
};

export const loginUser = (email, password, browser, rememberMe) => {
  return postPublic('login', { email, password, browser, rememberMe });
};

export const verifyToken = (token) => {
  return getPrivate('verify-token', token);
};

export const logoutUser = (token) => {
  return postPrivate('logout', null, token);
};

export const verifyUserToken = async (token) => {
  try {
    await getPrivate('verify-token', token);
    return true;
  } catch (error) {
    return false;
  }
};
