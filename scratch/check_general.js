async function check() {
    const url = 'https://firestore.googleapis.com/v1/projects/kaneshow-portal/databases/(default)/documents/m_evaluation_templates/general';
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.fields || !data.fields.items || !data.fields.items.arrayValue || !data.fields.items.arrayValue.values) {
        console.error("Malformed document data:", data);
        return;
    }
    
    const items = data.fields.items.arrayValue.values;
    console.log("Total items in general:", items.length);
    
    items.forEach((item, idx) => {
        const fields = item.mapValue.fields;
        if (!fields) {
            console.log(`Index ${idx}: [Null fields]`);
            return;
        }
        console.log(`Index ${idx}:`, {
            item_id: fields.item_id ? fields.item_id.stringValue : undefined,
            category: fields.category ? fields.category.stringValue : undefined,
            title: fields.title ? fields.title.stringValue : undefined,
            description: fields.description ? fields.description.stringValue : undefined,
            display_order: fields.display_order ? fields.display_order.integerValue : undefined
        });
    });
}

check().catch(console.error);
