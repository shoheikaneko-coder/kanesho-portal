/**
 * Firebase Auth 一括移行スクリプト (検証用・エミュレータ用)
 * 冪等性を確保し、再実行可能に設計。Dry Runモード対応。
 */

const admin = require('firebase-admin');

// コマンドライン引数で --dry-run を指定可能
const isDryRun = process.argv.includes('--dry-run');

// 本番環境プロジェクト
admin.initializeApp({
  projectId: "kaneshow-portal",
});

const db = admin.firestore();
const auth = admin.auth();

async function runMigration() {
  console.log(`Migration started...${isDryRun ? ' [DRY RUN MODE]' : ''}`);
  
  try {
    const usersSnap = await db.collection("m_users").get();
    
    let stats = {
      totalMUsers: usersSnap.size,
      targetCount: 0,
      missingEmail: 0,
      missingPassword: 0,
      successCount: 0,
      authExistedCount: 0,
      authMappingExistedCount: 0,
      errorCount: 0
    };

    // メールアドレスの重複チェック用
    let seenEmails = new Set();
    let duplicateEmails = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const email = (userData.Email || userData.email || '').trim();
      const plainPassword = userData.LoginPassword || userData.password;
      const role = userData.Role || 'Staff';
      const status = userData.Status || 'active';

      if (!email) {
        stats.missingEmail++;
        continue;
      }
      if (!plainPassword) {
        stats.missingPassword++;
        continue;
      }
      
      if (seenEmails.has(email.toLowerCase())) {
        duplicateEmails++;
        console.warn(`[WARNING] Duplicate email found: ${email} for m_users ID: ${userDoc.id}`);
        continue;
      }
      seenEmails.add(email.toLowerCase());
      stats.targetCount++;

      if (isDryRun) {
        continue; // Dry Runなら書き込み処理をスキップ
      }

      try {
        let authUser;
        let authExisted = false;
        try {
          // 1. Authに存在するかチェック
          authUser = await auth.getUserByEmail(email);
          authExisted = true;
          stats.authExistedCount++;
          // [修正]: 既存の場合はパスワードを上書きせず、マッピングの更新のみ行う
        } catch(e) {
          if (e.code === 'auth/user-not-found') {
            // 存在しない場合は新規作成
            authUser = await auth.createUser({
              email: email,
              password: plainPassword,
              displayName: userData.Name || '',
            });
          } else {
            throw e;
          }
        }

        const uid = authUser.uid;
        
        // 2. m_auth_users の作成・更新
        const mappingRef = db.collection("m_auth_users").doc(uid);
        const mappingSnap = await mappingRef.get();
        
        if (mappingSnap.exists) {
          stats.authMappingExistedCount++;
          // 既存マッピングがある場合はRole等を上書き更新(同期)
          await mappingRef.update({
            employeeId: userDoc.id,
            role: role,
            status: status,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // 新規作成
          await mappingRef.set({
            employeeId: userDoc.id,
            role: role,
            status: status,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        stats.successCount++;
      } catch (err) {
        stats.errorCount++;
        // 平文パスワードは出力せず、IDとエラーコードのみ出力
        console.error(`Error migrating user ${userDoc.id} (Email: ${email}): ${err.code || err.message}`);
      }
    }
    
    console.log("=========================================");
    console.log(`Migration Results ${isDryRun ? '[DRY RUN]' : ''}`);
    console.log(`Total m_users: ${stats.totalMUsers}`);
    console.log(`Missing Email: ${stats.missingEmail}`);
    console.log(`Missing Password: ${stats.missingPassword}`);
    console.log(`Duplicate Emails: ${duplicateEmails}`);
    console.log(`Target Count: ${stats.targetCount}`);
    
    if (!isDryRun) {
      console.log(`Successfully Processed: ${stats.successCount}`);
      console.log(` - Auth Existed (Updated): ${stats.authExistedCount}`);
      console.log(` - Mapping Existed (Updated): ${stats.authMappingExistedCount}`);
      console.log(`Errors: ${stats.errorCount}`);
    }
    console.log("=========================================");
    
  } catch(e) {
    console.error("Critical error during migration:", e);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration };
