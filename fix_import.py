with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_import = 'import { collection, getDocs, getDoc, setDoc, updateDoc, doc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";'
new_import = 'import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";'

if old_import in content:
    content = content.replace(old_import, new_import)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Import statement not found exactly as expected.")
