const fs = require('fs');
const glob = require('fs').readdirSync('.');

const htmlFiles = glob.filter(file => file.endsWith('.html'));

for (const filepath of htmlFiles) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // Footer updates
    if (content.includes('<h4>İletişim</h4>')) {
        content = content.replace(
            /<span class="icon">📍<\/span>\s*<span>.*?<\/span>/s,
            '<span class="icon">📍</span>\n          <span>Yeni Mahalle 87071 Sokak No:5 Z32 M1 Avm Seyhan/Adana</span>'
        );
        
        content = content.replace(
            /<span class="icon">📞<\/span>\s*<span>.*?<\/span>/s,
            '<span class="icon">📞</span>\n          <span>0543 440 25 25</span>'
        );
        
        content = content.replace(
            /<span class="icon">🕐<\/span>\s*<span>.*?<\/span>/s,
            '<span class="icon">🕐</span>\n          <span>Her Gün: 10:00–18:00</span>'
        );
    }

    if (content.includes('<h4>Kategoriler</h4>') && !content.includes('Hakkımızda')) {
        content = content.replace(
            '<a href="urunler.html" class="footer-link">🛍 Tüm Ürünler</a>',
            '<a href="urunler.html" class="footer-link">🛍 Tüm Ürünler</a>\n          <a href="hakkimizda.html" class="footer-link">🏢 Hakkımızda</a>'
        );
    }

    if (content.includes('href="urunler.html" class="nav-icon-btn"') && !content.includes('hakkimizda.html')) {
        content = content.replace(
            '<a href="urunler.html" class="nav-icon-btn"',
            '<a href="hakkimizda.html" class="nav-icon-btn" title="Hakkımızda">🏢</a>\n        <a href="urunler.html" class="nav-icon-btn"'
        );
    }

    // Logo adjustments
    if (content.includes('<span class="logo-name">efemi</span>') && content.includes('<span class="logo-sub">iletişim</span>')) {
        // Enforce block display explicitly if CSS fails.
        content = content.replace(
            '<span class="logo-name">efemi</span>\n            <span class="logo-sub">iletişim</span>',
            '<span class="logo-name" style="display:block;line-height:1">efem</span>\n            <span class="logo-sub" style="display:block;line-height:1">iletişim</span>'
        );
        content = content.replace(
            '<span class="logo-name">efemi</span>',
            '<span class="logo-name" style="display:block;line-height:1">efem</span>'
        );
        content = content.replace(
            '<span class="logo-sub">iletişim</span>',
            '<span class="logo-sub" style="display:block;line-height:1">iletişim</span>'
        );
    }

    fs.writeFileSync(filepath, content, 'utf-8');
}
console.log("HTML files updated via Node.");
