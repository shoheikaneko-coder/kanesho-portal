import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Patch the delete logic
    old_delete = r'''            const normalizeId = \(id\) => String\(id \|\| ""\)\.trim\(\)\.replace\(/^\0\+/, ''\);
            const targetIdNorm = normalizeId\(currentStaff\.id\);

            const processSnap = \(snap\) => \{
                snap\.forEach\(d => \{
                    const data = d\.data\(\);
                    const pid = data\.staff_id \|\| data\.EmployeeCode \|\| d\.id;
                    if \(normalizeId\(pid\) === targetIdNorm\) \{'''
                    
    new_delete = r'''            const normalizeId = (id) => String(id || "").trim().replace(/^0+/, '');
            const targetIdNorm = normalizeId(currentStaff.id);
            
            let docIdNorm = targetIdNorm;
            const uq = query(collection(db, 'm_users'), where('EmployeeCode', '==', currentStaff.id));
            const uSnap = await getDocs(uq);
            if (!uSnap.empty) {
                docIdNorm = normalizeId(uSnap.docs[0].id);
            }

            const processSnap = (snap) => {
                snap.forEach(d => {
                    const data = d.data();
                    const pid = data.staff_id || data.EmployeeCode || d.id;
                    if (normalizeId(pid) === targetIdNorm || normalizeId(pid) === docIdNorm) {'''

    content = re.sub(old_delete, new_delete, content)

    # Patch the insert docId generation
    old_docid = r'const docId = `\$\{p\.staff_id\}_'
    new_docid = r'const docId = `${currentStaff.id}_'
    content = re.sub(old_docid, new_docid, content)

    # Patch the insert staff_id
    old_staffid = r'staff_id: String\(p\.staff_id \|\| ""\)\.trim\(\),'
    new_staffid = r'staff_id: String(currentStaff.id).trim(),'
    content = re.sub(old_staffid, new_staffid, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Patched saveAttendanceEdits successfully")

if __name__ == "__main__":
    patch_file('attendance_management.js')
