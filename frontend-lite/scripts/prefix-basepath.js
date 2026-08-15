const fs = require('fs');
const path = require('path');

const views = path.join(__dirname, '..', 'views');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.ejs')) patch(full);
  }
}

function patch(file) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = s.replace(/href="\/<%=/g, 'href="<%= basePath %>/<%=');
  // fix double if already somehow - no
  // Undo mistaken href="<%= basePath %>/<%= locale %>" when we had href="/<%= locale %>"
  // Pattern href="/<%= became href="<%= basePath %>/<%=  — but original was href="/<%= locale %>"
  // so result is href="<%= basePath %>/<%= locale %>" — WRONG because we ate the "locale" start
  // Actually: href="/<%= locale %>" → href="<%= basePath %>/<%= locale %>" 
  // replace href="/<%= with href="<%= basePath %>/<%= 
  // "/<%= locale %>" → "<%= basePath %>/<%= locale %>" YES correct!

  s = s.replace(/action="\/<%=/g, 'action="<%= basePath %>/<%=');
  s = s.replace(/href="\/prefer/g, 'href="<%= basePath %>/prefer');
  s = s.replace(/href="\/styles\.css"/g, 'href="<%= basePath %>/styles.css"');
  s = s.replace(/src="\/app\.js"/g, 'src="<%= basePath %>/app.js"');
  s = s.replace(/src="\/placeholder\.svg"/g, 'src="<%= basePath %>/placeholder.svg"');
  // locale switch links like href="/<%= locale === 
  // already handled by href="/<%=
  // form next values value="/<%= 
  s = s.replace(/value="\/<%=/g, 'value="<%= basePath %>/<%=');
  if (s !== before) {
    fs.writeFileSync(file, s);
    console.log('patched', path.relative(views, file));
  }
}

walk(views);
console.log('done');
