import re
import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Inject fetching docId at the start of try block
    content = re.sub(
        r'(try \{[\r\n\s]+// インデックスエラー回避のため、日付範囲のみで取得し、JS側でスタッフIDをフィルタリング)',
        r'''try {
        let docId = staffId;
        const uq = query(collection(db, 'm_users'), where('EmployeeCode', '==', staffId));
        const uSnap = await getDocs(uq);
        if (!uSnap.empty) {
            docId = uSnap.docs[0].id;
        }

        // インデックスエラー回避のため、日付範囲のみで取得し、JS側でスタッフIDをフィルタリング''',
        content
    )

    # Patch the matching logic
    content = re.sub(
        r'const pid = data\.staff_id \|\| data\.staff_code \|\| data\.EmployeeCode \|\| data\.UserId \|\| "";[\r\n\s]+if \(String\(pid\)\.trim\(\) === String\(staffId\)\.trim\(\)\) \{',
        r'''const pid = data.staff_id || data.staff_code || data.EmployeeCode || data.UserId || "";
            if (String(pid).trim() === String(staffId).trim() || String(pid).trim() === String(docId).trim()) {''',
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Patched openStaffEdit successfully")

if __name__ == "__main__":
    patch_file('attendance_management.js')
