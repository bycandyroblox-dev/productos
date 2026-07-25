// ==========================================
// CONEXIÓN EN TIEMPO REAL CON FIREBASE
// ==========================================
function conectarBD() {
    mostrarCarga(true);
    
    // Escucha cualquier cambio en la colección 'productos' en tiempo real
    db.collection("productos").onSnapshot((querySnapshot) => {
        inventarioGeneral = [];
        querySnapshot.forEach((doc) => {
            inventarioGeneral.push({ id: doc.id, ...doc.data(), editando: false });
        });
        
        // Ordena por fecha de expiración automáticamente
        inventarioGeneral.sort((a, b) => new Date(a.expiracion) - new Date(b.expiracion));
        
        actualizarPantalla();
        mostrarCarga(false);
    }, (error) => {
        console.error("Error Firebase:", error);
        mostrarCarga(false);
    });
}

// ==========================================
// FUNCIONES MATEMÁTICAS Y DE ESTADO
// ==========================================
function calcularDias(fechaExpiracion) {
    const hoy = new Date(); 
    hoy.setHours(0,0,0,0);
    const exp = new Date(fechaExpiracion); 
    exp.setMinutes(exp.getMinutes() + exp.getTimezoneOffset());
    
    // Calculamos los días reales que faltan
    const diasReales = Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24));
    
    // REGLA ESTRICTA: Si faltan 5 días o menos (o si ya pasó la fecha), 
    // forzamos a que el sistema muestre 0 días.
    if (diasReales <= 5) {
        return 0;
    }
    
    // Si faltan más de 5 días, muestra los días normales
    return diasReales;
}

// ==========================================
// CONTROLADOR CENTRAL DE LA INTERFAZ
// ==========================================
function actualizarPantalla() {
    if(vistaActual === 'dashboard') {
        renderizarKPIsGlobales();
        dibujarGraficoGlobal();
        renderizarAlertasGlobales();
    } else if (vistaActual === 'usuario') {
        renderizarTablaUsuario();
    }
}

// ==========================================
// VISTA: USUARIO (Susan, Jhony, etc.)
// ==========================================
function agregarProducto() {
    const n = document.getElementById('new-product').value;
    const d = document.getElementById('new-date').value;
    
    if(!n || !d) return alert('Completa todos los campos');
    
    mostrarCarga(true);
    
    db.collection("productos").add({ 
        nombre: n, 
        expiracion: d, 
        responsable: usuarioActual 
    }).then(() => {
        document.getElementById('new-product').value = '';
        document.getElementById('new-date').value = '';
    });
}

function eliminarProducto(idDoc, nombre) {
    if(confirm(`¿Eliminar ${nombre}?`)) {
        mostrarCarga(true);
        db.collection("productos").doc(idDoc).delete();
    }
}

function renderizarTablaUsuario() {
    const tbody = document.getElementById('table-body');
    if(!tbody) return; 
    
    tbody.innerHTML = '';
    const searchInput = document.getElementById('searchInput');
    const filtro = searchInput ? searchInput.value.toLowerCase() : '';

    const miInventario = inventarioGeneral.filter(item => 
        item.responsable === usuarioActual && 
        item.nombre.toLowerCase().includes(filtro)
    );

    if(miInventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay productos registrados.</td></tr>`;
        return;
    }

    miInventario.forEach((item) => {
        const dias = calcularDias(item.expiracion);
        const st = getEstadoObj(dias);
        
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700;">${item.nombre}</td>
                <td style="color:#64748b;">${item.expiracion}</td>
                <td><strong>${dias}</strong></td>
                <td><span class="badge ${st.c}"><i class="fas ${st.i}"></i> ${st.t}</span></td>
                <td class="action-btns">
                    <button class="btn-action del-btn" onclick="eliminarProducto('${item.id}', '${item.nombre}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// VISTA: DASHBOARD GLOBAL
// ==========================================
function renderizarKPIsGlobales() {
    const kpiTotal = document.getElementById('kpi-total');
    if(!kpiTotal) return;

    let b = 0, c = 0, v = 0;
    inventarioGeneral.forEach(i => {
        const dias = calcularDias(i.expiracion);
        // NUEVA REGLA PARA LOS NÚMEROS: <= 5 es Vencido
        if(dias <= 5) v++; 
        else if(dias <= 15) c++; 
        else b++;
    });
    
    kpiTotal.textContent = inventarioGeneral.length;
    document.getElementById('kpi-bueno').textContent = b;
    document.getElementById('kpi-critico').textContent = c;
    document.getElementById('kpi-vencido').textContent = v;
}

function dibujarGraficoGlobal() {
    const canvas = document.getElementById('statusChart');
    if(!canvas) return;

    let b = 0, c = 0, v = 0;
    inventarioGeneral.forEach(i => { 
        const d = calcularDias(i.expiracion); 
        if(d <= 5) v++; 
        else if(d <= 15) c++; 
        else b++; 
    });
    
    if(statusChartInstance) statusChartInstance.destroy();
    
    const ctx = canvas.getContext('2d');
    statusChartInstance = new Chart(ctx, {
        type: 'doughnut', 
        data: { 
            labels: ['Bueno', 'Crítico', 'Vencido'], 
            datasets: [{ 
                data: [b, c, v], 
                backgroundColor: ['#05cd99', '#ffce20', '#ee5d50'], 
                borderWidth: 0 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'bottom' } }, 
            cutout: '70%' 
        }
    });
}

function renderizarAlertasGlobales() {
    const tbody = document.getElementById('alerta-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    // Muestra los primeros 7 productos críticos (dias entre 6 y 15)
    const criticos = inventarioGeneral.filter(i => {
        const d = calcularDias(i.expiracion);
        return d > 5 && d <= 15;
    }).slice(0, 7);
    
    if(criticos.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay productos en estado crítico actualmente.</td></tr>'; 
        return; 
    }
    
    criticos.forEach(item => {
        const d = calcularDias(item.expiracion); 
        const st = getEstadoObj(d);
        const resp = item.responsable ? item.responsable : 'General';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:600; font-size:13px;">${item.nombre}</td>
                <td><span style="font-size:11px; background:#e2e8f0; padding:3px 8px; border-radius:10px;">${resp}</span></td>
                <td style="color:var(--text-main); font-weight:bold;">${d} d</td>
                <td><span class="badge ${st.c}"><i class="fas ${st.i}"></i></span></td>
            </tr>`;
    });
}
