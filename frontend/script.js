// ==========================================
// TASKFLOW - APLICACION PRINCIPAL
// ==========================================

const API_URL = "/api/tareas";
const instanciaBackend = document.getElementById("instanciaBackend");

function actualizarInstancia(respuesta) {
    const instancia = respuesta.headers.get("X-Backend-Instance");

    if (instancia && instanciaBackend) {
        instanciaBackend.textContent = `Instancia: ${instancia}`;
    }
}

let tareas = [];
let filtroEstado = "todas";
let tareaEditando = null;
let vistaActual = "dashboard";
let temporizadorNotificacion;


// ==========================================
// ELEMENTOS DEL DOM
// ==========================================

const listaTareas = document.getElementById("listaTareas");

const totalTareas = document.getElementById("totalTareas");
const tareasPendientes = document.getElementById("tareasPendientes");
const tareasCompletadas = document.getElementById("tareasCompletadas");
const progresoTareas = document.getElementById("progresoTareas");

const overviewSection = document.getElementById("overviewSection");
const tasksSection = document.getElementById("tasksSection");

const tareasRecientes = document.getElementById("tareasRecientes");
const tareasPrioritarias = document.getElementById("tareasPrioritarias");
const barraProgreso = document.getElementById("barraProgreso");
const textoProgreso = document.getElementById("textoProgreso");
const resumenProgreso = document.getElementById("resumenProgreso");

const modalTarea = document.getElementById("modalTarea");
const formularioTarea = document.getElementById("formularioTarea");
const tituloModal = document.getElementById("tituloModal");

const inputTitulo = document.getElementById("titulo");
const inputDescripcion = document.getElementById("descripcion");
const inputPrioridad = document.getElementById("prioridad");
const inputEstado = document.getElementById("estado");

const buscarTarea = document.getElementById("buscarTarea");
const filtroPrioridad = document.getElementById("filtroPrioridad");

const notificacion = document.getElementById("notificacion");
const breadcrumbTitulo = document.querySelector(".breadcrumb strong");


// ==========================================
// INICIALIZACION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("btnNuevaTarea")
        .addEventListener("click", abrirModalCrear);

    document.getElementById("btnCerrarModal")
        .addEventListener("click", cerrarModal);

    document.getElementById("btnCancelar")
        .addEventListener("click", cerrarModal);

    formularioTarea.addEventListener("submit", guardarTarea);

    buscarTarea.addEventListener("input", renderizarTareas);
    filtroPrioridad.addEventListener("change", renderizarTareas);

    // Navegacion lateral
    document.querySelectorAll(".nav-item").forEach(boton => {
        boton.addEventListener("click", () => {
            const vista = boton.dataset.view;

            if (vista === "dashboard") {
                cambiarVista("dashboard");
                return;
            }

            const filtro = boton.dataset.filter || "todas";
            cambiarVista("tasks", filtro);
        });
    });

    // Pestañas dentro de Todas las tareas
    document.querySelectorAll(".tab-button").forEach(boton => {
        boton.addEventListener("click", () => {
            cambiarVista("tasks", boton.dataset.filter);
        });
    });

    // Volver al listado desde el dashboard
    document.getElementById("verTodasRecientes")
        .addEventListener("click", () => {
            cambiarVista("tasks", "todas");
        });

    // Cerrar modal al hacer clic fuera
    modalTarea.addEventListener("click", evento => {
        if (evento.target === modalTarea) {
            cerrarModal();
        }
    });

    // Estado inicial
    cambiarVista("dashboard");
    cargarTareas();
});


// ==========================================
// CAMBIAR ENTRE VISTAS
// ==========================================

function cambiarVista(vista, filtro = "todas") {

    vistaActual = vista;

    const esDashboard = vista === "dashboard";

    overviewSection.classList.toggle("hidden", !esDashboard);
    tasksSection.classList.toggle("hidden", esDashboard);

    if (esDashboard) {
        breadcrumbTitulo.textContent = "Panel principal";
        actualizarNavegacion("dashboard");
        return;
    }

    filtroEstado = filtro;
    breadcrumbTitulo.textContent =
        filtro === "pendiente" ? "Pendientes" :
        filtro === "completada" ? "Completadas" :
        "Todas las tareas";

    actualizarNavegacion(filtro);

    document.querySelectorAll(".tab-button").forEach(boton => {
        boton.classList.toggle(
            "active",
            boton.dataset.filter === filtro
        );
    });

    renderizarTareas();
}


// ==========================================
// ACTUALIZAR MENU LATERAL
// ==========================================

function actualizarNavegacion(vista) {

    document.querySelectorAll(".nav-item").forEach(boton => {

        const esActivo =
            (vista === "dashboard" && boton.dataset.view === "dashboard") ||
            (vista === "todas" && boton.dataset.view === "tasks" && !boton.dataset.filter) ||
            (vista === "pendiente" && boton.dataset.filter === "pendiente") ||
            (vista === "completada" && boton.dataset.filter === "completada");

        boton.classList.toggle("active", esActivo);
    });
}


// ==========================================
// CARGAR TAREAS DESDE LA API
// ==========================================

async function cargarTareas() {

    try {

        listaTareas.innerHTML = `
            <div class="loading-message">Cargando tareas...</div>
        `;

        const respuesta = await fetch(API_URL);
        actualizarInstancia(respuesta);

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las tareas");
        }

        tareas = await respuesta.json();

        actualizarEstadisticas();
        actualizarDashboard();
        renderizarTareas();

    } catch (error) {

        console.error("Error al cargar tareas:", error);

        listaTareas.innerHTML = `
            <div class="empty-message">
                No fue posible cargar las tareas.
                Comprueba que Flask y MariaDB estén funcionando.
            </div>
        `;

        tareasRecientes.innerHTML = `
            <div class="overview-empty">No se pudieron cargar las actividades.</div>
        `;

        tareasPrioritarias.innerHTML = `
            <div class="overview-empty">No se pudieron cargar las prioridades.</div>
        `;

        mostrarNotificacion("Error al cargar las tareas");
    }
}


// ==========================================
// ACTUALIZAR ESTADISTICAS
// ==========================================

function actualizarEstadisticas() {

    const total = tareas.length;

    const pendientes = tareas.filter(
        tarea => tarea.estado === "pendiente"
    ).length;

    const completadas = tareas.filter(
        tarea => tarea.estado === "completada"
    ).length;

    const progreso = total === 0
        ? 0
        : Math.round((completadas / total) * 100);

    totalTareas.textContent = total;
    tareasPendientes.textContent = pendientes;
    tareasCompletadas.textContent = completadas;
    progresoTareas.textContent = `${progreso}%`;
}


// ==========================================
// ACTUALIZAR TODO EL DASHBOARD
// ==========================================

function actualizarDashboard() {
    renderizarRecientes();
    renderizarPrioritarias();
    actualizarProgreso();
}


// ==========================================
// ACTIVIDAD RECIENTE
// ==========================================

function renderizarRecientes() {

    tareasRecientes.replaceChildren();

    const recientes = [...tareas]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, 4);

    if (recientes.length === 0) {
        mostrarEstadoVacio(
            tareasRecientes,
            "Todavía no tienes actividades registradas."
        );
        return;
    }

    recientes.forEach(tarea => {

        const fila = document.createElement("div");
        fila.className = "overview-task";

        if (tarea.estado === "completada") {
            fila.classList.add("completed");
        }

        const informacion = document.createElement("div");
        informacion.className = "overview-task-info";

        const titulo = document.createElement("h3");
        titulo.textContent = tarea.titulo;

        const descripcion = document.createElement("p");
        descripcion.textContent =
            tarea.estado === "completada"
                ? "Actividad completada"
                : "Pendiente de completar";

        informacion.append(titulo, descripcion);

        const etiqueta = crearEtiquetaPrioridad(tarea.prioridad);

        fila.append(informacion, etiqueta);
        tareasRecientes.appendChild(fila);
    });
}


// ==========================================
// TAREAS PENDIENTES DE PRIORIDAD ALTA
// ==========================================

function renderizarPrioritarias() {

    tareasPrioritarias.replaceChildren();

    const prioritarias = tareas
        .filter(tarea =>
            tarea.prioridad === "alta" &&
            tarea.estado === "pendiente"
        )
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, 4);

    if (prioritarias.length === 0) {
        mostrarEstadoVacio(
            tareasPrioritarias,
            "¡Excelente! No tienes tareas urgentes pendientes."
        );
        return;
    }

    prioritarias.forEach(tarea => {

        const fila = document.createElement("div");
        fila.className = "overview-task";

        const informacion = document.createElement("div");
        informacion.className = "overview-task-info";

        const titulo = document.createElement("h3");
        titulo.textContent = tarea.titulo;

        const descripcion = document.createElement("p");
        descripcion.textContent = "Requiere atención";

        informacion.append(titulo, descripcion);

        const etiqueta = crearEtiquetaPrioridad("alta");

        fila.append(informacion, etiqueta);
        tareasPrioritarias.appendChild(fila);
    });
}


// ==========================================
// BARRA DE PROGRESO
// ==========================================

function actualizarProgreso() {

    const total = tareas.length;

    const completadas = tareas.filter(
        tarea => tarea.estado === "completada"
    ).length;

    const porcentaje = total === 0
        ? 0
        : Math.round((completadas / total) * 100);

    barraProgreso.style.width = `${porcentaje}%`;
    textoProgreso.textContent = `${porcentaje}% completado`;
    resumenProgreso.textContent = `${completadas} de ${total} tareas`;
}


// ==========================================
// UTILIDADES VISUALES DEL DASHBOARD
// ==========================================

function crearEtiquetaPrioridad(prioridad) {

    const etiqueta = document.createElement("span");
    etiqueta.className = `priority ${prioridad}`;

    etiqueta.textContent =
        prioridad.charAt(0).toUpperCase() + prioridad.slice(1);

    return etiqueta;
}


function mostrarEstadoVacio(contenedor, mensaje) {

    const elemento = document.createElement("div");
    elemento.className = "overview-empty";
    elemento.textContent = mensaje;

    contenedor.appendChild(elemento);
}


// ==========================================
// RENDERIZAR LISTADO DE TAREAS
// ==========================================

function renderizarTareas() {

    if (!listaTareas || !buscarTarea || !filtroPrioridad) return;

    const busqueda = buscarTarea.value.toLowerCase().trim();
    const prioridadSeleccionada = filtroPrioridad.value;

    const tareasFiltradas = tareas.filter(tarea => {

        const coincideEstado =
            filtroEstado === "todas" ||
            tarea.estado === filtroEstado;

        const coincidePrioridad =
            prioridadSeleccionada === "todas" ||
            tarea.prioridad === prioridadSeleccionada;

        const coincideBusqueda =
            (tarea.titulo || "").toLowerCase().includes(busqueda) ||
            (tarea.descripcion || "").toLowerCase().includes(busqueda);

        return coincideEstado && coincidePrioridad && coincideBusqueda;
    });

    listaTareas.replaceChildren();

    if (tareasFiltradas.length === 0) {

        const mensaje = document.createElement("div");
        mensaje.className = "empty-message";

        mensaje.textContent = tareas.length === 0
            ? "Todavía no tienes tareas. ¡Crea tu primera actividad!"
            : "No se encontraron tareas con estos filtros.";

        listaTareas.appendChild(mensaje);

    } else {

        tareasFiltradas.forEach(tarea => {
            listaTareas.appendChild(crearElementoTarea(tarea));
        });
    }

    document.getElementById("contadorTareas").textContent =
        `Mostrando ${tareasFiltradas.length} de ${tareas.length} tareas`;
}


// ==========================================
// CREAR ELEMENTO VISUAL DE UNA TAREA
// ==========================================

function crearElementoTarea(tarea) {

    const elemento = document.createElement("article");
    elemento.className = "task-item";

    if (tarea.estado === "completada") {
        elemento.classList.add("completed");
    }

    const principal = document.createElement("div");
    principal.className = "task-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = tarea.estado === "completada";
    checkbox.setAttribute("aria-label", "Cambiar estado de la tarea");

    checkbox.addEventListener("change", () => cambiarEstado(tarea));

    const detalles = document.createElement("div");
    detalles.className = "task-details";

    const titulo = document.createElement("h3");
    titulo.textContent = tarea.titulo;

    const descripcion = document.createElement("p");
    descripcion.textContent = tarea.descripcion || "Sin descripción";

    detalles.append(titulo, descripcion);
    principal.append(checkbox, detalles);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const prioridad = crearEtiquetaPrioridad(tarea.prioridad);

    const estado = document.createElement("span");
    estado.className = "task-status";
    estado.textContent = tarea.estado === "completada"
        ? "Completada"
        : "Pendiente";

    meta.append(prioridad, estado);

    const menu = document.createElement("div");
    menu.className = "task-menu";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.textContent = "✎";
    editar.title = "Editar tarea";
    editar.setAttribute("aria-label", "Editar tarea");

    editar.addEventListener("click", () => abrirModalEditar(tarea));

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.textContent = "⌫";
    eliminar.title = "Eliminar tarea";
    eliminar.setAttribute("aria-label", "Eliminar tarea");
    eliminar.classList.add("delete-task");

    eliminar.addEventListener("click", () => eliminarTarea(tarea.id));

    menu.append(editar, eliminar);
    elemento.append(principal, meta, menu);

    return elemento;
}


// ==========================================
// ABRIR MODAL PARA CREAR
// ==========================================

function abrirModalCrear() {

    tareaEditando = null;
    formularioTarea.reset();

    tituloModal.textContent = "Nueva tarea";
    inputPrioridad.value = "media";
    inputEstado.value = "pendiente";

    modalTarea.classList.add("active");
    inputTitulo.focus();
}


// ==========================================
// ABRIR MODAL PARA EDITAR
// ==========================================

function abrirModalEditar(tarea) {

    tareaEditando = tarea.id;

    tituloModal.textContent = "Editar tarea";
    inputTitulo.value = tarea.titulo;
    inputDescripcion.value = tarea.descripcion || "";
    inputPrioridad.value = tarea.prioridad;
    inputEstado.value = tarea.estado;

    modalTarea.classList.add("active");
    inputTitulo.focus();
}


// ==========================================
// CERRAR MODAL
// ==========================================

function cerrarModal() {

    modalTarea.classList.remove("active");
    formularioTarea.reset();
    tareaEditando = null;
}


// ==========================================
// GUARDAR TAREA (CREAR O EDITAR)
// ==========================================

async function guardarTarea(evento) {

    evento.preventDefault();

    const datos = {
        titulo: inputTitulo.value.trim(),
        descripcion: inputDescripcion.value.trim(),
        prioridad: inputPrioridad.value,
        estado: inputEstado.value
    };

    if (!datos.titulo) {
        mostrarNotificacion("El título es obligatorio");
        return;
    }

    const editando = tareaEditando !== null;

    const url = editando
        ? `${API_URL}/${tareaEditando}`
        : API_URL;

    const metodo = editando ? "PUT" : "POST";

    try {

        const respuesta = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });
        actualizarInstancia(respuesta);

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo guardar la tarea");
        }

        cerrarModal();

        mostrarNotificacion(
            editando
                ? "Tarea actualizada correctamente"
                : "Tarea creada correctamente"
        );

        await cargarTareas();

    } catch (error) {

        console.error("Error al guardar:", error);
        mostrarNotificacion(error.message);
    }
}


// ==========================================
// CAMBIAR ESTADO DE UNA TAREA
// ==========================================

async function cambiarEstado(tarea) {

    const nuevoEstado = tarea.estado === "pendiente"
        ? "completada"
        : "pendiente";

    try {

        const respuesta = await fetch(`${API_URL}/${tarea.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                estado: nuevoEstado
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo cambiar el estado");
        }

        mostrarNotificacion(
            nuevoEstado === "completada"
                ? "¡Tarea completada!"
                : "Tarea marcada como pendiente"
        );

        await cargarTareas();

    } catch (error) {

        console.error("Error al cambiar estado:", error);
        mostrarNotificacion(error.message);
        await cargarTareas();
    }
}


// ==========================================
// ELIMINAR TAREA
// ==========================================

async function eliminarTarea(id) {

    const confirmar = confirm(
        "¿Estás seguro de que deseas eliminar esta tarea?"
    );

    if (!confirmar) return;

    try {

        const respuesta = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });
        actualizarInstancia(respuesta);

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo eliminar la tarea");
        }

        mostrarNotificacion("Tarea eliminada correctamente");
        await cargarTareas();

    } catch (error) {

        console.error("Error al eliminar:", error);
        mostrarNotificacion(error.message);
    }
}


// ==========================================
// NOTIFICACIONES
// ==========================================

function mostrarNotificacion(mensaje) {

    notificacion.textContent = mensaje;
    notificacion.classList.add("show");

    clearTimeout(temporizadorNotificacion);

    temporizadorNotificacion = setTimeout(() => {
        notificacion.classList.remove("show");
    }, 3000);
}
