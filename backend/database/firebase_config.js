const admin = require('firebase-admin');
require('dotenv').config();

// Placeholder for Firebase Service Account
// The user will need to place their serviceAccountKey.json in the backend folder
// or provide the individual credentials in the .env file.

const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccount = serviceAccountPath
    ? require(path.resolve(process.cwd(), serviceAccountPath))
    : null;

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
