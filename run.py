import uvicorn
import webbrowser
import threading
import time

def open_browser():
    # Esperar 2 segundos para dar tiempo a que el servidor uvicorn inicie
    time.sleep(2.0)
    print("\nAbriendo el sistema en su navegador: http://localhost:8000")
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("Iniciando Servidor de Abastecedor Maestro...")
    
    # Iniciar un hilo separado para abrir el navegador web
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Iniciar el servidor uvicorn
    # Se ejecuta en el host local 127.0.0.1 puerto 8000
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
