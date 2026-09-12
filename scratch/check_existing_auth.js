const admin = require('firebase-admin');

admin.initializeApp({
  projectId: "kaneshow-portal",
});

const db = admin.firestore();
const auth = admin.auth();

async function checkExistingAuth() {
  console.log("Checking existing Firebase Auth users for the 36 target accounts...\n");
  try {
    const usersSnap = await db.collection("m_users").get();
    
    let existingCount = 0;
    let notFoundCount = 0;
    let targetCount = 0;
    let seenEmails = new Set();

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const email = (data.Email || data.email || '').trim();
      const password = data.LoginPassword || data.password;

      // 移行対象の条件 (Dry Runと同じ)
      if (!email || !password || seenEmails.has(email.toLowerCase())) {
        continue;
      }
      seenEmails.add(email.toLowerCase());
      targetCount++;

      try {
        await auth.getUserByEmail(email);
        // エラーが出なければすでにAuthに存在する
        existingCount++;
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          notFoundCount++;
        } else {
          // エラーの詳細を出力（Email以外の機密情報は除外）
          console.error(`\n[Error Details for ${email}]`);
          console.error(`- code: ${e.code}`);
          console.error(`- message: ${e.message}`);
          
          // Identity Toolkit API などの詳細レスポンスが含まれる場合
          if (e.response && e.response.data) {
            console.error(`- response.data:`, JSON.stringify(e.response.data));
          } else if (e.originalError) {
            console.error(`- originalError.message: ${e.originalError.message}`);
          }
        }
      }
    }

    console.log(`----------------------------------------`);
    console.log(`Target Users Checked: ${targetCount}`);
    console.log(`Existing Auth Users Found: ${existingCount}`);
    console.log(`New Auth Users to be created: ${notFoundCount}`);
    console.log(`----------------------------------------`);
    
  } catch(e) {
    console.error("Error connecting to Firebase:", e);
  }
}

checkExistingAuth().then(() => process.exit(0)).catch(() => process.exit(1));
