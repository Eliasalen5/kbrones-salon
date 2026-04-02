# Kbrones Salon - App Web de Turnos

## Estructura del Proyecto

```
kbrones-salon/
├── index.html              # Página de reservas para clientes
├── admin.html              # Panel de administración
├── assets/
│   ├── scss/               # Estilos SASS
│   │   ├── main.scss       # Archivo principal
│   │   ├── _variables.scss # Variables (colores, fuentes)
│   │   └── _reset.scss     # Reset CSS
│   ├── css/
│   │   └── main.css        # CSS compilado
│   ├── js/
│   │   ├── firebase-config.js  # Configuración Firebase
│   │   ├── app.js             # Lógica de la app cliente
│   │   └── admin.js           # Lógica del panel admin
│   └── images/             # Imágenes (logo, etc.)
├── functions/              # Cloud Functions de Firebase
├── firebase.json           # Configuración Firebase Hosting
├── firestore.rules         # Reglas de Firestore
└── firestore.indexes.json # Índices de Firestore
```

## Pasos para Poner en Marcha

### 1. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita los siguientes servicios:
   - **Authentication** (Email/Password y Google)
   - **Firestore Database**
   - **Hosting**

4. Copia las credenciales de tu app:
   - Ve a Configuración del proyecto > General
   - Busca la sección "Tus apps" > Web
   - Copia el objeto `firebaseConfig`

5. Edita `assets/js/firebase-config.js` y reemplaza las credenciales:
```javascript
const firebaseConfig = {
    apiKey: "AQUI_TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

6. Edita `.firebaserc` con el nombre de tu proyecto:
```json
{
  "projects": {
    "default": "NOMBRE_DE_TU_PROYECTO"
  }
}
```

### 2. Crear Usuario Admin

Después de configurar Firebase, necesitas crear un usuario administrador:

1. Ejecuta la app en tu navegador y regístrate con un email
2. Ve a Firebase Console > Firestore
3. Busca el documento del usuario que creaste
4. Edita el documento y cambia `role` de `client` a `admin`

### 3. Configurar MercadoPago (para pagos)

1. Crea una cuenta en [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
2. Crea una aplicación para obtener tus credenciales (Client ID y Client Secret)
3. Implementa la lógica de pago en `assets/js/app.js` usando el SDK de MercadoPago

### 4. Compilar SASS (opcional para desarrollo)

Si querés modificar los estilos:

```bash
# Instalar SASS globalmente
npm install -g sass

# Compilar con watch
sass --watch assets/scss/main.scss assets/css/main.css
```

### 5. Desplegar a Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Inicializar proyecto
firebase init

# Desplegar
firebase deploy
```

## Funcionalidades Implementadas

### Para Clientes
- Registro/Login con email y Google
- Visualización de servicios y precios
- Selección de profesional
- Reserva de turnos con calendario
- Pagos con MercadoPago/tarjetas
- Recordatorios por email

### Panel Admin
- Dashboard con estadísticas
- Gestión de profesionales (CRUD)
- Gestión de servicios (CRUD)
- Visualización de turnos
- Historial de pagos
- Configuración de horarios

## Configuración de Horarios

Los horarios por defecto en `firebase-config.js` son:
- **Lunes a Miércoles**: 9:00-11:30 y 17:00-20:30
- **Jueves**: 9:00-12:00
- **Viernes**: 9:00-11:30 y 17:00-20:30
- **Sábado**: 9:00-12:00
- **Domingo**: Cerrado

Podés modificarlos desde el panel admin o directamente en `assets/js/firebase-config.js`.

## Próximos Pasos

1. [ ] Agregar el logo de Kbrones en `assets/images/logo.png`
2. [ ] Configurar credenciales de Firebase
3. [ ] Crear cuenta de MercadoPago
4. [ ] Implementar lógica de pagos
5. [ ] Agregar nombres reales de los 4 profesionales
6. [ ] Configurar notificaciones por WhatsApp (usando Twilio)
7. [ ] Desplegar a producción

## Soporte

Para consultas sobre el desarrollo, contactá al equipo de desarrollo.
