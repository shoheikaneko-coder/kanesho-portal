with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r"return \`<option", "return `<option")
content = content.replace(r"</option>\`;", "</option>`;")

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
