const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// VAPID Key público (para referencia, el privado stays en Firebase Console)
// En producción, guarda el VAPID key privado de forma segura
const VAPID_KEY = 'BEl62iY2FKLtKGJNH6yMu0oHCCB7MLNaH6xHUC5nPQlGPqKAi8A7k9N8V5Z1L9hK3m2n4o5p6q7r8s9t0u1v2w3x4y5z6';

// ================================
// Función: Notificar al Barber/Admin cuando se crea un turno
// ================================
exports.notifyNewAppointment = functions.firestore
    .document('appointments/{appointmentId}')
    .onCreate(async (snap, context) => {
        const appointment = snap.data();
        const appointmentId = context.params.appointmentId;

        console.log('Nuevo turno creado:', appointmentId);
        console.log('Cliente:', appointment.clientName);
        console.log('Servicio:', appointment.serviceName);
        console.log('Fecha:', appointment.date.toDate());
        console.log('Hora:', appointment.time);

        try {
            // Obtener el barbero/profesional
            const professionalDoc = await db.collection('users').doc(appointment.professionalId).get();

            if (!professionalDoc.exists) {
                console.log('Profesional no encontrado');
                return null;
            }

            const professional = professionalDoc.data();
            const professionalName = professional.name || 'Barbero';

            // Crear payload de notificación
            const notificationPayload = {
                notification: {
                    title: 'Nuevo Turno Reservado',
                    body: `${appointment.clientName} reservó ${appointment.serviceName} para el ${formatDate(appointment.date.toDate())} a las ${appointment.time}`,
                    icon: 'assets/images/logo.png',
                    clickAction: 'panel-dueno.html'
                },
                data: {
                    type: 'new_appointment',
                    appointmentId: appointmentId,
                    clientName: appointment.clientName,
                    serviceName: appointment.serviceName,
                    time: appointment.time,
                    click_action: '/panel-dueno.html'
                },
                webpush: {
                    fcmOptions: {
                        link: '/panel-dueno.html'
                    }
                }
            };

            // Notificar al profesional
            if (professional.fcmToken) {
                await admin.messaging().send({
                    ...notificationPayload,
                    token: professional.fcmToken
                });
                console.log('Notificación enviada al profesional');
            }

            // También notificar a todos los owners
            const ownersSnapshot = await db.collection('users').where('role', '==', 'owner').get();
            
            const notificationsPromises = ownersSnapshot.docs.map(async (ownerDoc) => {
                const owner = ownerDoc.data();
                if (owner.fcmToken && owner.fcmToken !== professional.fcmToken) {
                    return admin.messaging().send({
                        ...notificationPayload,
                        token: owner.fcmToken
                    });
                }
            });

            await Promise.all(notificationsPromises);
            console.log('Notificaciones enviadas a owners');

            return null;
        } catch (error) {
            console.error('Error enviando notificación:', error);
            return null;
        }
    });

// ================================
// Función: Recordatorio 1 hora antes
// ================================
exports.sendReminders = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        console.log('Ejecutando recordatorios...');

        try {
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 65 * 60 * 1000);
            const oneHourAgo = new Date(now.getTime() - 5 * 60 * 1000);

            console.log('Buscando turnos entre:', oneHourAgo, 'y', oneHourLater);

            // Buscar turnos pendientes/confirmados en la próxima hora
            const appointmentsSnapshot = await db.collection('appointments')
                .where('status', 'in', ['pendiente', 'confirmado'])
                .where('reminderSent', '!=', true)
                .get();

            const reminders = [];

            appointmentsSnapshot.docs.forEach(doc => {
                const appointment = doc.data();
                const appointmentDate = appointment.date.toDate();
                
                // Verificar si el turno es en aproximadamente 1 hora (55-65 minutos)
                const minutesDiff = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);
                
                if (minutesDiff >= 55 && minutesDiff <= 65) {
                    reminders.push({
                        id: doc.id,
                        ...appointment
                    });
                }
            });

            console.log(`Encontrados ${reminders.length} turnos para recordar`);

            // Enviar recordatorios
            for (const reminder of reminders) {
                try {
                    // Obtener datos del cliente
                    const clientDoc = await db.collection('users').doc(reminder.clientId).get();
                    
                    if (!clientDoc.exists || !clientDoc.data().fcmToken) {
                        console.log(`Cliente sin token FCM para turno ${reminder.id}`);
                        continue;
                    }

                    const clientData = clientDoc.data();
                    const clientToken = clientData.fcmToken;

                    // Enviar recordatorio al cliente
                    await admin.messaging().send({
                        notification: {
                            title: '⏰ Recordatorio de Turno',
                            body: `Te esperamos en 1 hora! Tu turno en Kbrones Salon es a las ${reminder.time}`,
                            icon: 'assets/images/logo.png'
                        },
                        data: {
                            type: 'reminder',
                            appointmentId: reminder.id,
                            click_action: '/mis-turnos.html'
                        },
                        token: clientToken,
                        webpush: {
                            fcmOptions: {
                                link: '/mis-turnos.html'
                            }
                        }
                    });

                    // Marcar como enviado
                    await db.collection('appointments').doc(reminder.id).update({
                        reminderSent: true,
                        reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    console.log(`Recordatorio enviado para turno ${reminder.id} a ${clientData.name}`);
                } catch (error) {
                    console.error(`Error enviando recordatorio para turno ${reminder.id}:`, error);
                }
            }

            return null;
        } catch (error) {
            console.error('Error en función de recordatorios:', error);
            return null;
        }
    });

// ================================
// Función: Notificar al Barber/Admin cuando se cancela un turno
// ================================
exports.notifyCancelledAppointment = functions.firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Verificar si el turno fue cancelado
        if (before.status !== 'cancelado' && after.status === 'cancelado') {
            console.log('Turno cancelado:', context.params.appointmentId);

            try {
                // Crear payload de notificación
                const notificationPayload = {
                    notification: {
                        title: 'Turno Cancelado',
                        body: `${after.clientName} canceló su turno de ${after.serviceName} a las ${after.time}`,
                        icon: 'assets/images/logo.png',
                        clickAction: 'panel-dueno.html'
                    },
                    data: {
                        type: 'appointment_cancelled',
                        appointmentId: context.params.appointmentId,
                        click_action: '/panel-dueno.html'
                    },
                    webpush: {
                        fcmOptions: {
                            link: '/panel-dueno.html'
                        }
                    }
                };

                // Notificar al profesional
                const professionalDoc = await db.collection('users').doc(after.professionalId).get();
                if (professionalDoc.exists && professionalDoc.data().fcmToken) {
                    await admin.messaging().send({
                        ...notificationPayload,
                        token: professionalDoc.data().fcmToken
                    });
                }

                // Notificar a todos los owners
                const ownersSnapshot = await db.collection('users').where('role', '==', 'owner').get();
                
                const notificationsPromises = ownersSnapshot.docs.map(async (ownerDoc) => {
                    const owner = ownerDoc.data();
                    if (owner.fcmToken) {
                        return admin.messaging().send({
                            ...notificationPayload,
                            token: owner.fcmToken
                        });
                    }
                });

                await Promise.all(notificationsPromises);

                return null;
            } catch (error) {
                console.error('Error enviando notificación de cancelación:', error);
                return null;
            }
        }

        return null;
    });

// ================================
// Función de utilidad
// ================================
function formatDate(date) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('es-AR', options);
}
