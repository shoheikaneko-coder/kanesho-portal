const fs = require('fs');
let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

// Optimize chunked queries
const oldChunkQuery = `                for (let i = 0; i < targetUserIds.length; i += 10) {
                    const chunk = targetUserIds.slice(i, i + 10);
                    const chunkSnap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period), where("user_id", "in", chunk)));
                    chunkSnap.forEach(d => {
                        if (!docs.some(existing => existing.id === d.id)) docs.push(d);
                    });
                }`;
const newChunkQuery = `                const chunkPromises = [];
                for (let i = 0; i < targetUserIds.length; i += 10) {
                    const chunk = targetUserIds.slice(i, i + 10);
                    chunkPromises.push(getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period), where("user_id", "in", chunk))));
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

// Fix JobTitle rendering
const oldJobTitleRegex = /<div class="eval-mob-item-subtitle">\${u\.JobTitle \|\| '一般'}/g;
const newJobTitleRender = `<div class="eval-mob-item-subtitle">\${(u.GradeCode && window.appState.gradeMap && window.appState.gradeMap[u.GradeCode]) ? window.appState.gradeMap[u.GradeCode].job_title : (u.JobTitle || '一般')}`;

if (code.match(oldJobTitleRegex)) {
    code = code.replace(oldJobTitleRegex, newJobTitleRender);
    console.log("Fixed JobTitle rendering in evaluation_mobile.js");
}

fs.writeFileSync('evaluation_mobile.js', code);
