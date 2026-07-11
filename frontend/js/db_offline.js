// Abstracción de base de datos IndexedDB para resiliencia sin Internet (Offline)

const DB_NAME = "AbastecedorPOS";
const DB_VERSION = 1;

export const DBOffline = {
  db: null,

  init() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        return resolve(this.db);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Almacén para catálogo de productos local
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "id" });
          productStore.createIndex("sku", "sku", { unique: true });
          productStore.createIndex("codigo_barras", "codigo_barras", { unique: true });
          productStore.createIndex("nombre", "nombre", { unique: false });
        }

        // Almacén para cola de ventas offline pendientes de sincronización
        if (!db.objectStoreNames.contains("offline_sales")) {
          db.createObjectStore("offline_sales", { keyPath: "consecutivo" });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("Error inicializando IndexedDB:", event.target.error);
        reject(event.target.error);
      };
    });
  },

  // --- MÉTODOS DE PRODUCTOS ---
  
  async saveProducts(products) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["products"], "readwrite");
      const store = transaction.objectStore("products");
      
      // Limpiar catálogo previo antes de rellenar
      store.clear();

      for (const p of products) {
        store.put(p);
      }

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  },

  async searchProducts(query) {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction(["products"], "readonly");
      const store = transaction.objectStore("products");
      const request = store.openCursor();
      const results = [];
      const q = query.toLowerCase();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const p = cursor.value;
          if (
            p.nombre.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.codigo_barras.toLowerCase() === q
          ) {
            results.push(p);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  },

  // --- MÉTODOS DE COLA DE VENTAS ---

  async queueSale(sale) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offline_sales"], "readwrite");
      const store = transaction.objectStore("offline_sales");
      store.put(sale);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  },

  async getQueuedSales() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offline_sales"], "readonly");
      const store = transaction.objectStore("offline_sales");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async removeQueuedSale(consecutivo) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offline_sales"], "readwrite");
      const store = transaction.objectStore("offline_sales");
      store.delete(consecutivo);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }
};
