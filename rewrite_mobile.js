const fs = require('fs');

let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

const replacement = `
        // 2. Fetch subordinate users (same logic as PC)
        mobileSubordinateUsers = [];
        
        // マスタロード
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
        } catch(e) { console.error("Failed to load grades or routes for mobile:", e); }

        const uSnap = await getDocs(collection(db, "m_users"));
        const allUsers = [];
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        
        const role = currentUser.Role || 'Staff';
        const myStore = currentUser.StoreID || currentUser.StoreId;
        
        let myJobTitle = '';
        if (currentUser.GradeCode && gradeMap[currentUser.GradeCode]) {
            myJobTitle = gradeMap[currentUser.GradeCode].job_title || '';
        }
        
        const isAdmin = role === 'Admin' || role === '管理者';
        
        if (isAdmin) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id) return true; // 管理者はテストのため自身も表示可能
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                return true;
            });
        } else if (myJobTitle) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id) return false;
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                if ((u.StoreID || u.StoreId) !== myStore) return false;
                
                if (!u.GradeCode || !gradeMap[u.GradeCode]) return false;
                const uJobTitle = gradeMap[u.GradeCode].job_title;
                if (!uJobTitle) return false;
                
                const uRoute = routeMap[uJobTitle];
                if (!uRoute) return false;
                
                const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;
                
                if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                    if (uJobTitle === '店長' || uJobTitle === '統括店長') return false;
                    return true;
                }
                
                return isEvaluator;
            });
        }
`;

code = code.replace(
    /        \/\/ 2\. Fetch subordinate users \(same logic as PC\)[\s\S]*?        \/\/ Show segmented control if has subordinates \(Admin\/Managers\)/,
    replacement + "\n        // Show segmented control if has subordinates (Admin/Managers)"
);

fs.writeFileSync('evaluation_mobile.js', code);
