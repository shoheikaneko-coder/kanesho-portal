const fs = require('fs');
let code = fs.readFileSync('manager_meeting.js', 'utf8');

// Harden fetchMeetingData against NaN by ensuring amounts are numbers
code = code.replace(
    "const amount = (d.amount || d.Amount || d['売上税込'] || 0) / TAX_RATE;",
    "const rawAmt = String(d.amount || d.Amount || d['売上税込'] || '0').replace(/,/g, '');\n        const amount = (Number(rawAmt) || 0) / TAX_RATE;"
);

code = code.replace(
    "const h = Number(d.total_labor_hours || d.TotalLaborHours || 0);",
    "const h = Number(String(d.total_labor_hours || d.TotalLaborHours || '0').replace(/,/g, '')) || 0;"
);

code = code.replace(
    "targetSales = Number(goalSnap.data().sales_target || 0);",
    "targetSales = Number(String(goalSnap.data().sales_target || '0').replace(/,/g, '')) || 0;"
);

code = code.replace(
    "targetSphOp = Number(bSnap.data().target_sales_per_hour_op || 0);",
    "targetSphOp = Number(String(bSnap.data().target_sales_per_hour_op || '0').replace(/,/g, '')) || 0;"
);

fs.writeFileSync('manager_meeting.js', code);
