const fs = require('fs');

function fixEvaluationJs() {
    let code = fs.readFileSync('evaluation.js', 'utf8');

    // 1. Fix subordinate filtering logic
    const oldLogic = `            // 【自店舗のフォールバック】店長・統括店長は評価ルート未設定の一般スタッフも強制表示
            if ((u.StoreID || u.StoreId) === myStore) {
                if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                    if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                }
            }`;
    const newLogic = `            // 【自店舗のフォールバック】店長・統括店長は評価ルート未設定の一般スタッフも強制表示
            if (!isAdmin && (u.StoreID || u.StoreId) === myStore) {
                if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                    if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                }
            }`;
    if (code.includes(oldLogic)) {
        code = code.replace(oldLogic, newLogic);
        console.log("Fixed subordinate filtering in evaluation.js");
    }

    // 2. Fix JobTitle rendering in tables
    const oldJobTitleRender1 = `<td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">\${u.JobTitle || '一般'}</td>`;
    const newJobTitleRender1 = `<td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">\${(u.GradeCode && window.appState.gradeMap && window.appState.gradeMap[u.GradeCode]) ? window.appState.gradeMap[u.GradeCode].job_title : (u.JobTitle || '一般')}</td>`;
    
    if (code.includes(oldJobTitleRender1)) {
        code = code.replaceAll(oldJobTitleRender1, newJobTitleRender1);
        console.log("Fixed JobTitle rendering in evaluation.js");
    }

    // 3. Optimize chunked queries with Promise.all
    const oldChunkQuery = `            // チャンク分割して in クエリを発行 (最大10件ずつ)
            for (let i = 0; i < targetUserIds.length; i += 10) {
                const chunk = targetUserIds.slice(i, i + 10);
                const chunkSnap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", period), where("user_id", "in", chunk)));
                chunkSnap.forEach(d => {
                    if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                });
            }`;
    const newChunkQuery = `            // チャンク分割して in クエリを並列発行 (最大10件ずつ)
            const chunkPromises = [];
            for (let i = 0; i < targetUserIds.length; i += 10) {
                const chunk = targetUserIds.slice(i, i + 10);
                chunkPromises.push(getDocs(query(collection(db, "t_evaluations"), where("period", "==", period), where("user_id", "in", chunk))));
            }
            const chunkSnaps = await Promise.all(chunkPromises);
            chunkSnaps.forEach(snap => {
                snap.forEach(d => {
                    if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                });
            });`;
    if (code.includes(oldChunkQuery)) {
        code = code.replace(oldChunkQuery, newChunkQuery);
        console.log("Optimized chunk queries in evaluation.js");
    }

    fs.writeFileSync('evaluation.js', code);
}

function fixMobileJs() {
    let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

    // 1. Fix subordinate filtering logic
    const oldLogic = `                if ((u.StoreID || u.StoreId) === myStore) {
                    if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                        if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                    }
                }`;
    const newLogic = `                if (!isAdmin && (u.StoreID || u.StoreId) === myStore) {
                    if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                        if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                    }
                }`;
    if (code.includes(oldLogic)) {
        code = code.replace(oldLogic, newLogic);
        console.log("Fixed subordinate filtering in evaluation_mobile.js");
    }

    // 2. Fix JobTitle rendering in mobile (if applicable)
    const oldJobTitleRender = `<div class="eval-mob-item-subtitle">\${u.JobTitle || '一般'}`;
    const newJobTitleRender = `<div class="eval-mob-item-subtitle">\${(u.GradeCode && window.appState.gradeMap && window.appState.gradeMap[u.GradeCode]) ? window.appState.gradeMap[u.GradeCode].job_title : (u.JobTitle || '一般')}`;
    
    if (code.includes(oldJobTitleRender)) {
        code = code.replaceAll(oldJobTitleRender, newJobTitleRender);
        console.log("Fixed JobTitle rendering in evaluation_mobile.js");
    }

    // 3. Optimize chunked queries
    const oldChunkQuery = `                for (let i = 0; i < targetUserIds.length; i += 10) {
                    const chunk = targetUserIds.slice(i, i + 10);
                    const chunkSnap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", period), where("user_id", "in", chunk)));
                    chunkSnap.forEach(d => {
                        if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                    });
                }`;
    const newChunkQuery = `                const chunkPromises = [];
                for (let i = 0; i < targetUserIds.length; i += 10) {
                    const chunk = targetUserIds.slice(i, i + 10);
                    chunkPromises.push(getDocs(query(collection(db, "t_evaluations"), where("period", "==", period), where("user_id", "in", chunk))));
                }
                const chunkSnaps = await Promise.all(chunkPromises);
                chunkSnaps.forEach(snap => {
                    snap.forEach(d => {
                        if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                    });
                });`;
    
    if (code.includes(oldChunkQuery)) {
        code = code.replace(oldChunkQuery, newChunkQuery);
        console.log("Optimized chunk queries in evaluation_mobile.js");
    }

    fs.writeFileSync('evaluation_mobile.js', code);
}

fixEvaluationJs();
fixMobileJs();
