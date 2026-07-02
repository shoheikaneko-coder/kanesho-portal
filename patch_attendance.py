import re
import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Inject `const idResolver = {};` before `const staffMap = {};` and `const staffList = [];`
    # Handle renderTable
    content = re.sub(
        r'(const staffList = \[\];)',
        r'const idResolver = {};\n        \1',
        content
    )
    
    # Handle the other 4 loops
    content = re.sub(
        r'(const staffMap = \{\};)',
        r'const idResolver = {};\n        \1',
        content
    )

    # Step 2: Replace mapping logic in `userSnap.forEach`
    # For staffList (renderTable)
    content = re.sub(
        r'const sId = data\.EmployeeCode \|\| data\.staff_id \|\| data\.staff_code \|\| data\.UserId \|\| data\.id \|\| d\.id;[\r\n\s]+const sName = data\.Name \|\| data\.name \|\| data\.staff_name \|\| data\.DisplayName \|\| data\.name_kanji \|\| \'\';[\r\n\s]+// 文字列として確実に固定して保持[\r\n\s]+staffList\.push\(\{[\r\n\s]+id: sId \? String\(sId\)\.trim\(\) : String\(d\.id\),',
        r'''const canonicalId = String(data.EmployeeCode || d.id).trim();
            const docId = String(d.id).trim();
            idResolver[canonicalId] = canonicalId;
            idResolver[docId] = canonicalId;
            const sName = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '';
            
            // 文字列として確実に固定して保持
            staffList.push({ 
                id: canonicalId,''',
        content
    )

    # For staffMap (the 4 other functions)
    content = re.sub(
        r'const sid = data\.EmployeeCode \|\| data\.staff_id \|\| data\.staff_code \|\| data\.UserId \|\| data\.id \|\| d\.id;',
        r'''const canonicalId = String(data.EmployeeCode || d.id).trim();
            const docId = String(d.id).trim();
            idResolver[canonicalId] = canonicalId;
            idResolver[docId] = canonicalId;
            const sid = canonicalId;''',
        content
    )

    # Step 3: Replace `punches.forEach` grouping logic
    # In renderTable (punchGroup)
    content = re.sub(
        r'const sid = String\(p\.staff_id \|\| p\.staff_code \|\| p\.EmployeeCode \|\| ""\)\.trim\(\);[\r\n\s]+if \(\!punchGroup\[sid\]\) punchGroup\[sid\] = \[\];[\r\n\s]+punchGroup\[sid\]\.push\(p\);',
        r'''const rawSid = String(p.staff_id || p.staff_code || p.EmployeeCode || "").trim();
            const sid = idResolver[rawSid] || rawSid;
            if (!punchGroup[sid]) punchGroup[sid] = [];
            punchGroup[sid].push(p);''',
        content
    )

    # In other places (staffGroup / staffPunches)
    # staffGroup (fetchMonthlyData)
    content = re.sub(
        r'if \(\!staffGroup\[p\.staff_id\]\) staffGroup\[p\.staff_id\] = \[\];[\r\n\s]+staffGroup\[p\.staff_id\]\.push\(p\);',
        r'''const rawSid = String(p.staff_id || "").trim();
            const sid = idResolver[rawSid] || rawSid;
            if (!staffGroup[sid]) staffGroup[sid] = [];
            staffGroup[sid].push(p);''',
        content
    )

    # staffPunches (exportMFCSV, exportTKCCSV, exportCostData etc)
    content = re.sub(
        r'const sid = String\(p\.staff_id \|\| p\.staff_code \|\| p\.EmployeeCode \|\| ""\)\.trim\(\);[\r\n\s]+if \(\!staffPunches\[sid\]\) staffPunches\[sid\] = \[\];[\r\n\s]+staffPunches\[sid\]\.push\(p\);',
        r'''const rawSid = String(p.staff_id || p.staff_code || p.EmployeeCode || "").trim();
            const sid = idResolver[rawSid] || rawSid;
            if (!staffPunches[sid]) staffPunches[sid] = [];
            staffPunches[sid].push(p);''',
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Patched successfully")

if __name__ == "__main__":
    patch_file('attendance_management.js')
