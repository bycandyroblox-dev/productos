// Mostrar fecha en UI
const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-ES', dateOptions);

function mostrarCarga(mostrar) {
    document.getElementById('loading-cloud').style.display = mostrar ? 'block' : 'none';
}

// Lógica de Vistas Dinámicas
async function cargarVista(vista, usuarioStr, elementoMenu) {
    usuarioActual = usuarioStr;
    vistaActual = vista;

    // Actualizar menú activo
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if(elementoMenu) elementoMenu.classList.add('active');

    const contenedor = document.getElementById('vista-contenedor');
    
    // Configurar Título
    if(vista === 'dashboard') {
        document.getElementById('page-title').textContent = "Dashboard Global de Inventario";
    } else {
        document.getElementById('page-title').textContent = `Panel de Gestión: ${usuarioActual}`;
    }

    try {
        // Obtenemos el archivo HTML de la carpeta views/
        const respuesta = await fetch(`views/${vista}.html`);
        const html = await respuesta.text();
        
        // Inyectamos el HTML con animación
        contenedor.innerHTML = `<div class="anim-fade">${html}</div>`;
        
        // Una vez cargado el HTML, pintamos los datos
        actualizarPantalla();

    } catch (error) {
        console.error('Error cargando la vista:', error);
        contenedor.innerHTML = '<p>Error al cargar la página.</p>';
    }
}