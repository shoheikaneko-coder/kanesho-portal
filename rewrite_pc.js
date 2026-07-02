const fs = require('fs');

let code = fs.readFileSync('evaluation.js', 'utf8');

// The logic to build grade map and route map
const mapsLogic = `
    // --- 新しい動的部下判定ロジック用マスタロード ---
    let gradeMap = {};
    let routeMap = {};
    try {
        const gradesSnap = await getDocs(collection(db, "m_grades"));
        gradesSnap.forEach(d => {
            const data = d.data();
            if (data.grade_code) gradeMap[data.grade_code] = data;
        });
        
        const routesSnap = await getDocs(collection(db, "m_evaluation_routes"));
        routesSnap.forEach(d => {
            routeMap[d.id] = d.data();
        });
    } catch(e) { console.error("Failed to load grades or routes:", e); }
    // ----------------------------------------------
`;

// Replace the jobTitlesSet loading with the new master loading
code = code.replace(
    /    \/\/ 等級マスタから役職（job_title）のロード[\s\S]*?    \} catch\(e\) \{ console\.error\("Failed to load job titles for eval:", e\); \}/,
    mapsLogic
);

const usersLogic = `
    const role = user.Role || 'Staff';
    const myStore = user.StoreID || user.StoreId;
    
    // 全ユーザーを取得
    const allUsers = [];
    try {
        const qUsers = query(collection(db, "m_users"));
        const snapUsers = await getDocs(qUsers);
        snapUsers.forEach(d => {
            allUsers.push({ id: d.id, ...d.data() });
        });
    } catch(e) { console.error("Failed to load users:", e); }
    
    // 現在のユーザーの役職を等級マスタから判定
    let myJobTitle = '';
    if (user.GradeCode && gradeMap[user.GradeCode]) {
        myJobTitle = gradeMap[user.GradeCode].job_title || '';
    }

    subordinateUsers = [];
    let hasSubordinates = false;
    const isAdmin = role === 'Admin' || role === '管理者';

    if (isAdmin) {
        hasSubordinates = true;
        subordinateUsers = allUsers.filter(u => {
            if (u.id === user.id) return true; // 管理者はテストのため自身も表示可能
            if (u.Status === 'retired' || u.Status === '退職済') return false;
            return true;
        });
    } else if (myJobTitle) {
        // 同じ店舗の全従業員について判定
        subordinateUsers = allUsers.filter(u => {
            if (u.id === user.id) return false;
            if (u.Status === 'retired' || u.Status === '退職済') return false;
            if ((u.StoreID || u.StoreId) !== myStore) return false;
            
            // 相手の等級から役職を判定 (設定がない場合は完全除外)
            if (!u.GradeCode || !gradeMap[u.GradeCode]) return false;
            const uJobTitle = gradeMap[u.GradeCode].job_title;
            if (!uJobTitle) return false;
            
            // 相手の評価ルートを取得
            const uRoute = routeMap[uJobTitle];
            if (!uRoute) return false;
            
            // 自分の役職が、相手の1次評価者または最終評価者であれば部下として扱う
            const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;
            
            // 管理者特権: 自分が店長・統括店長の場合、評価ルートに関わらず自店舗のスタッフ（同格以上を除く）を表示する
            if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                if (uJobTitle === '店長' || uJobTitle === '統括店長') return false;
                return true;
            }
            
            return isEvaluator;
        });
        
        hasSubordinates = subordinateUsers.length > 0;
    }
    
    const tabSubordinates = document.getElementById('tab-subordinates');
    const tabInterview = document.getElementById('tab-interview');
    const tabPresident = document.getElementById('tab-president');
    const tabAdmin = document.getElementById('tab-admin');
`;

// Replace the tab visibility logic
code = code.replace(
    /    \/\/ 3\. 権限に基づくタブの表示制御[\s\S]*?    \} catch\(e\) \{ console\.error\("Failed to load users for admin:", e\); \}/,
    usersLogic + `
    if (isAdmin) {
        allStaffUsersForAdmin = allUsers.filter(u => {
            return u.Status !== 'retired' && u.Status !== '退職済' && u.Role !== 'Tablet' && u.Role !== '店舗タブレット';
        });
`
);

code = code.replace(
    /    \} else if \(role === 'Manager' \|\| role === '店長'\) \{/,
    `    } else if (hasSubordinates) {`
);

// We need to clean up loadEvaluationData since subordinateUsers is already fetched!
code = code.replace(
    /        \/\/ 3\. 店長の場合の部下のユーザーリストをロード[\s\S]*?        \/\/ バッジカウントの表示更新/,
    `        // 3. 部下ユーザーのバッジ更新 (データは既にロード済み)
        updateTabBadges();`
);

fs.writeFileSync('evaluation.js', code);
