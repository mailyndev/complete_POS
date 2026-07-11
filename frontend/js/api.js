const getApiBaseUrl = () => {
  const savedUrl = localStorage.getItem("pos_api_base_url");
  if (savedUrl) return savedUrl;
  return window.location.origin + "/api";
};

const API_BASE_URL = getApiBaseUrl();

export const API = {
  // Guardar token en almacenamiento local
  setToken(token) {
    localStorage.setItem("pos_auth_token", token);
  },

  getToken() {
    return localStorage.getItem("pos_auth_token");
  },

  clearToken() {
    localStorage.removeItem("pos_auth_token");
    localStorage.removeItem("pos_user_info");
  },

  setUserInfo(userInfo) {
    localStorage.setItem("pos_user_info", JSON.stringify(userInfo));
  },

  getUserInfo() {
    const info = localStorage.getItem("pos_user_info");
    return info ? JSON.parse(info) : null;
  },

  // Manejo genérico de peticiones fetch
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Inyectar cabeceras por defecto
    const headers = {
      ...options.headers,
    };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    // Inyectar JWT Token si existe
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      // Si la respuesta es de no autorizado o prohibido, forzar logout e invalidar sesión
      if (response.status === 401 || response.status === 403) {
        this.clearToken();
        // Disparar evento global para recargar interfaz a pantalla de login
        window.dispatchEvent(new CustomEvent("pos-unauthorized"));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Sesión expirada o permisos denegados");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error en la petición del servidor");
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Atajos rápidos para métodos HTTP
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
};
