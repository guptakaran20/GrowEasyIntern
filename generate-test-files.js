const fs = require('fs');
const header = 'name,note\n';
const row = 'Arjun,Hello 👋 ää öö This is a very long string with a lot of unicode characters like 🌍 and 🚀\n';
const content = header + row.repeat(15000);
fs.writeFileSync('data/test-data/too-large.csv', content);
fs.writeFileSync('data/test-data/large-unicode.csv', header + row.repeat(8000));
