import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add cache variables
cache_str = """let globalJobTitles = [];       // マスタからロードした一意な役職（job_title）リスト

// マスタデータキャッシュ（ページ滞在中は再取得しない）
let _masterCache = {
    stores: null,
    grades: null,
    routes: null,
    users: null,
    cacheTime: null
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ有効
"""
content = content.replace("let globalJobTitles = [];       // マスタからロードした一意な役職（job_title）リスト\n", cache_str)

# 2. Add render guard
guard_old = """function renderSubordinatesTab(container) {
    const targetUsers = subordinateUsers.filter(u => {"""

guard_new = """function renderSubordinatesTab(container) {
    // データロード完了前に描画されることへの安全ガード
    if (!activeEvaluations || activeEvaluations.length === 0) {
        if (localPeriodSettings && localPeriodSettings.status === 'open') {
            container.innerHTML = '<div style="text-align:center; padding:4rem;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#cbd5e1;"></i><div style="margin-top:1.5rem; color:#94a3b8; font-weight:700;">データを読み込んでいます...</div></div>';
            return;
        }
    }

    const targetUsers = subordinateUsers.filter(u => {"""
content = content.replace(guard_old, guard_new)

# 3. Parallelize & Cache loadEvaluationApp
block_start = "    // 店舗マスタのロード（名称解決用）"
block_end = "    // 現在のユーザーの役職を等級マスタから判定"

start_idx = content.find(block_start)
end_idx = content.find(block_end)

if start_idx == -1 or end_idx == -1:
    print("Error finding blocks")
    sys.exit(1)

old_block = content[start_idx:end_idx]

new_block = """    // --- キャッシュの確認 ---
    const now = Date.now();
    const isCacheValid = _masterCache.cacheTime && (now - _masterCache.cacheTime) < CACHE_TTL_MS;

    let gradeMap = {};
    let routeMap = {};
    let allUsers = [];

    if (isCacheValid) {
        // キャッシュから復元
        globalStoreMapForEval = _masterCache.stores;
        gradeMap = _masterCache.grades;
        routeMap = _masterCache.routes;
        allUsers = _masterCache.users;
        
        // 評価期設定のみ最新を取得 (並列)
        try {
            const [periodDoc] = await Promise.all([
                getDoc(doc(db, "settings", "evaluation"))
            ]);
            
            if (periodDoc.exists()) {
                localPeriodSettings = periodDoc.data();
                updatePeriodBanner();
            } else {
                localPeriodSettings = null;
                updatePeriodBannerEmpty();
            }
        } catch (e) {
            console.error("Failed to load evaluation period settings from cache path:", e);
        }
    } else {
        // キャッシュがない/古い場合は全て並列取得
        try {
            const [storeSnap, gradesSnap, routesSnap, periodDoc, snapUsers] = await Promise.all([
                getDocs(collection(db, "m_stores")),
                getDocs(collection(db, "m_grades")),
                getDocs(collection(db, "m_evaluation_routes")),
                getDoc(doc(db, "settings", "evaluation")),
                getDocs(query(collection(db, "m_users")))
            ]);

            globalStoreMapForEval = {};
            storeSnap.forEach(d => {
                const data = d.data();
                globalStoreMapForEval[d.id] = data.store_name || data.店舗名 || d.id;
            });

            gradesSnap.forEach(d => {
                const data = d.data();
                if (data.grade_code) gradeMap[data.grade_code] = data;
            });

            routesSnap.forEach(d => {
                routeMap[d.id] = d.data();
            });
            
            if (periodDoc.exists()) {
                localPeriodSettings = periodDoc.data();
                updatePeriodBanner();
            } else {
                localPeriodSettings = null;
                updatePeriodBannerEmpty();
            }

            snapUsers.forEach(d => {
                allUsers.push({ id: d.id, ...d.data() });
            });

            // キャッシュに保存
            _masterCache.stores = globalStoreMapForEval;
            _masterCache.grades = gradeMap;
            _masterCache.routes = routeMap;
            _masterCache.users = allUsers;
            _masterCache.cacheTime = now;

        } catch(e) {
            console.error("Failed to load initial data in parallel:", e);
        }
    }

    // 1. シードデータの確認・投入
    await verifyAndSeedTemplates();

    const role = user.Role || 'Staff';
    const myStore = user.StoreID || user.StoreId;
    
"""

content = content.replace(old_block, new_block)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
