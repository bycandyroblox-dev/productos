document.getElementById('password').addEventListener('keypress', e => { 
    if(e.key === 'Enter') iniciarSesion(); 
});

function iniciarSesion() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const claveActual = localStorage.getItem('tambo_pass') || 'elvira';

    if (u === 'tambo' && p === claveActual) {
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('appView').style.display = 'flex';
        
        // Cargar vista inicial
        document.querySelector('.nav-link.active').click();
        
        // Iniciar conexión a Firebase
        conectarBD(); 
    } else {
        document.getElementById('error-msg').style.display = 'block';
    }
}

function cerrarSesion() {
    document.getElementById('appView').style.display = 'none';
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('password').value = '';
}
