
# Imagen base de Python
FROM python:3.12-slim

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY backend/requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo del backend
COPY backend/ .

# Copiar frontend
COPY frontend/ /frontend/

# Configuracion de Python
ENV PYTHONUNBUFFERED=1

# Puerto de Flask
EXPOSE 5000

# Iniciar aplicacion
CMD ["python", "app.py"]
