importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCd4HqPGMtiR0bHJD8GEozhfNl3-MG2tiw",
    authDomain: "kbrones-salon-1997.firebaseapp.com",
    projectId: "kbrones-salon-1997",
    storageBucket: "kbrones-salon-1997.firebasestorage.app",
    messagingSenderId: "335118146301",
    appId: "1:335118146301:web:85aa85bd9ee97278d03c94"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Mensaje en segundo plano recibido:', payload);
    
    const notificationTitle = payload.notification?.title || 'Kbrones Salon';
    const notificationOptions = {
        body: payload.notification?.body || 'Nuevo mensaje',
        icon: 'assets/images/logo.png',
        badge: 'assets/images/logo.png',
        vibrate: [200, 100, 200],
        tag: 'kbrones-notification',
        requireInteraction: false,
        data: payload.data
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    console.log('Notificación clickeada:', event);
    
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('index.html');
                }
            })
    );
});
