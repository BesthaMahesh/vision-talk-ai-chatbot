const admin = require('firebase-admin');
require('dotenv').config();
const fs = require('fs');
const path = require('path');


let serviceAccount = null;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        serviceAccount = require(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    } else if (fs.existsSync(path.join(process.cwd(), 'serviceAccountKey.json'))) {
        serviceAccount = require(path.join(process.cwd(), 'serviceAccountKey.json'));
    }
} catch (e) {
    console.warn("Could not load service account:", e.message);
}

let db = null;

if (serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log("✅ Firebase Admin Initialized");

    } catch (err) {
        console.error("❌ Firebase Initialization Error:", err.message);
    }
} else {
    console.warn("⚠️ Firebase Admin NOT Initialized. Provide credentials in .env to enable persistence.");
}

module.exports = { db, admin };
