// Configuración extraída de tu cuenta de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC8-A3J4p8QS56AudlW-UqqM7pLGyJfy8k",
    authDomain: "inventario-tambo-c2663.firebaseapp.com",
    projectId: "inventario-tambo-c2663",
    storageBucket: "inventario-tambo-c2663.firebasestorage.app",
    messagingSenderId: "347560278283",
    appId: "1:347560278283:web:5f1c7301d012436fa3ca0e"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variables globales para la app
let inventarioGeneral = [];
let vistaActual = 'dashboard';
let usuarioActual = 'general'; // 'general', 'Susan', 'Jhony', etc.
let statusChartInstance = null;