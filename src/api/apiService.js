import axiosInstance from "src/api/axiosInstance";

const request = async (method, endpointType, path, data = null, token = null) => {
  const url = `/${endpointType}/${path}`;

  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

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

export const getPublic = (path) => request('GET', 'public', path);
export const postPublic = (path, data) => request('POST', 'public', path, data);
export const getPrivate = (path, token) => request('GET', 'private', path, null, token);
export const postPrivate = (path, data, token) => request('POST', 'private', path, data, token);
export const putPrivate = (path, data, token) => request('PUT', 'private', path, data, token);
export const deletePrivate = (path, token) => request('DELETE', 'private', path, null, token);



