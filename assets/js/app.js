// =============================================
// APP PRINCIPAL - Kbrones Salon
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let currentUser = null;
let isLoggingIn = false;
let servicios = [];
let profesionales = [];
let turnoActual = {
    barberId: null,
    barberName: null,
    servicio: null,
    fecha: null,
    hora: null
};

async function initApp() {
    setupEventListeners();
    setupAuthListener();
    await loadServicios();
    await loadProfesionales();
    renderServicios();
    renderProfesionales();
    renderHorarios();
    loadPromociones();
    initGaleria();
}

// Carrusel del Hero
let currentSlide = 0;
let slideInterval;

function initGaleria() {
    const slides = document.querySelectorAll('.hero__slide');
    const dotsContainer = document.getElementById('heroDots');
    const prevBtn = document.getElementById('heroPrev');
    const nextBtn = document.getElementById('heroNext');
    
    if (!slides.length) return;
    
    const totalSlides = slides.length;
    
    // Crear dots
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('span');
        dot.className = 'hero__dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }
    
    // Event listeners
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    
    // Auto-play
    startAutoPlay();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero__slide');
    const dots = document.querySelectorAll('.hero__dot');
    const totalSlides = slides.length;
    
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = (index + totalSlides) % totalSlides;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function nextSlide() {
    goToSlide(currentSlide + 1);
    resetAutoPlay();
}

function prevSlide() {
    goToSlide(currentSlide - 1);
    resetAutoPlay();
}

function startAutoPlay() {
    slideInterval = setInterval(nextSlide, 5000);
}

function resetAutoPlay() {
    clearInterval(slideInterval);
    startAutoPlay();
}

function setupEventListeners() {
    
    // Navegación móvil
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Cerrar menú al hacer clic en enlace
    document.querySelectorAll('.header__link').forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu) navMenu.classList.remove('active');
        });
    });

    // Modal de autenticación
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const authModal = document.getElementById('authModal');
    const closeModal = document.getElementById('closeModal');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (navMenu) navMenu.classList.remove('active');
            openAuthModal('login');
        });
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            if (navMenu) navMenu.classList.remove('active');
            openAuthModal('register');
        });
    }
    if (closeModal) closeModal.addEventListener('click', () => closeAuthModal());
    if (authModal) authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // Tabs del modal
    const modalTabs = document.querySelectorAll('.modal__tab');
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // Formularios de autenticación
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const googleLogin = document.getElementById('googleLogin');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (googleLogin) googleLogin.addEventListener('click', handleGoogleLogin);

    // Reserva
    const btnVolver = document.getElementById('btnVolverProfesionales');
    const fechaTurno = document.getElementById('fechaTurno');
    const btnReservar = document.getElementById('btnReservar');

    if (btnVolver) btnVolver.addEventListener('click', volverAProfesionales);
    if (fechaTurno) {
        fechaTurno.addEventListener('change', handleFechaChange);
        const today = new Date().toISOString().split('T')[0];
        fechaTurno.min = today;
    }
    if (btnReservar) btnReservar.addEventListener('click', handleReservar);

    // Pago opciones
    const pagoOpciones = document.querySelectorAll('.pago-opcion');
    pagoOpciones.forEach(opcion => {
        opcion.addEventListener('click', () => {
            pagoOpciones.forEach(o => o.classList.remove('selected'));
            opcion.classList.add('selected');
            opcion.querySelector('input').checked = true;
        });
    });

    // Modal turno confirmado
    const closeTurnoModal = document.getElementById('closeTurnoModal');
    const turnoModal = document.getElementById('turnoModal');
    if (closeTurnoModal) closeTurnoModal.addEventListener('click', () => {
        turnoModal.classList.remove('active');
    });
}

function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? user.uid : 'no user');
        
        if (user) {
            currentUser = user;
            
            // Verificar rol y redirigir si es necesario (para dueño/barbero)
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const role = userDoc.data().role;
                    console.log('User role:', role);
                    
                    if (role === 'owner') {
                        window.location.href = 'panel-dueno.html';
                        return;
                    }
                    if (role === 'barber') {
                        window.location.href = 'panel-barbero.html';
                        return;
                    }
                }
                // Si es cliente o no tiene rol definido, actualizar UI
                updateAuthUI();
                
                // Solicitar permiso de notificaciones para clientes
                if (typeof requestNotificationPermission === 'function') {
                    const hasPermission = Notification.permission === 'granted';
                    if (!hasPermission) {
                        requestNotificationPermission().then(token => {
                            if (token) {
                                saveFCMToken(user.uid);
                            }
                        });
                    } else if (typeof saveFCMToken === 'function') {
                        saveFCMToken(user.uid);
                    }
                }
                
                // Escuchar notificaciones en primer plano
                if (typeof onForegroundMessage === 'function') {
                    onForegroundMessage((payload) => {
                        showNotification(payload.notification?.body || 'Nueva notificación', 'info');
                    });
                }
            } catch (error) {
                console.log('Error verificando rol:', error);
                updateAuthUI();
            }
        } else {
            // Usuario cerró sesión
            currentUser = null;
            updateAuthUI();
        }
    });
}

function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const misTurnosBtn = document.getElementById('misTurnosBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const navMenu = document.getElementById('navMenu');

    if (currentUser) {
        if (navAuth) navAuth.style.display = 'none';
        if (navUser) navUser.style.display = 'flex';
        if (misTurnosBtn) {
            misTurnosBtn.onclick = () => {
                navMenu.classList.remove('active');
                window.location.href = 'mis-turnos.html';
            };
        }
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                navMenu.classList.remove('active');
                await auth.signOut();
                window.location.reload();
            };
        }
    } else {
        if (navAuth) navAuth.style.display = 'flex';
        if (navUser) navUser.style.display = 'none';
    }
}

function openAuthModal(tab) {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('active');
        switchAuthTab(tab);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}

function switchAuthTab(tab) {
    const modalTabs = document.querySelectorAll('.modal__tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    modalTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
    if (registerForm) registerForm.style.display = tab === 'register' ? 'block' : 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Ingresando...';
    
    isLoggingIn = true;

    try {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login exitoso:', credential.user.uid);
        
        // Verificar rol inmediatamente
        const userDoc = await db.collection('users').doc(credential.user.uid).get();
        const role = userDoc.exists ? userDoc.data().role : 'client';
        console.log('Rol del usuario:', role);
        
        // Si es cliente, cerrar modal y quedarse en index
        if (role === 'client') {
            currentUser = credential.user;
            closeAuthModal();
            updateAuthUI();
        }
        // Si es dueño o barbero, el auth listener se encarga de redirigir
        
    } catch (error) {
        console.error('Error de login:', error);
        let msg = 'Error al iniciar sesión';
        if (error.code === 'auth/user-not-found') {
            msg = 'No existe cuenta con este email';
        } else if (error.code === 'auth/wrong-password') {
            msg = 'Contraseña incorrecta';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Email inválido';
        } else if (error.code === 'auth/too-many-requests') {
            msg = 'Demasiados intentos. Probá más tarde.';
        }
        showNotification(msg, 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    } finally {
        isLoggingIn = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;

    const btn = document.querySelector('#registerForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
    
    isLoggingIn = true;
    
    try {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('Registro exitoso:', credential.user.uid);
        
        await db.collection('users').doc(credential.user.uid).set({
            name: name,
            email: email,
            phone: phone,
            role: 'client',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        currentUser = credential.user;
        closeAuthModal();
        updateAuthUI();
        showNotification('¡Cuenta creada exitosamente! Ya podés reservar turnos.', 'success');
        
    } catch (error) {
        let msg = 'Error al crear cuenta';
        
        if (error.code === 'auth/email-already-in-use') {
            msg = 'Este email ya está registrado';
        } else if (error.code === 'auth/weak-password') {
            msg = 'La contraseña debe tener al menos 6 caracteres';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Email inválido';
        } else if (error.code === 'auth/network-request-failed') {
            msg = 'Error de conexión. Verificá tu internet.';
        }
        
        showNotification(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear Cuenta';
        isLoggingIn = false;
    }
}

async function handleGoogleLogin() {
    isLoggingIn = true;
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const credential = await auth.signInWithPopup(provider);
        console.log('Google login exitoso:', credential.user.uid);
        
        const userRef = db.collection('users').doc(credential.user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({
                name: credential.user.displayName,
                email: credential.user.email,
                phone: credential.user.phoneNumber || '',
                role: 'client',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        currentUser = credential.user;
        closeAuthModal();
        updateAuthUI();
        showNotification('Sesión iniciada correctamente', 'success');
    } catch (error) {
        console.error('Error Google login:', error);
        showNotification(error.message, 'error');
    } finally {
        isLoggingIn = false;
    }
}

async function loadServicios() {
    try {
        const snapshot = await db.collection('services').get();
        servicios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (servicios.length === 0) {
            servicios = getDefaultServices();
        }
    } catch (error) {
        servicios = getDefaultServices();
    }
}

function getDefaultServices() {
    return [
        { id: '1', name: 'Corte Masculino', price: 19000, duration: 30, category: 'barberia' },
        { id: '2', name: 'Arreglo de Barba', price: 10000, duration: 30, category: 'barberia' },
        { id: '3', name: 'Combo Corte + Barba', price: 22000, duration: 30, category: 'barberia' },
        { id: '4', name: 'Combo Corte + Barba + Cejas', price: 22000, duration: 30, category: 'barberia' },
        { id: '5', name: 'Combo Corte + Cejas', price: 20000, duration: 30, category: 'barberia' },
        { id: '6', name: 'Combo Corte + Cejas + Línea', price: 20000, duration: 30, category: 'barberia' },
        { id: '7', name: 'Combo Corte + Lavado', price: 22000, duration: 30, category: 'barberia' },
        { id: '8', name: 'Combo Corte + Línea', price: 20000, duration: 30, category: 'barberia' }
    ];
}

async function loadProfesionales() {
    try {
        // Cargar barberos
        const barbersSnapshot = await db.collection('users').where('role', '==', 'barber').get();
        let barbers = barbersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Cargar dueño
        const ownersSnapshot = await db.collection('users').where('role', '==', 'owner').get();
        let owners = ownersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Combinar barberos y dueños
        profesionales = [...owners, ...barbers];
        
        if (profesionales.length === 0) {
            profesionales = getDefaultProfessionals();
        }
    } catch (error) {
        profesionales = getDefaultProfessionals();
    }
}

function getDefaultProfessionals() {
    return [];
}

// Promociones
let promociones = [];

async function loadPromociones() {
    try {
        const snapshot = await db.collection('promotions').where('active', '==', true).get();
        promociones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPromociones();
    } catch (error) {
        console.error('Error cargando promociones:', error);
        const container = document.getElementById('promocionesGrid');
        if (container) {
            container.innerHTML = '<p style="text-align:center;color:#666;">No hay promociones disponibles</p>';
        }
    }
}

function renderPromociones() {
    const container = document.getElementById('promocionesGrid');
    if (!container) return;

    if (promociones.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#666;">No hay promociones disponibles</p>';
        return;
    }

    container.innerHTML = promociones.map(p => `
        <div class="promocion-card" onclick="reservarPromocion('${p.id}')">
            <div class="promocion-card__image">
                <i class="fas fa-gift"></i>
            </div>
            <div class="promocion-card__content">
                <h3 class="promocion-card__title">${p.title}</h3>
                <p class="promocion-card__description">${p.description}</p>
                <div class="promocion-card__price">
                    ${p.oldPrice ? `<span class="old-price">${formatPrice(p.oldPrice)}</span>` : ''}
                    <span class="new-price">${formatPrice(p.price)}</span>
                </div>
                <div class="promocion-card__footer">
                    <span class="promocion-card__validity">
                        <i class="fas fa-clock"></i> Válido hasta ${formatDateShort(p.validUntil)}
                    </span>
                    <button class="btn btn--primary btn--sm">
                        <i class="fas fa-calendar-check"></i> Reservar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.reservarPromocion = function(promocionId) {
    const promo = promociones.find(p => p.id === promocionId);
    if (!promo) return;
    
    // Guardar la promoción seleccionada
    sessionStorage.setItem('promocionSeleccionada', JSON.stringify(promo));
    
    // Ir a la sección de profesionales
    document.getElementById('profesionales').scrollIntoView({ behavior: 'smooth' });
};

function formatDateShort(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'string') {
        // Agregar hora para evitar problemas de zona horaria
        const [year, month, day] = date.split('-');
        d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else if (date.toDate) {
        d = date.toDate();
    } else {
        d = new Date(date);
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function renderServicios() {
    const container = document.getElementById('serviciosGrid');
    if (!container) return;

    container.innerHTML = servicios.slice(0, 4).map(s => `
        <div class="servicio-card" onclick="reservarServicio('${s.id}')">
            <i class="fas fa-cut"></i>
            <h3>${s.name}</h3>
            <p class="precio">${formatPrice(s.price)}</p>
            <span class="duracion">${s.duration} min</span>
        </div>
    `).join('');
}

window.reservarServicio = function(servicioId) {
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio) return;
    
    sessionStorage.setItem('servicioSeleccionado', JSON.stringify(servicio));
    
    document.getElementById('profesionales').scrollIntoView({ behavior: 'smooth' });
};

function renderProfesionales() {
    const container = document.getElementById('profesionalesGrid');
    if (!container) return;

    container.innerHTML = profesionales.map(p => `
        <div class="barbero-card" data-id="${p.id}" data-name="${p.name}" data-photo="${p.photo || ''}">
            <div class="barbero-card__avatar">
                ${p.photo ? `<img src="${p.photo}" alt="${p.name}">` : '<i class="fas fa-user"></i>'}
            </div>
            <h3>${p.name}</h3>
            <p>Barbero</p>
            <button class="btn btn--primary btn--sm">
                <i class="fas fa-calendar-check"></i> Reservar Turno
            </button>
        </div>
    `).join('');

    // Agregar eventos
    container.querySelectorAll('.barbero-card').forEach(card => {
        card.addEventListener('click', () => {
            selectBarbero(card.dataset.id, card.dataset.name, card.dataset.photo);
        });
    });
}

function renderHorarios() {
    const container = document.getElementById('horariosInfo');
    if (!container) return;

    container.innerHTML = `
        <div class="horario-item">
            <i class="fas fa-clock"></i>
            <div>
                <h4>Lunes a Miércoles</h4>
                <p>09:00 - 11:30 | 17:00 - 20:30</p>
            </div>
        </div>
        <div class="horario-item">
            <i class="fas fa-clock"></i>
            <div>
                <h4>Jueves</h4>
                <p>09:00 - 12:00</p>
            </div>
        </div>
        <div class="horario-item">
            <i class="fas fa-clock"></i>
            <div>
                <h4>Viernes</h4>
                <p>09:00 - 11:30 | 17:00 - 20:30</p>
            </div>
        </div>
        <div class="horario-item">
            <i class="fas fa-clock"></i>
            <div>
                <h4>Sábado</h4>
                <p>09:00 - 12:00</p>
            </div>
        </div>
        <div class="horario-item">
            <i class="fas fa-times-circle"></i>
            <div>
                <h4>Domingo</h4>
                <p>Cerrado</p>
            </div>
        </div>
    `;
}

// Seleccionar barbero y mostrar reserva
async function selectBarbero(barberId, barberName, barberPhoto) {
    const promoData = sessionStorage.getItem('promocionSeleccionada');
    const promocionSeleccionada = promoData ? JSON.parse(promoData) : null;
    
    const servicioData = sessionStorage.getItem('servicioSeleccionado');
    const servicioSeleccionado = servicioData ? JSON.parse(servicioData) : null;
    
    turnoActual = {
        barberId: barberId,
        barberName: barberName,
        servicio: servicioSeleccionado,
        fecha: null,
        hora: null,
        promocion: promocionSeleccionada
    };

    await loadBarberSchedule(barberId);
    
    document.getElementById('reserva').classList.add('active');
    
    const header = document.getElementById('reservaHeader');
    let headerSubtitle = 'Seleccioná tu servicio y horario';
    if (promocionSeleccionada) {
        headerSubtitle = `<span class="promo-badge"><i class="fas fa-gift"></i> ${promocionSeleccionada.title}</span>`;
    } else if (servicioSeleccionado) {
        headerSubtitle = servicioSeleccionado.name;
    }
    
    header.innerHTML = `
        <div class="reserva-header__avatar">
            ${barberPhoto ? `<img src="${barberPhoto}" alt="${barberName}">` : '<i class="fas fa-user"></i>'}
        </div>
        <div class="reserva-header__info">
            <h2>${barberName}</h2>
            <p>${headerSubtitle}</p>
        </div>
    `;

    const serviciosSection = document.getElementById('serviciosSection');
    
    if (promocionSeleccionada || servicioSeleccionado) {
        serviciosSection.style.display = 'none';
        updateResumen();
    } else {
        serviciosSection.style.display = 'block';
        const serviciosContainer = document.getElementById('serviciosDisponibles');
        
        const barber = profesionales.find(p => p.id === barberId);
        const barberServices = barber && barber.services 
            ? servicios.filter(s => barber.services.includes(s.id))
            : servicios;

        serviciosContainer.innerHTML = barberServices.map(s => `
            <div class="servicio-item" data-id="${s.id}">
                <div class="servicio-item__info">
                    <h4>${s.name}</h4>
                    <span>${s.duration} minutos</span>
                </div>
                <div class="servicio-item__precio">
                    <span class="precio">${formatPrice(s.price)}</span>
                </div>
            </div>
        `).join('');

        serviciosContainer.querySelectorAll('.servicio-item').forEach(item => {
            item.addEventListener('click', () => selectServicio(item.dataset.id));
        });
    }

    document.getElementById('fechaTurno').value = '';
    document.getElementById('horariosDisponibles').innerHTML = '';
    updateResumen();

    document.getElementById('reserva').scrollIntoView({ behavior: 'smooth' });
}

function selectServicio(serviceId) {
    turnoActual.servicio = servicios.find(s => s.id === serviceId);
    
    document.querySelectorAll('.servicio-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === serviceId);
    });
    
    updateResumen();
}

async function handleFechaChange() {
    const fechaInput = document.getElementById('fechaTurno');
    if (!fechaInput.value) return;

    const [year, month, day] = fechaInput.value.split('-');
    turnoActual.fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    
    const appointments = await getBarberAppointments(turnoActual.barberId, turnoActual.fecha);
    
    const slots = generateTimeSlots(turnoActual.fecha, turnoActual.barberId, appointments);
    
    const container = document.getElementById('horariosDisponibles');
    
    if (slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No hay horarios disponibles para este día</p>';
        return;
    }

    container.innerHTML = slots.map(slot => `
        <div class="horario-slot ${!slot.available ? 'disabled' : ''}" 
             data-time="${slot.time}" 
             ${!slot.available ? 'title="No disponible"' : ''}>
            ${slot.time}
        </div>
    `).join('');

    container.querySelectorAll('.horario-slot:not(.disabled)').forEach(slot => {
        slot.addEventListener('click', () => selectHora(slot.dataset.time));
    });
}

function selectHora(time) {
    turnoActual.hora = time;
    
    document.querySelectorAll('.horario-slot').forEach(slot => {
        slot.classList.toggle('selected', slot.dataset.time === time);
    });
    
    updateResumen();
}

function updateResumen() {
    const container = document.getElementById('resumenDetalle');
    
    let html = `
        <div class="resumen-row">
            <span>Barbero</span>
            <span>${turnoActual.barberName || '-'}</span>
        </div>
    `;

    if (turnoActual.promocion) {
        html += `
            <div class="resumen-row">
                <span>Promoción</span>
                <span>${turnoActual.promocion.title}</span>
            </div>
        `;
    } else if (turnoActual.servicio) {
        html += `
            <div class="resumen-row">
                <span>Servicio</span>
                <span>${turnoActual.servicio.name}</span>
            </div>
        `;
    }

    if (turnoActual.fecha) {
        html += `
            <div class="resumen-row">
                <span>Fecha</span>
                <span>${formatDate(turnoActual.fecha)}</span>
            </div>
        `;
    }

    if (turnoActual.hora) {
        html += `
            <div class="resumen-row">
                <span>Hora</span>
                <span>${turnoActual.hora}</span>
            </div>
        `;
    }

    const precio = turnoActual.promocion ? turnoActual.promocion.price : (turnoActual.servicio ? turnoActual.servicio.price : 0);
    if (precio > 0) {
        html += `
            <div class="resumen-row total">
                <span>Total</span>
                <span>${formatPrice(precio)}</span>
            </div>
        `;
    }

    container.innerHTML = html;
}

function volverAProfesionales() {
    document.getElementById('reserva').classList.remove('active');
    document.getElementById('profesionales').scrollIntoView({ behavior: 'smooth' });
}

async function handleReservar() {
    if (!turnoActual.servicio && !turnoActual.promocion) {
        showNotification('Seleccioná un servicio o promoción', 'warning');
        return;
    }
    if (!turnoActual.fecha) {
        showNotification('Seleccioná una fecha', 'warning');
        return;
    }
    if (!turnoActual.hora) {
        showNotification('Seleccioná un horario', 'warning');
        return;
    }

    if (!currentUser) {
        showNotification('Iniciá sesión para reservar', 'warning');
        openAuthModal('login');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userName = userDoc.exists ? userDoc.data().name : (currentUser.displayName || 'Cliente');
        const userPhone = userDoc.exists ? userDoc.data().phone : (currentUser.phoneNumber || '');

        const serviceId = turnoActual.promocion ? turnoActual.promocion.id : turnoActual.servicio.id;
        const serviceName = turnoActual.promocion ? turnoActual.promocion.title : turnoActual.servicio.name;
        const servicePrice = turnoActual.promocion ? turnoActual.promocion.price : turnoActual.servicio.price;

        const appointment = {
            clientId: currentUser.uid,
            clientName: userName,
            clientEmail: currentUser.email,
            clientPhone: userPhone,
            serviceId: serviceId,
            serviceName: serviceName,
            servicePrice: servicePrice,
            professionalId: turnoActual.barberId,
            professionalName: turnoActual.barberName,
            date: firebase.firestore.Timestamp.fromDate(turnoActual.fecha),
            time: turnoActual.hora,
            status: 'pendiente',
            promotionId: turnoActual.promocion ? turnoActual.promocion.id : null,
            promotionName: turnoActual.promocion ? turnoActual.promocion.title : null,
            reminderSent: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('appointments').add(appointment);
        console.log('Turno guardado con ID:', docRef.id);

        // Limpiar promoción seleccionada
        sessionStorage.removeItem('promocionSeleccionada');
        sessionStorage.removeItem('servicioSeleccionado');

        // Mostrar confirmación
        const turnoModal = document.getElementById('turnoModal');
        const turnoDetalles = document.getElementById('turnoDetalles');
        
        const precioFinal = turnoActual.promocion ? turnoActual.promocion.price : turnoActual.servicio.price;
        
        turnoDetalles.innerHTML = `
            <p><strong>Barbero:</strong> ${turnoActual.barberName}</p>
            ${turnoActual.promocion ? `<p><strong>Promoción:</strong> ${turnoActual.promocion.title}</p>` : `<p><strong>Servicio:</strong> ${turnoActual.servicio.name}</p>`}
            <p><strong>Fecha:</strong> ${formatDate(turnoActual.fecha)}</p>
            <p><strong>Hora:</strong> ${turnoActual.hora}</p>
            <p><strong>Total:</strong> ${formatPrice(precioFinal)}</p>
        `;
        
        turnoModal.classList.add('active');

    } catch (error) {
        console.error('Error al reservar:', error);
        showNotification('Error al reservar: ' + error.message, 'error');
    }
}

function closeTurnoModal() {
    document.getElementById('turnoModal').classList.remove('active');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        document.body.removeChild(notification);
    }, 3000);
}

// Estilos para barbero card y notificaciones
const extraStyles = document.createElement('style');
extraStyles.textContent = `
    .barbero-card {
        background: #fff;
        border-radius: 16px;
        padding: 30px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .barbero-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }

    .barbero-card__avatar {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: linear-gradient(135deg, #d4af37 0%, #c9a227 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        overflow: hidden;
    }

    .barbero-card__avatar i {
        font-size: 3rem;
        color: #fff;
    }

    .barbero-card__avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .barbero-card h3 {
        margin-bottom: 5px;
        font-size: 1.3rem;
    }

    .barbero-card p {
        color: #6c757d;
        margin-bottom: 20px;
    }

    .btn--sm {
        padding: 10px 20px;
        font-size: 0.9rem;
    }

    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 3000;
        transform: translateX(120%);
        transition: transform 0.3s ease;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification--success { background: #28a745; }
    .notification--error { background: #dc3545; }
    .notification--warning { background: #ffc107; color: #1a1a1a; }
    .notification--info { background: #17a2b8; }

    .turno-confirmado {
        text-align: center;
    }

    .turno-confirmado i {
        font-size: 4rem;
        color: #28a745;
        margin-bottom: 20px;
    }

    .turno-confirmado h3 {
        margin-bottom: 10px;
    }

    .turno-confirmado p {
        color: #6c757d;
        margin-bottom: 20px;
    }

    .turno-confirmado #turnoDetalles {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        text-align: left;
    }

    .turno-confirmado #turnoDetalles p {
        margin-bottom: 8px;
        color: #1a1a1a;
    }

    .turno-confirmado #turnoDetalles strong {
        color: #6c757d;
    }
`;
document.head.appendChild(extraStyles);

// Expose functions
window.closeTurnoModal = closeTurnoModal;
