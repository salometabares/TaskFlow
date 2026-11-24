# TaskFlow

Aplicación web para gestionar tareas, construida con Flask y MariaDB. El proyecto ejecuta tres instancias del backend detrás de Nginx e incluye monitoreo con Prometheus y Grafana.

## Arquitectura

- **Frontend:** HTML, CSS y JavaScript en `frontend/`.
- **API:** Flask y Python en `backend/`.
- **Base de datos:** MariaDB; `database/init.sql` crea la tabla `tareas`.
- **Balanceo:** Nginx distribuye las solicitudes entre tres instancias del backend.
- **Monitoreo:** Prometheus recopila métricas del backend, Nginx y cAdvisor; Grafana permite consultarlas.
- **Contenedores:** Docker Compose define los servicios y volúmenes persistentes.

## Requisitos

- Docker Desktop con Docker Compose v2.
- Puertos locales disponibles: `3000`, `3307`, `8080`, `8081`, `9113` y `9090`.

## Inicio rápido

1. Copia `.env.example` a `.env` y cambia todas las contraseñas de ejemplo.
2. Desde la carpeta del proyecto, inicia los servicios:

   ```bash
   docker compose up --build -d
   ```

3. Abre la aplicación en <http://localhost:8080>.

Para detener los servicios:

```bash
docker compose down
```

Los datos de MariaDB, Prometheus y Grafana se conservan en volúmenes Docker. Para borrar también esos datos, ejecuta `docker compose down -v`.

## Servicios locales

| Servicio | URL / puerto | Uso |
| --- | --- | --- |
| TaskFlow | <http://localhost:8080> | Interfaz web y API, a través de Nginx |
| API directa | <http://localhost:5000> | No se publica directamente en el host por defecto |
| Prometheus | <http://localhost:9090> | Consultas y estado de métricas |
| Grafana | <http://localhost:3000> | Paneles de monitoreo; usuario `admin` y clave definida en `.env` |
| cAdvisor | <http://localhost:8081> | Métricas de contenedores |
| Nginx exporter | <http://localhost:9113/metrics> | Métricas de Nginx para Prometheus |
| MariaDB | `localhost:3307` | Base de datos `taskflow` |

## API

Las rutas principales incluyen:

- `GET /` — estado e instancia del backend.
- `GET /health` — estado del backend y conexión con MariaDB.
- `GET /metrics` — métricas Prometheus.
- `/api/tareas` — operaciones de consulta y gestión de tareas.

La interfaz web se sirve en la ruta raíz de Nginx. Para ver las rutas y formatos de datos disponibles, consulta `backend/app.py` y `frontend/script.js`.

## Configuración

Docker Compose lee las variables desde `.env`. `.env.example` solo sirve como plantilla: reemplaza sus valores antes de iniciar el proyecto y no publiques `.env`. Los valores secretos no están incluidos en el repositorio.

## Estructura

```text
TaskFlow/
├── backend/       # API Flask y Dockerfile
├── database/      # Inicialización del esquema MariaDB
├── frontend/      # Interfaz web
├── monitoring/    # Configuración de Prometheus
├── nginx/         # Balanceador y proxy inverso
├── docker-compose.yml
└── .env.example
```


