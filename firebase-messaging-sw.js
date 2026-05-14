importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAMFSxdcJms7KV5sJQctN1KoapNu3fLU6E",
    authDomain: "api-logistics-b40cd.firebaseapp.com",
    projectId: "api-logistics-b40cd",
    storageBucket: "api-logistics-b40cd.appspot.com",
    messagingSenderId: "991718957681",
    appId: "1:991718957681:web:45d1f0e5dacea5a5fb71d0",
    measurementId: "G-5CBS9J6D4Q"
});

const messaging = firebase.messaging();
