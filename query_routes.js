const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; // Try port 8080 or standard 8081 depending on firebase config
// Wait, the UI runs on 8080. The emulator suite usually runs firestore on 8081.
