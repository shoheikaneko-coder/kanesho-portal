import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''        mobileSubordinateUsers = allUsers.filter\(u => \{
            if \(u.id === currentUser.id && role !== 'Admin' && role !== '管理者'\) return false;
            if \(u.Status === 'retired' || u.Status === '退職済'\) return false;
            if \(role === 'Admin' || role === '管理者'\) return true;
            
            if \(\(u.StoreID || u.StoreId\) !== myStore\) return false;
            
            const uJob = u.JobTitle || '';
            if \(myJob !== '店長' && myJob !== '統括店長'\) \{
                if \(uJob === '店長' || uJob === '統括店長'\) return false;
            \}
            if \(myJob === '一般社員' || myJob === 'アルバイト' || myJob === '社員'\) \{
                if \(uJob === '店長' || uJob === '統括店長' || uJob === '副店長'\) return false;
            \}
            
            return true;
        \}\);'''

new_block = '''        const isManagerOrAdmin = role === 'Admin' || role === '管理者' || myJob === '店長' || myJob === '統括店長';
        
        mobileSubordinateUsers = [];
        if (isManagerOrAdmin) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id && role !== 'Admin' && role !== '管理者') return false;
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                if (role === 'Admin' || role === '管理者') return true;
                
                if ((u.StoreID || u.StoreId) !== myStore) return false;
                
                const uJob = u.JobTitle || '';
                if (myJob !== '店長' && myJob !== '統括店長') {
                    if (uJob === '店長' || uJob === '統括店長') return false;
                }
                
                return true;
            });
        }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
