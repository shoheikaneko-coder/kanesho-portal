const admin = require('firebase-admin');

admin.initializeApp({
  projectId: "kaneshow-portal",
});

const db = admin.firestore();

async function checkMissingEmails() {
  console.log("Analyzing users with missing emails...\n");
  try {
    const usersSnap = await db.collection("m_users").get();
    let missingCount = 0;

    usersSnap.forEach(doc => {
      const data = doc.data();
      const email = (data.Email || data.email || '').trim();

      if (!email) {
        missingCount++;
        const name = data.Name || '名前未設定';
        const role = data.Role || 'Role未設定';
        const status = data.Status || 'active';
        
        let recommendation = "";
        if (status === 'retired' || status === 'disabled') {
          recommendation = "退職済/無効アカウントのため移行不要と思われます。";
        } else if (role.toLowerCase().includes('tablet') || name.includes('タブレット')) {
          recommendation = "店舗タブレット等の可能性がありますが、現在利用中であればEmailの設定が必要です。";
        } else {
          recommendation = "現役スタッフの可能性があります。利用中であればEmailの設定が必要です。";
        }

        console.log(`----------------------------------------`);
        console.log(`ドキュメントID: ${doc.id}`);
        console.log(`氏名/アカウント名: ${name}`);
        console.log(`Role: ${role}`);
        console.log(`Status: ${status}`);
        console.log(`【判定】: ${recommendation}`);
      }
    });

    console.log(`----------------------------------------`);
    console.log(`Total Missing Email Count: ${missingCount}`);
  } catch(e) {
    console.error("Error analyzing users:", e);
  }
}

checkMissingEmails().then(() => process.exit(0)).catch(() => process.exit(1));
