import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    old_pattern = r'const rawSid = String\(p\.staff_id \|\| p\.staff_code \|\| p\.EmployeeCode \|\| ""\)\.trim\(\);'
    new_pattern = r'const rawSid = String(p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "").trim();'

    new_content = re.sub(old_pattern, new_pattern, content)

    # Let's also check for any occurrences with just `p.staff_id || ""`
    old_pattern_2 = r'const rawSid = String\(p\.staff_id \|\| ""\)\.trim\(\);'
    new_pattern_2 = r'const rawSid = String(p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "").trim();'

    new_content = re.sub(old_pattern_2, new_pattern_2, new_content)


    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Patched UserId successfully")

if __name__ == "__main__":
    patch_file('attendance_management.js')
