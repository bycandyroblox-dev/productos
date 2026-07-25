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
    return Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24));
}

function getEstadoObj(dias) {
    if(dias < 0) return { t: 'Vencido', c: 'b-vencido', i: 'fa-times' };
    if(dias <= 15) return { t: 'Crítico', c: 'b-critico', i: 'fa-exclamation' };
    return { t: 'Bueno', c: 'b-bueno', i: 'fa-check' };
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
    
    // Guarda el producto pero le asigna el nombre del usuario (ej: "Susan" o "Jhony")
    db.collection("productos").add({ 
        nombre: n, 
        expiracion: d, 
        responsable: usuarioActual 
    }).then(() => {
        document.getElementById('new-product').value = '';
        document.getElementById('new-date').value = '';
        // No es necesario llamar a actualizarPantalla() porque 'onSnapshot' lo hace solo
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
    if(!tbody) return; // Previene errores si no está en la vista de usuario
    
    tbody.innerHTML = '';
    const searchInput = document.getElementById('searchInput');
    const filtro = searchInput ? searchInput.value.toLowerCase() : '';

    // Filtrar: Solo los del usuario actual + buscador por texto
    const miInventario = inventarioGeneral.filter(item => 
        item.responsable === usuarioActual && 
        item.nombre.toLowerCase().includes(filtro)
    );

    if(miInventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay productos registrados por ${usuarioActual}.</td></tr>`;
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
        if(dias < 0) v++; else if(dias <= 15) c++; else b++;
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
    inventarioGeneral.forEach(i => { const d = calcularDias(i.expiracion); if(d < 0) v++; else if(d <= 15) c++; else b++; });
    
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
    // Muestra los primeros 7 productos críticos (de cualquier usuario)
    const criticos = inventarioGeneral.filter(i => calcularDias(i.expiracion) <= 15).slice(0, 7);
    
    if(criticos.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Todo en orden en general.</td></tr>'; 
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
                <td style="color:${st.c === 'b-vencido' ? 'var(--danger)' : 'var(--text-main)'}; font-weight:bold;">${d} d</td>
                <td><span class="badge ${st.c}"><i class="fas ${st.i}"></i></span></td>
            </tr>`;
    });
}

// ==========================================
// VISTA: CONFIGURACIÓN (CARGA INICIAL DE EXCEL)
// ==========================================
const ExcelOriginal = [
    {"nombre": "Galleta Nutri quinoa con naranja 30 g", "expiracion": "2026-08-01"}, 
    {"nombre": "Queque Bimbolete sabor vainilla 3 unid.", "expiracion": "2026-08-01"}, 
    {"nombre": "Ajinomix mezcla lista para empanar receta crocante", "expiracion": "2026-08-02"}, 
    {"nombre": "Gancitos Marinela", "expiracion": "2026-08-04"}, 
    {"nombre": "Queque Bimbolete marmoleado 105 g", "expiracion": "2026-08-05"}, 
    {"nombre": "Pingüinos Marinela vainilla", "expiracion": "2026-08-07"}, 
    {"nombre": "Queque Bimbolete de vainilla 105 g", "expiracion": "2026-08-07"}, 
    {"nombre": "Pan Bimbo 100% integral 620 g", "expiracion": "2026-08-08"}, 
    {"nombre": "Clavita panetier dulcísimo pan dulce relleno crema chocolate y avellanas", "expiracion": "2026-08-08"}, 
    {"nombre": "Chocolate Chinchín Choco Top tableta 80 g", "expiracion": "2026-08-09"}, 
    {"nombre": "King Kong de tres sabores San José con manjar norteño 80 g", "expiracion": "2026-08-09"}, 
    {"nombre": "Queques gancito 50 g", "expiracion": "2026-08-10"}, 
    {"nombre": "Marshmallows Ambrosoli surtido 270 g", "expiracion": "2026-08-11"}, 
    {"nombre": "Pan molde La Vita Panetierre blanco 400 g", "expiracion": "2026-08-11"}, 
    {"nombre": "Barra de cereal Cereal Bar maní 21 g", "expiracion": "2026-08-11"}, 
    {"nombre": "Queque Paicé naranja 90 g", "expiracion": "2026-08-12"}, 
    {"nombre": "Gomitas Trolly Classic Bears 100 g", "expiracion": "2026-08-13"}, 
    {"nombre": "Tortilla integral bimbo 310 g rapiditas integrales", "expiracion": "2026-08-13"}, 
    {"nombre": "Wafer Nick vainilla", "expiracion": "2026-08-15"}, 
    {"nombre": "Pingüinos sabor cookies and cream", "expiracion": "2026-08-15"}, 
    {"nombre": "Bizcocho con relleno dulcísimo manjar chocolate 48 g", "expiracion": "2026-08-15"}, 
    {"nombre": "Queque Bimbolete marmoleado 105 g", "expiracion": "2026-08-17"}, 
    {"nombre": "Pan Bimbo blanco pan de molde blanco 590 g", "expiracion": "2026-08-17"}, 
    {"nombre": "Tostada Bimbo clásica 160 g", "expiracion": "2026-08-19"}, 
    {"nombre": "Queque Paicé vainilla 90 g", "expiracion": "2026-08-20"}, 
    {"nombre": "Pan Bimbo Vital chía y linaza con masa madre 350 g", "expiracion": "2026-08-20"}, 
    {"nombre": "Galleta de maíz Salmas 18 g", "expiracion": "2026-08-21"}, 
    {"nombre": "Marshmallow Oleolé vainilla 200 g", "expiracion": "2026-08-21"}, 
    {"nombre": "Gomitas Mogul oso extreme 80 g", "expiracion": "2026-08-22"}, 
    {"nombre": "Pan blanco Bimbo más suave y esponjoso", "expiracion": "2026-08-22"}, 
    {"nombre": "Gomitas Grisly delfín 80 g", "expiracion": "2026-08-26"}, 
    {"nombre": "Milos Colombia surtido marshmallows 145 g", "expiracion": "2026-08-26"}, 
    {"nombre": "Tortilla clásica la pita panetiere 310 g 12 unid.", "expiracion": "2026-08-29"}, 
    {"nombre": "Wafer Mega Gene sabor chocolate 61 g", "expiracion": "2026-08-30"}, 
    {"nombre": "Pingüinos sabor cookies and cream 80 g", "expiracion": "2026-08-31"}, 
    {"nombre": "Pingüinos sabor cookies and cream 90 g", "expiracion": "2026-08-31"}, 
    {"nombre": "Club Social sabores de mantequilla", "expiracion": "2026-09-02"}, 
    {"nombre": "Pita panetierre 500 g", "expiracion": "2026-09-02"}, 
    {"nombre": "Queque Bimbolete de vainilla 110 g", "expiracion": "2026-09-02"}, 
    {"nombre": "Queque Bimbolete sabor vainilla Bimbo", "expiracion": "2026-09-02"}, 
    {"nombre": "Queque Bimbolete marmoleado 105 g", "expiracion": "2026-09-04"}, 
    {"nombre": "Bombón beso de moza clásico 9 unid.", "expiracion": "2026-09-07"}, 
    {"nombre": "Pingüinos Marinela", "expiracion": "2026-09-07"}, 
    {"nombre": "Pingüinos Biri Biri", "expiracion": "2026-09-07"}, 
    {"nombre": "Queque Bimbolete marmoleado 105 g", "expiracion": "2026-09-07"}, 
    {"nombre": "Tortillas clásicas 310 g", "expiracion": "2026-09-07"}, 
    {"nombre": "Palito con ajonjolí del Paraíso 55 g Crisinos saladitos", "expiracion": "2026-09-07"}, 
    {"nombre": "Artesano del Paraíso palitos con ajonjolí", "expiracion": "2026-09-07"}, 
    {"nombre": "Galletas Quinoa Cookies originales", "expiracion": "2026-09-12"}, 
    {"nombre": "Galleta vainilla San Jorge familiar 120 g", "expiracion": "2026-09-12"}, 
    {"nombre": "Manjar blanco Nestlé 200 g", "expiracion": "2026-09-12"}, 
    {"nombre": "Pingüinos sabor triple chocolate Biri Biri", "expiracion": "2026-09-14"}, 
    {"nombre": "King Kong de tres sabores San José 80 g", "expiracion": "2026-09-14"}, 
    {"nombre": "Turroncito San José 6 unid.", "expiracion": "2026-09-14"}, 
    {"nombre": "Galleta Sweet Bites Cookies avena y chispas de chocolate 100 g", "expiracion": "2026-09-16"}, 
    {"nombre": "Galletas Costa Cracker Güenass 22.5 g", "expiracion": "2026-09-19"}, 
    {"nombre": "Tortilla Bimbo 310 g", "expiracion": "2026-09-19"}, 
    {"nombre": "Frugos del valle mango", "expiracion": "2026-09-20"}, 
    {"nombre": "Galleta germen de trigo con ajonjolí Artesano del Paraíso 50 g", "expiracion": "2026-09-20"}, 
    {"nombre": "Artesano del Paraíso palitos con queso", "expiracion": "2026-09-20"}, 
    {"nombre": "Artesano del Paraíso germen de trigo y ajonjolí", "expiracion": "2026-09-21"}, 
    {"nombre": "Pingüinos Marinela triple sabor chocolate", "expiracion": "2026-09-24"}, 
    {"nombre": "Pingüinos triple sabor chocolate Marinela Edición limitada", "expiracion": "2026-09-24"}, 
    {"nombre": "Jugo frugos mango 235 ml", "expiracion": "2026-09-24"}, 
    {"nombre": "Bombón Zuli en caja especial 16 unid.", "expiracion": "2026-09-25"}, 
    {"nombre": "Wafer bañado Cocua 18 g", "expiracion": "2026-09-27"}, 
    {"nombre": "Turroncito crocante sabor a fresa 120 g", "expiracion": "2026-09-27"}, 
    {"nombre": "Gomitas Grisly gusanos 80 g", "expiracion": "2026-10-01"}, 
    {"nombre": "Club Social sabores sabor artificial a jamón ahumado", "expiracion": "2026-10-01"}, 
    {"nombre": "Wafer sabor vainilla 61 g", "expiracion": "2026-10-03"}, 
    {"nombre": "Galletas Dory 230 g", "expiracion": "2026-10-03"}, 
    {"nombre": "Galletas saladas 60 g", "expiracion": "2026-10-05"}, 
    {"nombre": "Wafer Nick fresa 27 g", "expiracion": "2026-10-06"}, 
    {"nombre": "Galleta Sweet Bites con avena y chispas 100 g", "expiracion": "2026-10-06"}, 
    {"nombre": "Trufas de chocolate Elena caja 38 g", "expiracion": "2026-10-08"}, 
    {"nombre": "Cereal Kellogg's Froot Loops Corn Flakes 110 g", "expiracion": "2026-10-09"}, 
    {"nombre": "Puré de papa corazón del fundo", "expiracion": "2026-10-14"}, 
    {"nombre": "Jugo Frugos durazno 970 ml", "expiracion": "2026-10-14"}, 
    {"nombre": "Jugo Frugos del valle sabor mango", "expiracion": "2026-10-14"}, 
    {"nombre": "Leche concentrada sin lactosa 390 ml", "expiracion": "2026-10-15"}, 
    {"nombre": "Wafer bañado Cocua Mini 42 g", "expiracion": "2026-10-16"}, 
    {"nombre": "Chocolate grajea Fochis pasas 60 g", "expiracion": "2026-10-17"}, 
    {"nombre": "Chocolate snack bonobom barra bañada 24 g", "expiracion": "2026-10-21"}, 
    {"nombre": "Leche sin lactosa live caja 946 ml", "expiracion": "2026-10-21"}, 
    {"nombre": "Artesano del Paraíso palitos con ajonjolí", "expiracion": "2026-10-21"}, 
    {"nombre": "Bombón princesa caja 16 unid.", "expiracion": "2026-10-22"}, 
    {"nombre": "Chocolate Bon o Bon Doypack 105 g", "expiracion": "2026-10-22"}, 
    {"nombre": "Cereal Froot Loops Kellogg's 275 g", "expiracion": "2026-10-22"}, 
    {"nombre": "Turrón Bañapepa La Vita Panetierre", "expiracion": "2026-10-22"}, 
    {"nombre": "Chocolatada Gloria 180 g", "expiracion": "2026-10-24"}, 
    {"nombre": "Wafer Nick fresa 72 g", "expiracion": "2026-10-25"}, 
    {"nombre": "Choco crema chinchin punch 13 g", "expiracion": "2026-10-25"}, 
    {"nombre": "Artesano del Paraíso galleta de trigo con yogur", "expiracion": "2026-10-25"}, 
    {"nombre": "Ketchup sabrosísima 100 g", "expiracion": "2026-10-27"}, 
    {"nombre": "Galleta de maíz Salmas granos y semillas", "expiracion": "2026-10-29"}, 
    {"nombre": "Artesano del Paraíso Kiwicha Rosquitas 65 g", "expiracion": "2026-11-01"}, 
    {"nombre": "Galletas Door 24 g", "expiracion": "2026-11-03"}, 
    {"nombre": "Galleta coconut San Jorge 55 g", "expiracion": "2026-11-06"}, 
    {"nombre": "Crema de maní Vive Day 200 g", "expiracion": "2026-11-09"}, 
    {"nombre": "Wafer Nick chocolate 72 g", "expiracion": "2026-11-10"}, 
    {"nombre": "Globos Pop", "expiracion": "2026-11-10"}, 
    {"nombre": "Galleta San Jorge fruta mixta 55 g", "expiracion": "2026-11-12"}, 
    {"nombre": "Galleta Club Social Costa Crackeler Snack 47 g", "expiracion": "2026-11-13"}, 
    {"nombre": "Wafer Nick chocolate", "expiracion": "2026-11-14"}, 
    {"nombre": "Galleta soda Field original 32 g", "expiracion": "2026-11-17"}, 
    {"nombre": "Chocolate Bon o Bon leche caja 90 g", "expiracion": "2026-11-17"}, 
    {"nombre": "Galleta Nutri quinoa cacao fresa 30 g", "expiracion": "2026-11-18"}, 
    {"nombre": "Mogul Extreme Jelly Beans 90 g", "expiracion": "2026-11-20"}, 
    {"nombre": "Leche entera 100% leche live 946 ml", "expiracion": "2026-11-20"}, 
    {"nombre": "Galleta fiel cream crackers 258 g", "expiracion": "2026-11-22"}, 
    {"nombre": "Rosquitas con ajonjolí del Paraíso 65 g", "expiracion": "2026-11-22"}, 
    {"nombre": "Six pack club social galleta regular 24", "expiracion": "2026-11-25"}, 
    {"nombre": "Wafer Hershey's Cookies'n'Cream 102 g", "expiracion": "2026-11-30"}, 
    {"nombre": "Quinoa corazón del fundo bolsa 400 g", "expiracion": "2026-11-30"}, 
    {"nombre": "Leche gloria light 946 ml", "expiracion": "2026-11-30"}, 
    {"nombre": "Chocolate Kiss con leche estuche Lazo 102 g", "expiracion": "2026-12-01"}, 
    {"nombre": "Conos para helado afelático 6 unid.", "expiracion": "2026-12-04"}, 
    {"nombre": "Harina sin preparar molitalia 1 kg", "expiracion": "2026-12-04"}, 
    {"nombre": "Club Social sabor integral tradicional", "expiracion": "2026-12-05"}, 
    {"nombre": "Galleta Tentación sabor chocolate 43 g", "expiracion": "2026-12-06"}, 
    {"nombre": "Harina molitalia preparada 1 kg", "expiracion": "2026-12-06"}, 
    {"nombre": "Nutri quinoa cookies con arándanos taco 2.3 proteína", "expiracion": "2026-12-10"}, 
    {"nombre": "Galletas Arcor Maná vainilla 136 g", "expiracion": "2026-12-10"}, 
    {"nombre": "Nutri quinoa cookies con fresa y cacao taco", "expiracion": "2026-12-12"}, 
    {"nombre": "Galleta cream cracker 73 g", "expiracion": "2026-12-12"}, 
    {"nombre": "Chocotón Donofrio bolsa 80 g", "expiracion": "2026-12-12"}, 
    {"nombre": "Galleta munición San Jorge 55 g", "expiracion": "2026-12-14"}, 
    {"nombre": "Salsa artesanal 100 g", "expiracion": "2026-12-14"}, 
    {"nombre": "Gloria leche chocolatada niños", "expiracion": "2026-12-16"}, 
    {"nombre": "Leche gloria cero lactosa 946 ml", "expiracion": "2026-12-17"}, 
    {"nombre": "Maíz popcorn corazón del fundo extra", "expiracion": "2026-12-20"}, 
    {"nombre": "Galleta Ritz mini original 50 g", "expiracion": "2026-12-21"}, 
    {"nombre": "Winters granos andinos instantáneo", "expiracion": "2026-12-21"}, 
    {"nombre": "Chocolatada leche sabor live niños", "expiracion": "2026-12-21"}, 
    {"nombre": "Chicles Aterra lengua súper hiperácido 22 g", "expiracion": "2026-12-22"}, 
    {"nombre": "Sidos macaroni y cheese happy original 226 g", "expiracion": "2026-12-23"}, 
    {"nombre": "Galleta Chomp chocolate 38 g", "expiracion": "2026-12-24"}, 
    {"nombre": "Galleta de arroz costeño finas hierbas 45 g", "expiracion": "2026-12-27"}, 
    {"nombre": "Galleta Tentación sabor naranja 43 g", "expiracion": "2026-12-27"}, 
    {"nombre": "Arroz extra corazón del fundo 750 g", "expiracion": "2026-12-27"}, 
    {"nombre": "Gloria pro sabor vainilla", "expiracion": "2026-12-27"}, 
    {"nombre": "Galleta Margarita Sayón taco 118 g", "expiracion": "2026-12-28"}, 
    {"nombre": "Arroz costeño extra", "expiracion": "2026-12-28"}, 
    {"nombre": "Barra de cereal chip Cereal Bar 21 g", "expiracion": "2026-12-28"}, 
    {"nombre": "Galleta San Jorge mini rondela 25 g", "expiracion": "2026-12-29"}, 
    {"nombre": "Gloria shake sabor mocaccino", "expiracion": "2026-12-29"}, 
    {"nombre": "Gloria shake sabor capuchino", "expiracion": "2026-12-30"}, 
    {"nombre": "Galletas de arroz Costeña clásica", "expiracion": "2027-01-02"}, 
    {"nombre": "Galletas San Jorge soda familiar 75 g", "expiracion": "2027-01-03"}, 
    {"nombre": "Gloria leche sabor fresa", "expiracion": "2027-01-03"}, 
    {"nombre": "Wafer Nick Maracuyango 72 g", "expiracion": "2027-01-04"}, 
    {"nombre": "Wafer Nick fresa 72 g", "expiracion": "2027-01-04"}, 
    {"nombre": "Galleta de arroz costeño clásica 45 g", "expiracion": "2027-01-04"}, 
    {"nombre": "Leche de almendras live 939 ml", "expiracion": "2027-01-04"}, 
    {"nombre": "Mondelez familiar leche 480 ml", "expiracion": "2027-01-04"}, 
    {"nombre": "Gomitas Ambrosia Ambrosoli 90 g", "expiracion": "2027-01-08"}, 
    {"nombre": "Panetón Todinno caja 85 g", "expiracion": "2027-01-09"}, 
    {"nombre": "Galleta Ritz queso 30 g", "expiracion": "2027-01-14"}, 
    {"nombre": "Cereal Zucaritas 90 g", "expiracion": "2027-01-15"}, 
    {"nombre": "Cereal Bar sabor chocolate 21 g", "expiracion": "2027-01-15"}, 
    {"nombre": "Galleta Margarita Sayón 41 g", "expiracion": "2027-01-16"}, 
    {"nombre": "Mister Brownie chocolate 50 g", "expiracion": "2027-01-17"}, 
    {"nombre": "Galletas San José Animalitos 150 g", "expiracion": "2027-01-22"}, 
    {"nombre": "Chocolate chinchín mini grajeas 224 g", "expiracion": "2027-01-22"}, 
    {"nombre": "Club social sabor jamón artificial ahumado regular 24 unid.", "expiracion": "2027-01-23"}, 
    {"nombre": "Cereal Angel Copos hechos con avena 120 g", "expiracion": "2027-01-23"}, 
    {"nombre": "Leche gloria entera 946 ml", "expiracion": "2027-01-24"}, 
    {"nombre": "Protein sabor caramelo, almendra y maní Costa", "expiracion": "2027-01-25"}, 
    {"nombre": "Gomitas Crisil delfín 80 g", "expiracion": "2027-01-26"}, 
    {"nombre": "Arveja verde partida corazón del fundo bolsa 400 g", "expiracion": "2027-01-27"}, 
    {"nombre": "Wafer bañado Tuyo Costa 22 g", "expiracion": "2027-01-28"}, 
    {"nombre": "Harina de maíz blanco pan 1 kg", "expiracion": "2027-01-31"}, 
    {"nombre": "Gomitas Grisly Gamer 80 g", "expiracion": "2027-02-02"}, 
    {"nombre": "Galleta Costa Club Social original", "expiracion": "2027-02-02"}, 
    {"nombre": "Chinchín choco conejo 4 unid.", "expiracion": "2027-02-02"}, 
    {"nombre": "Galleta Ritz de 20 g", "expiracion": "2027-02-03"}, 
    {"nombre": "Wafer Nick Maracuyango 27 g", "expiracion": "2027-02-05"}, 
    {"nombre": "Galletas de maíz horneadas Salmas", "expiracion": "2027-02-05"}, 
    {"nombre": "Galleta de agua 110 g", "expiracion": "2027-02-06"}, 
    {"nombre": "Club Social Extreme sabor barbacoa", "expiracion": "2027-02-07"}, 
    {"nombre": "Club social extreme sabor barbecue artificial 6 unid.", "expiracion": "2027-02-07"}, 
    {"nombre": "Gomitas Ambrosoli Lucy ácidas 90 g", "expiracion": "2027-02-11"}, 
    {"nombre": "Galleta Chomp naranja 38 g", "expiracion": "2027-02-11"}, 
    {"nombre": "Gomitas Trolly Pizza 15 g", "expiracion": "2027-02-11"}, 
    {"nombre": "Turrón oblea Arcón 25 g", "expiracion": "2027-02-12"}, 
    {"nombre": "Galleta soda San Jorge 6 unid. 40 g", "expiracion": "2027-02-18"}, 
    {"nombre": "Marshmallow mini Wandy 40 g", "expiracion": "2027-02-18"}, 
    {"nombre": "Galletas Ritz queso taco 75 g", "expiracion": "2027-02-19"}, 
    {"nombre": "Galleta Ritz taco de 70 g", "expiracion": "2027-02-19"}, 
    {"nombre": "Galleta San Jorge soda 40 g", "expiracion": "2027-02-19"}, 
    {"nombre": "Caramelos Ambrosoli Full Limón", "expiracion": "2027-02-19"}, 
    {"nombre": "Club Social sabor artificial a queso", "expiracion": "2027-02-20"}, 
    {"nombre": "Club social sabor artificial queso", "expiracion": "2027-02-20"}, 
    {"nombre": "Galletas San Jorge Cracknel original 140 g", "expiracion": "2027-02-22"}, 
    {"nombre": "Galletas soda lain cosa familiar 170 g", "expiracion": "2027-02-22"}, 
    {"nombre": "A la cena tari crema de ají amarillo", "expiracion": "2027-02-22"}, 
    {"nombre": "Popcorn corazón del fundo bolsa 400 g", "expiracion": "2027-02-24"}, 
    {"nombre": "Fini Camping estadounidense sabor vainilla", "expiracion": "2027-02-25"}, 
    {"nombre": "Cereal granola con frutos rojos Vive Day", "expiracion": "2027-02-25"}, 
    {"nombre": "Galletas crackers ducales familiar 241 g", "expiracion": "2027-02-28"}, 
    {"nombre": "Condimentos Sibarita panquita y panca pasta 100 g", "expiracion": "2027-02-28"}, 
    {"nombre": "Granola Vive Day con chips de chocolate 350 g", "expiracion": "2027-02-28"}, 
    {"nombre": "Gomitas Disney con Bombón Bungo 80 g", "expiracion": "2027-03-03"}, 
    {"nombre": "Gomitas Grisly osos 80 g", "expiracion": "2027-03-03"}, 
    {"nombre": "Gomitas Trululu nano bolas 100 g", "expiracion": "2027-03-03"}, 
    {"nombre": "Nutri cacao cookies con arándanos tacos 75 g", "expiracion": "2027-03-06"}, 
    {"nombre": "Toffis la Ibérica surtido 100 g", "expiracion": "2027-03-07"}, 
    {"nombre": "Galleta venía fiel 37 g", "expiracion": "2027-03-08"}, 
    {"nombre": "Salsa roja Don Vittorio 200 g", "expiracion": "2027-03-09"}, 
    {"nombre": "Nutri quinoa cookies con cacao nibs taco", "expiracion": "2027-03-11"}, 
    {"nombre": "Barra Protein Bar Cherry Bomb", "expiracion": "2027-03-11"}, 
    {"nombre": "Nutri quinoa cookies con fresa y cacao taco 75 g", "expiracion": "2027-03-12"}, 
    {"nombre": "Gomitas Sambrositos ácidos 90 g", "expiracion": "2027-03-13"}, 
    {"nombre": "Gomitas Ambrosito Ambrosaurus Ambrosoli 90 g", "expiracion": "2027-03-14"}, 
    {"nombre": "Galletas cream cracker fiel familiar 258 g San Jorge", "expiracion": "2027-03-14"}, 
    {"nombre": "Gomitas gusanos ácidos Ambrosoli 90 g", "expiracion": "2027-03-16"}, 
    {"nombre": "Galletas Nutri con quinoa con lúcuma y chispas de chocolate 30 g", "expiracion": "2027-03-16"}, 
    {"nombre": "Waffer Bauducco chocolate con avellanas 140 g", "expiracion": "2027-03-17"}, 
    {"nombre": "Galleta Nutri quinoa cookies con aguaymanto y chispas de chocolate 30 g", "expiracion": "2027-03-18"}, 
    {"nombre": "Gomitas Ambrosoli Ambro Reino 90 g", "expiracion": "2027-03-19"}, 
    {"nombre": "Galleta Tentación sabor vainilla 43 g", "expiracion": "2027-03-25"}, 
    {"nombre": "Milos colombina cilindro blanco 145 g", "expiracion": "2027-03-26"}, 
    {"nombre": "Marshmallow Fini trenza tricolor sabor vainilla", "expiracion": "2027-03-27"}, 
    {"nombre": "Chocolate bombón Spring Avellana 144 g", "expiracion": "2027-04-02"}, 
    {"nombre": "Marshmallow Fini Camping 80 g", "expiracion": "2027-04-04"}, 
    {"nombre": "Chupete globo pop XXL", "expiracion": "2027-04-08"}, 
    {"nombre": "Galleta Tentación sabor vainilla 43 g", "expiracion": "2027-04-10"}, 
    {"nombre": "Galleta soda victoria 35 g", "expiracion": "2027-04-11"}, 
    {"nombre": "Galleta Crackelet Snack Jamón 150 g", "expiracion": "2027-04-15"}, 
    {"nombre": "Club social original 6 paquetes unid.", "expiracion": "2027-04-17"}, 
    {"nombre": "Bolsa Globob surtido 24 unid.", "expiracion": "2027-04-17"}, 
    {"nombre": "Gloria pro power sabor caramelo macchiato", "expiracion": "2027-04-22"}, 
    {"nombre": "Chocolate Bombón Bungo de leche 15 g", "expiracion": "2027-04-25"}, 
    {"nombre": "Condimento polvo doña gusta gallina 42 g", "expiracion": "2027-04-27"}, 
    {"nombre": "Gloria pro sabor chocolate", "expiracion": "2027-04-29"}, 
    {"nombre": "Gomitas Mogul gusanitos extreme 90 g", "expiracion": "2027-05-08"}, 
    {"nombre": "Galleta Nutri más quinoa cacao 30 g", "expiracion": "2027-05-30"}, 
    {"nombre": "Cereal Angel Zuc 120 g", "expiracion": "2027-06-03"}, 
    {"nombre": "Mayonesa alacena 235 g", "expiracion": "2027-06-11"}, 
    {"nombre": "Cereal Copix Choco Marsh Angel 120 g", "expiracion": "2027-06-12"}, 
    {"nombre": "Arroz faraón extra premium bolsa 750 g", "expiracion": "2027-06-16"}, 
    {"nombre": "Chocolate mecano manjar 19 g", "expiracion": "2027-06-18"}, 
    {"nombre": "Cereal Angel Choco de chocolate 120 g", "expiracion": "2027-06-18"}, 
    {"nombre": "Galletas Nutri con quinoa blueberry 30 g", "expiracion": "2027-06-22"}, 
    {"nombre": "Nutri quinoa cookies doble chocolate taco 75 g", "expiracion": "2027-06-22"}, 
    {"nombre": "Gomitas Trolly Sour Glow Worms 100 g", "expiracion": "2027-07-12"}, 
    {"nombre": "Galleta Butter Cookies 280 g", "expiracion": "2027-07-16"}, 
    {"nombre": "Leche condensada Nestlé 393 g", "expiracion": "2027-07-18"}, 
    {"nombre": "Gomitas mini Monchis Fini bolsa 90 g", "expiracion": "2027-08-02"}, 
    {"nombre": "Chicle Fini ensalada de frutas ácidas", "expiracion": "2027-09-20"}, 
    {"nombre": "Flan Universal vainilla 150 g", "expiracion": "2027-11-29"}, 
    {"nombre": "Mermelada de fresa Gloria sachet 90 g", "expiracion": "2028-01-14"}, 
    {"nombre": "Tallarín Molitalia 450 g", "expiracion": "2028-04-10"}, 
    {"nombre": "Fideos Don Vittorio linguini 500 g", "expiracion": "2028-04-20"}, 
    {"nombre": "Caramelos Ambrosoli Menditas 19 g", "expiracion": "2028-04-21"}, 
    {"nombre": "Fideos Molitalia tornillo 250 g", "expiracion": "2028-05-08"}, 
    {"nombre": "Galleta San Jorge familiar de 450 g", "expiracion": "2028-12-18"}, 
    {"nombre": "Gelatina de fresa Universal 130 g", "expiracion": "2029-08-09"}, 
    {"nombre": "Condimento sazonador ajinomoto 90 g", "expiracion": "2030-06-16"}, 
    {"nombre": "Galleta chaplín 90 g", "expiracion": "2030-08-27"}, 
    {"nombre": "Pan integral La Vita 400 g", "expiracion": "2030-08-27"}
];

function cargarExcelNube() {
    if (inventarioGeneral.length > 0) {
        alert("⚠️ La base de datos ya tiene productos. Borra la base de datos si quieres volver a cargar la original.");
        return;
    }
    
    if (confirm("Se subirán 261 productos a Firebase. Y se asignarán a Jhony. ¿Continuar?")) {
        mostrarCarga(true);
        const batch = db.batch();
        
        ExcelOriginal.forEach(item => {
            const docRef = db.collection("productos").doc();
            // AQUI ESTÁ EL CAMBIO: Se le asignan todos los productos iniciales a Jhony
            item.responsable = "Jhony"; 
            batch.set(docRef, item);
        });

        batch.commit().then(() => {
            mostrarCarga(false);
            alert("✅ ¡Éxito! Todos los productos se subieron a Firebase bajo el nombre de Jhony.");
        }).catch(err => {
            console.error(err);
            mostrarCarga(false);
            alert("Error subiendo datos.");
        });
    }
}

function borrarTodoNube() {
    if (confirm("⚠️ ADVERTENCIA: Se borrarán TODOS los productos de Firebase para TODOS los usuarios. ¿Estás seguro?")) {
        const palabra = prompt("Escribe 'BORRAR' en mayúsculas para confirmar:");
        if (palabra === "BORRAR") {
            mostrarCarga(true);
            const batch = db.batch();
            
            // Borra todo lo que esté en inventarioGeneral
            inventarioGeneral.forEach(item => {
                const docRef = db.collection("productos").doc(item.id);
                batch.delete(docRef);
            });

            batch.commit().then(() => {
                mostrarCarga(false);
                alert("🗑️ Base de datos vaciada por completo.");
            }).catch(err => {
                console.error(err);
                mostrarCarga(false);
                alert("Error borrando datos.");
            });
        }
    }
}