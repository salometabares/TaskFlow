
import os
import time

from flask import Flask, jsonify, request
from db_connection import obtener_conexion

from prometheus_client import (
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST
)

app = Flask(
    __name__,
    static_folder="../frontend",
    static_url_path="/static"
)
@app.route("/app")
def aplicacion():
    return app.send_static_file("index.html")

INSTANCIA = os.getenv("INSTANCE_ID", "backend-local")

# Metricas de Prometheus
SOLICITUDES = Counter(
    "taskflow_requests_total",
    "Total de solicitudes HTTP",
    ["metodo", "endpoint", "estado"]
)

LATENCIA = Histogram(
    "taskflow_request_duration_seconds",
    "Tiempo de procesamiento de solicitudes",
    ["metodo", "endpoint"]
)


@app.before_request
def iniciar_medicion():
    request.inicio = time.time()


@app.after_request
def registrar_metricas(response):
    if request.path != "/metrics":
        duracion = time.time() - request.inicio

        SOLICITUDES.labels(
            request.method,
            request.endpoint or "desconocido",
            str(response.status_code)
        ).inc()

        LATENCIA.labels(
            request.method,
            request.endpoint or "desconocido"
        ).observe(duracion)

        response.headers["X-Backend-Instance"] = INSTANCIA

    return response


# Comprobar que el backend esta funcionando
@app.route("/health", methods=["GET"])
def health():
    try:
        conexion = obtener_conexion()
        conexion.close()

        return jsonify({
            "estado": "activo",
            "instancia": INSTANCIA,
            "base_datos": "conectada"
        }), 200

    except Exception:
        return jsonify({
            "estado": "degradado",
            "instancia": INSTANCIA,
            "base_datos": "desconectada"
        }), 503


# Identificar la instancia que responde
@app.route("/", methods=["GET"])
def inicio():
    return jsonify({
        "aplicacion": "TaskFlow",
        "mensaje": "Backend funcionando correctamente",
        "instancia": INSTANCIA
    })


# Consultar todas las tareas
@app.route("/api/tareas", methods=["GET"])
def listar_tareas():
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, titulo, descripcion, prioridad,
                   estado, fecha_creacion
            FROM tareas
            ORDER BY id DESC
        """)

        tareas = cursor.fetchall()

        cursor.close()
        conexion.close()

        return jsonify(tareas), 200

    except Exception as error:
        app.logger.exception("Error consultando tareas")
        return jsonify({"error": "No se pudieron consultar las tareas"}), 500


# Consultar una tarea
@app.route("/api/tareas/<int:id>", methods=["GET"])
def obtener_tarea(id):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM tareas WHERE id = %s",
            (id,)
        )

        tarea = cursor.fetchone()

        cursor.close()
        conexion.close()

        if not tarea:
            return jsonify({"error": "Tarea no encontrada"}), 404

        return jsonify(tarea), 200

    except Exception:
        app.logger.exception("Error consultando tarea")
        return jsonify({"error": "Error interno"}), 500


# Crear una tarea
@app.route("/api/tareas", methods=["POST"])
def crear_tarea():
    datos = request.get_json(silent=True) or {}

    titulo = datos.get("titulo")
    descripcion = datos.get("descripcion", "")
    prioridad = datos.get("prioridad", "media")

    if not isinstance(titulo, str) or not titulo.strip():
        return jsonify({"error": "El titulo es obligatorio"}), 400

    if not isinstance(descripcion, str):
        return jsonify({"error": "Descripcion invalida"}), 400

    if prioridad not in ["baja", "media", "alta"]:
        return jsonify({"error": "Prioridad invalida"}), 400

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            INSERT INTO tareas (titulo, descripcion, prioridad)
            VALUES (%s, %s, %s)
        """, (titulo.strip(), descripcion.strip(), prioridad))

        conexion.commit()
        nuevo_id = cursor.lastrowid

        cursor.close()
        conexion.close()

        return jsonify({
            "mensaje": "Tarea creada correctamente",
            "id": nuevo_id,
            "instancia": INSTANCIA
        }), 201

    except Exception:
        app.logger.exception("Error creando tarea")
        return jsonify({"error": "No se pudo crear la tarea"}), 500


# Actualizar una tarea
@app.route("/api/tareas/<int:id>", methods=["PUT"])
def actualizar_tarea(id):
    datos = request.get_json(silent=True) or {}

    campos = {
        "titulo": datos.get("titulo"),
        "descripcion": datos.get("descripcion"),
        "prioridad": datos.get("prioridad"),
        "estado": datos.get("estado")
    }

    if not campos or all(valor is None for valor in campos.values()):
        return jsonify({"error": "No hay datos para actualizar"}), 400

    if campos["titulo"] is not None:
        if not isinstance(campos["titulo"], str) or not campos["titulo"].strip():
            return jsonify({"error": "Titulo invalido"}), 400

    if campos["descripcion"] is not None and not isinstance(campos["descripcion"], str):
        return jsonify({"error": "Descripcion invalida"}), 400

    if campos["prioridad"] is not None and campos["prioridad"] not in ["baja", "media", "alta"]:
        return jsonify({"error": "Prioridad invalida"}), 400

    if campos["estado"] is not None and campos["estado"] not in ["pendiente", "completada"]:
        return jsonify({"error": "Estado invalido"}), 400

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        asignaciones = []
        valores = []

        for campo, valor in campos.items():
            if valor is not None:
                asignaciones.append(f"{campo} = %s")
                valores.append(valor.strip() if isinstance(valor, str) else valor)

        valores.append(id)

        cursor.execute(
            f"UPDATE tareas SET {', '.join(asignaciones)} WHERE id = %s",
            tuple(valores)
        )

        conexion.commit()

        if cursor.rowcount == 0:
            cursor.close()
            conexion.close()

            return jsonify({"error": "Tarea no encontrada o sin cambios"}), 404

        cursor.close()
        conexion.close()

        return jsonify({
            "mensaje": "Tarea actualizada correctamente",
            "instancia": INSTANCIA
        }), 200

    except Exception:
        app.logger.exception("Error actualizando tarea")
        return jsonify({"error": "No se pudo actualizar la tarea"}), 500


# Eliminar una tarea
@app.route("/api/tareas/<int:id>", methods=["DELETE"])
def eliminar_tarea(id):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "DELETE FROM tareas WHERE id = %s",
            (id,)
        )

        conexion.commit()
        eliminadas = cursor.rowcount

        cursor.close()
        conexion.close()

        if eliminadas == 0:
            return jsonify({"error": "Tarea no encontrada"}), 404

        return jsonify({
            "mensaje": "Tarea eliminada correctamente",
            "instancia": INSTANCIA
        }), 200

    except Exception:
        app.logger.exception("Error eliminando tarea")
        return jsonify({"error": "No se pudo eliminar la tarea"}), 500


# Metricas para Prometheus
@app.route("/metrics", methods=["GET"])
def metricas():
    return generate_latest(), 200, {
        "Content-Type": CONTENT_TYPE_LATEST
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)