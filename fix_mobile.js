const fs = require('fs');
let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

// Replace subordinate logic
const subLogicRegex = /if \(isAdmin\) \{[\s\S]*?return false;\n            \}\);\n        \}/;
const newSubLogic = `if (isAdmin || myJobTitle) {
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
code = code.replace(subLogicRegex, newSubLogic);

// Add logic to hide self tab and fetch properly
const fetchRegex = /let eSnap;\n\s*const isAdmin = role === 'Admin' \|\| role === '管理者';\n\s*if \(isAdmin\) \{[\s\S]*?\}\n\s*eSnap\.forEach\(d => \{/;

const newFetchLogic = `let docs = [];
            const isAdmin = role === 'Admin' || role === '管理者';

            if (isAdmin) {
                // UI: 自分の評価タブを消してデフォルトを部下に
                const segCtrl = document.getElementById('eval-mob-segmented-control');
                if (segCtrl) {
                    segCtrl.innerHTML = '<div class="eval-mob-segment active" data-tab="subordinates">部下の評価</div>';
                }
                mobileActiveTab = 'subordinates';

                // Fetch target evaluations (Admin)
                const targetUserIds = mobileSubordinateUsers.map(u => u.id);
                targetUserIds.push(currentUser.id);

                for (let i = 0; i < targetUserIds.length; i += 10) {
                    const chunk = targetUserIds.slice(i, i + 10);
                    const chunkSnap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period), where("user_id", "in", chunk)));
                    chunkSnap.forEach(d => {
                        if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                    });
                }
            } else if (mobileSubordinateUsers.length > 0) {
                const snapEvals = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period), where("store_id", "==", myStore)));
                snapEvals.forEach(d => docs.push(d));
            } else {
                const snapEvals = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period), where("user_id", "==", currentUser.id)));
                snapEvals.forEach(d => docs.push(d));
            }
            
            docs.forEach(d => {`;

code = code.replace(fetchRegex, newFetchLogic);

fs.writeFileSync('evaluation_mobile.js', code);
console.log("Updated evaluation_mobile.js");
