// =============================================
// CONFIGURACIÓN DE FIREBASE - KBrones Salon
// =============================================

const firebaseConfig = {
    apiKey: "AIzaSyCd4HqPGMtiR0bHJD8GEozhfNl3-MG2tiw",
    authDomain: "kbrones-salon-1997.firebaseapp.com",
    projectId: "kbrones-salon-1997",
    storageBucket: "kbrones-salon-1997.firebasestorage.app",
    messagingSenderId: "335118146301",
    appId: "1:335118146301:web:85aa85bd9ee97278d03c94",
    measurementId: "G-9BCLJ9N9Q5"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Inicializar FCM (Firebase Cloud Messaging)
let messaging = null;
const VAPID_KEY = 'BEl62iY2FKLtKGJNH6yMu0oHCCB7MLNaH6xHUC5nPQlGPqKAi8A7k9N8V5Z1L9hK3m2n4o5p6q7r8s9t0u1v2w3x4y5z6'; // Reemplazar con tu VAPID key público

if ('Notification' in window && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
}

// Funciones de notificaciones
async function requestNotificationPermission() {
    if (!messaging) {
        console.log('FCM no está soportado en este navegador');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Permiso de notificaciones concedido');
            const token = await getFCMToken();
            return token;
        } else {
            console.log('Permiso de notificaciones denegado');
            return null;
        }
    } catch (error) {
        console.error('Error al solicitar permiso de notificaciones:', error);
        return null;
    }
}

async function getFCMToken() {
    if (!messaging) return null;
    
    try {
        const token = await messaging.getToken({ vapidKey: VAPID_KEY });
        console.log('FCM Token obtenido:', token);
        return token;
    } catch (error) {
        console.error('Error al obtener FCM Token:', error);
        return null;
    }
}

async function saveFCMToken(userId) {
    const token = await getFCMToken();
    if (!token) return false;
    
    try {
        await db.collection('users').doc(userId).update({
            fcmToken: token,
            fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('FCM Token guardado para usuario:', userId);
        return true;
    } catch (error) {
        console.error('Error guardando FCM Token:', error);
        return false;
    }
}

// Escuchar notificaciones en primer plano
function onForegroundMessage(callback) {
    if (!messaging) return;
    
    messaging.onMessage((payload) => {
        console.log('Mensaje en primer plano recibido:', payload);
        
        const notificationTitle = payload.notification?.title || 'Kbrones Salon';
        const notificationBody = payload.notification?.body || 'Nuevo mensaje';
        
        if (Notification.permission === 'granted') {
            new Notification(notificationTitle, {
                body: notificationBody,
                icon: 'assets/images/logo.png',
                tag: 'kbrones-notification'
            });
        }
        
        if (callback) callback(payload);
    });
}

// Exportar para uso global
window.messaging = messaging;
window.requestNotificationPermission = requestNotificationPermission;
window.getFCMToken = getFCMToken;
window.saveFCMToken = saveFCMToken;
window.onForegroundMessage = onForegroundMessage;

// Roles del sistema
const ROLES = {
    ADMIN: 'admin',        // Admin general (dueño)
    BARBER: 'barber',      // Barbero con perfil propio
    CLIENT: 'client'       // Cliente
};

// Configuración general de la barbería
const CONFIG = {
    nombre: "Kbrones Salon",
    ubicacion: "Laprida 1268, Baradero, Buenos Aires",
    telefono: "+54 3329 XXXXXX",
    instagram: "@kbrones_salon",
    duracionTurno: 30
};

// Horarios por defecto
const HORARIOS_DEFAULT = {
    lunes: { enabled: true, apertura: "09:00", cierre: "20:30", pausa: { enabled: true, inicio: "11:30", fin: "17:00" } },
    martes: { enabled: true, apertura: "09:00", cierre: "20:30", pausa: { enabled: true, inicio: "11:30", fin: "17:00" } },
    miercoles: { enabled: true, apertura: "09:00", cierre: "20:30", pausa: { enabled: true, inicio: "11:30", fin: "17:00" } },
    jueves: { enabled: true, apertura: "09:00", cierre: "12:00", pausa: { enabled: false } },
    viernes: { enabled: true, apertura: "09:00", cierre: "20:30", pausa: { enabled: true, inicio: "11:30", fin: "17:00" } },
    sabado: { enabled: true, apertura: "09:00", cierre: "12:00", pausa: { enabled: false } },
    domingo: { enabled: false }
};

// Verificar rol del usuario
async function checkUserRole(user) {
    if (!user) return null;
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
        return userDoc.data().role;
    }
    return null;
}

// Verificar si es admin global
async function isAdmin(user) {
    return await checkUserRole(user) === ROLES.ADMIN;
}

// Verificar si es barbero
async function isBarber(user) {
    return await checkUserRole(user) === ROLES.BARBER;
}

// Obtener datos del barbero asociado al usuario
async function getBarberByUserId(userId) {
    const snapshot = await db.collection('professionals')
        .where('userId', '==', userId)
        .limit(1)
        .get();
    
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
}

// Obtener barbero por ID
async function getBarberById(barberId) {
    const doc = await db.collection('professionals').doc(barberId).get();
    if (doc.exists) {
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

// Obtener servicios de un barbero
async function getBarberServices(barberId) {
    const barber = await getBarberById(barberId);
    if (!barber || !barber.services) return [];
    
    const services = [];
    for (const serviceId of barber.services) {
        const doc = await db.collection('services').doc(serviceId).get();
        if (doc.exists) {
            services.push({ id: doc.id, ...doc.data() });
        }
    }
    return services;
}

// Generar horarios disponibles para un barbero específico
function generateTimeSlots(date, barberId, existingAppointments = []) {
    const slots = [];
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayName = days[date.getDay()];
    
    // Obtener horarios del barbero o usar default
    const barberSchedule = barberSchedules[barberId] || HORARIOS_DEFAULT;
    const schedule = barberSchedule[dayName];
    
    if (!schedule || !schedule.enabled) {
        return slots;
    }

    const [openHour, openMin] = schedule.apertura.split(':').map(Number);
    let [closeHour, closeMin] = schedule.cierre.split(':').map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(openHour, openMin, 0, 0);

    const closeTime = new Date(date);
    closeTime.setHours(closeHour, closeMin, 0, 0);

    // Filtrar turnos ya tomados
    const takenTimes = existingAppointments.map(apt => apt.time);

    while (currentTime < closeTime) {
        const timeStr = currentTime.toTimeString().slice(0, 5);
        
        // Verificar pausa
        let isPaused = false;
        if (schedule.pausa && schedule.pausa.enabled) {
            const [pauseStartHour, pauseStartMin] = schedule.pausa.inicio.split(':').map(Number);
            const [pauseEndHour, pauseEndMin] = schedule.pausa.fin.split(':').map(Number);
            const pauseStart = new Date(date);
            pauseStart.setHours(pauseStartHour, pauseStartMin, 0, 0);
            const pauseEnd = new Date(date);
            pauseEnd.setHours(pauseEndHour, pauseEndMin, 0, 0);

            if (currentTime >= pauseStart && currentTime < pauseEnd) {
                isPaused = true;
                currentTime = new Date(pauseEnd);
                continue;
            }
        }

        slots.push({
            time: timeStr,
            available: !takenTimes.includes(timeStr)
        });

        currentTime.setMinutes(currentTime.getMinutes() + CONFIG.duracionTurno);
    }

    return slots;
}

// Formatear precio
function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(price);
}

// Formatear fecha
function formatDate(date) {
    return new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

// Formatear fecha corta
function formatDateShort(date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short'
    }).format(date);
}

// Obtener día de semana
function getDayOfWeek(date) {
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return days[date.getDay()];
}

// Almacenamiento temporal de horarios por barbero
const barberSchedules = {};

// Cargar horarios de un barbero
async function loadBarberSchedule(barberId) {
    try {
        const doc = await db.collection('professionals').doc(barberId).get();
        if (doc.exists && doc.data().schedule) {
            barberSchedules[barberId] = doc.data().schedule;
        } else {
            barberSchedules[barberId] = { ...HORARIOS_DEFAULT };
        }
    } catch (error) {
        barberSchedules[barberId] = { ...HORARIOS_DEFAULT };
    }
}

// Guardar horarios de un barbero
async function saveBarberSchedule(barberId, schedule) {
    await db.collection('professionals').doc(barberId).update({ schedule });
    barberSchedules[barberId] = schedule;
}

// Obtener turnos de un barbero para una fecha
async function getBarberAppointments(barberId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const snapshot = await db.collection('appointments')
            .where('professionalId', '==', barberId)
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
            .where('date', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
            .where('status', 'in', ['pendiente', 'confirmado', 'completado'])
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // Alternativa sin índice
        const allSnapshot = await db.collection('appointments').get();
        return allSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(apt => {
                if (apt.professionalId !== barberId) return false;
                const aptDate = apt.date.toDate();
                return aptDate >= startOfDay && aptDate <= endOfDay &&
                       ['pendiente', 'confirmado', 'completado'].includes(apt.status);
            });
    }
}

// Exportar variables globales
window.firebase = firebase;
window.auth = auth;
window.db = db;
window.ROLES = ROLES;
window.CONFIG = CONFIG;
window.HORARIOS_DEFAULT = HORARIOS_DEFAULT;
window.checkUserRole = checkUserRole;
window.isAdmin = isAdmin;
window.isBarber = isBarber;
window.getBarberByUserId = getBarberByUserId;
window.getBarberById = getBarberById;
window.getBarberServices = getBarberServices;
window.generateTimeSlots = generateTimeSlots;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.getDayOfWeek = getDayOfWeek;
window.loadBarberSchedule = loadBarberSchedule;
window.saveBarberSchedule = saveBarberSchedule;
window.getBarberAppointments = getBarberAppointments;
window.barberSchedules = barberSchedules;
