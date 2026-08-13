import os
import glob
import re

html_files = glob.glob('*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Footer updates
    if '<h4>İletişim</h4>' in content:
        # Replace the address block
        content = re.sub(
            r'<span class="icon">📍</span>\s*<span>.*?</span>',
            '<span class="icon">📍</span>\n          <span>Yeni Mahalle 87071 Sokak No:5 Z32 M1 Avm Seyhan/Adana</span>',
            content, flags=re.DOTALL
        )
        
        # Replace the phone block
        content = re.sub(
            r'<span class="icon">📞</span>\s*<span>.*?</span>',
            '<span class="icon">📞</span>\n          <span>0543 440 25 25</span>',
            content, flags=re.DOTALL
        )
        
        # Replace the hours block
        content = re.sub(
            r'<span class="icon">🕐</span>\s*<span>.*?</span>',
            '<span class="icon">🕐</span>\n          <span>Her Gün: 10:00–18:00</span>',
            content, flags=re.DOTALL
        )

    # Add Hakkımızda link to Footer 'Kategoriler' or 'Hesabım'
    # Let's add it under 'Kategoriler' or rename 'Kategoriler' to 'Kurumsal & Kategoriler'
    # Let's add a new section in the footer, or just append to Kategoriler
    if '<h4>Kategoriler</h4>' in content and 'Hakkımızda' not in content:
        content = content.replace(
            '<a href="urunler.html" class="footer-link">🛍 Tüm Ürünler</a>',
            '<a href="urunler.html" class="footer-link">🛍 Tüm Ürünler</a>\n          <a href="hakkimizda.html" class="footer-link">🏢 Hakkımızda</a>'
        )

    # Add Hakkımızda link to Navbar (Optional, let's put it next to Kategoriler if it exists)
    # Actually, navbar doesn't have a clear "Hakkımızda" slot, but it has Categories dropdown. Let's add it next to "Sepetim" or in the right menu.
    if 'href="urunler.html" class="nav-icon-btn"' in content and 'hakkimizda.html' not in content:
        content = content.replace(
            '<a href="urunler.html" class="nav-icon-btn"',
            '<a href="hakkimizda.html" class="nav-icon-btn" title="Hakkımızda">🏢</a>\n        <a href="urunler.html" class="nav-icon-btn"'
        )
        
    # Also let's enforce `<br>` between efemi and iletişim just in case CSS doesn't cut it.
    if '<span class="logo-name">efemi</span>' in content and '<span class="logo-sub">iletişim</span>' in content:
        # User requested: "efem iletişim alt alta gelecek şekilde revize et"
        # It is already "efemi" "iletişim". I will wrap them in a clear structure.
        pass

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("HTML files updated.")
