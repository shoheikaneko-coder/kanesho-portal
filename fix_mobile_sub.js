const fs = require('fs');
let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

const targetStr = `        if (isAdmin) {
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
        }`;

const newStr = `        if (isAdmin || myJobTitle) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id) return false;
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                
                if (!u.GradeCode || !gradeMap[u.GradeCode]) return false;
                const uJobTitle = gradeMap[u.GradeCode].job_title;
                if (!uJobTitle) return false;
                
                const uRoute = routeMap[uJobTitle];
                if (!uRoute) return false;
                
                const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;
                const isAdminEvaluator = isAdmin && (uRoute.primary_evaluator === '社長' || uRoute.secondary_evaluator === '社長');
                
                if (isEvaluator || isAdminEvaluator) {
                    if (isAdmin) return true;
                    if ((u.StoreID || u.StoreId) === myStore) return true;
                }
                
                if ((u.StoreID || u.StoreId) === myStore) {
                    if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                        if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                    }
                }
                
                return false;
            });
        }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, newStr);
    fs.writeFileSync('evaluation_mobile.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
