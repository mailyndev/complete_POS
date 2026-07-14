import os
import mimetypes
# Forzar tipo MIME de Javascript correcto para evitar rechazo del navegador en Windows
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database.connection import init_db
from .database.seed import seed_db
from .routers import auth, inventory, cash, pos, reports, audit, backups, clients, purchases, billing, settings

# Inicializar Base de Datos y Semilla
print("Inicializando base de datos...")
init_db()
print("Ejecutando semilla...")
seed_db()

app = FastAPI(
    title="Abastecedor Maestro API",
    description="API empresarial para administración de POS, Inventario, Compras, Facturación y Caja",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    import asyncio
    from .routers.backups import schedule_auto_backups
    asyncio.create_task(schedule_auto_backups())
    
    # Auto-sincronización de CABYS en segundo plano si está vacía la base de datos
    from .utils.cabys_sync import check_and_trigger_auto_sync
    check_and_trigger_auto_sync()

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith(".js") or path.endswith(".css") or path == "/":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Configurar CORS para permitir peticiones desde orígenes configurados o cualquier origen (muy útil en despliegues locales e híbridos)
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "*")
if allowed_origins_str == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Routers de la API
app.include_router(auth.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(cash.router, prefix="/api")
app.include_router(pos.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(backups.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(settings.router, prefix="/api")

# Asegurar directorios de carga de imágenes
os.makedirs("uploads/productos", exist_ok=True)

# Servir archivos estáticos del Frontend
# Montamos carpetas específicas de assets
if os.path.exists("frontend/css"):
    app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
if os.path.exists("frontend/js"):
    app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
if os.path.exists("uploads"):
    app.mount("/static/uploads", StaticFiles(directory="uploads"), name="uploads")

# Endpoint de estado para verificación de despliegue (Health Check)
@app.get("/health", tags=["Salud"])
def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Ruta principal que sirve el index.html del SPA
@app.get("/")
def read_index():
    index_path = os.path.join("frontend", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Servidor backend de Abastecedor listo. Frontend no detectado aún en frontend/index.html"}

# Ruta fallback para soportar navegación del SPA en modo History API si fuera necesario
@app.exception_handler(404)
def custom_404_handler(request: Request, exc):
    # Si la ruta no empieza con /api y el archivo index.html existe, retornarlo
    if not request.url.path.startswith("/api"):
        index_path = os.path.join("frontend", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return JSONResponse(status_code=404, content={"detail": "Recurso no encontrado"})

