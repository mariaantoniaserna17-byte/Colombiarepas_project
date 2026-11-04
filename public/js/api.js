/**
 * Cliente HTTP para la API de Arepas Gourmet
 */
const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('arepas_jwt_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('arepas_jwt_token', token);
    } else {
      localStorage.removeItem('arepas_jwt_token');
    }
  },

  getUser() {
    const raw = localStorage.getItem('arepas_user_info');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('arepas_user_info', JSON.stringify(user));
    } else {
      localStorage.removeItem('arepas_user_info');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Si es descarga de archivo binario (PDF o Excel)
      const contentType = response.headers.get('content-type');
      if (contentType && (contentType.includes('pdf') || contentType.includes('spreadsheet') || contentType.includes('octet-stream'))) {
        if (!response.ok) {
          throw new Error('Error al descargar el archivo');
        }
        return await response.blob();
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (data.details ? JSON.stringify(data.details) : 'Error en la petición'));
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  // Métodos HTTP
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

