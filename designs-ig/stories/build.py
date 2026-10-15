"""Generates one 1080x1920 story frame per design plus the highlight cover."""
from urllib.parse import quote

O = lambda t: '../' + quote(f'ChatGPT Image 14 Oct 2026, {t}.png')
N = lambda f: f'../concepts-v2/{f}.png'

# (slug, name, image, bg, fg, description)
D = [
 ('wordmark','Wordmark',O('19_09_42'),'#bcdbe6','#10201e','Гігантський логотип як головний елемент сторінки. Добірки за сценарієм життя: «Місто» і «За місто», кожна зі своїм настроєм.'),
 ('profile','Profile',O('19_09_56'),'#d8ecdc','#1d3fbf','Авто в профіль на тлі великого логотипу. Мінімум елементів, максимум впливу, а наступне авто видно одразу внизу.'),
 ('brands','Brands',O('19_10_01'),'#f2f2ef','#111111','Вибір починається з марки: колонки Audi, BMW, Volvo і MINI, кожна у своєму кольорі, з найкращою пропозицією всередині.'),
 ('pavilion','Pavilion',O('19_09_38'),'#111111','#ffffff','Усі авто знято в одному павільйоні: однакове світло й ракурс. Фільтри та статуси «в наявності» і «у дорозі» одразу під добіркою.'),
 ('quiz','Quiz',O('19_08_56'),'#fbf3ea','#1a1a1a','Підбір прямо в першому екрані: тип кузова, марка й бюджет. Тепла палітра та serif-заголовок додають довіри.'),
 ('registry','Registry',O('19_09_30'),'#efece4','#1c1a14','Каталог у вигляді списку з номерами, статусами й цінами. Спокійна подача для тих, хто порівнює й не поспішає.'),
 ('night','Night',O('19_08_29'),'#0b1118','#ffffff','Вечірній шоурум: темна палітра, тонкий шрифт і світло фар. Створює преміальний настрій ще до першого кліку.'),
 ('character','Character',O('19_08_48'),'#e8eaea','#0d0d0d','Емоційний перший екран: вузький капс, пейзаж за кермом і інтер’єр у кадрі. Для тих, хто продає враження, а не лише авто.'),
 ('editorial','Editorial',O('19_09_01'),'#eceaff','#111111','Журнальна подача: serif-заголовок, кольорові плитки з авто та добірки за форматом життя. Лаймова кнопка тримає фокус.'),
 ('rail','Rail',O('19_09_04'),'#d2582b','#1a1410','Бічна кольорова панель із головним посланням, праворуч великий кадр і каталог. Яскраво і зручно на широких екранах.'),
 ('sunny','Sunny',O('19_08_52'),'#f6e98f','#2a1730','Тепле жовте тло зі сливовим акцентом. Авто тижня винесене в окремий блок, нижче каталог із вкладками за кузовом.'),
 ('collections','Collections',O('19_09_48'),'#f5f5f3','#111111','Бічне меню добірок, галерея з салоном і багажником та панель «Ваш вибір» праворуч. Зручно порівнювати та зберігати.'),
 ('showroom','Showroom',O('19_07_58'),'#f1f1ee','#1b1b1b','Світлий мінімалізм: великий заголовок, широкий кадр авто на всю ширину й стримана бордова кнопка.'),
 ('studio','Studio',O('19_08_44'),'#e4e8ec','#12161c','Студійне світло й нейтральна палітра. У першому екрані видно характеристики, а дві кнопки ведуть до перегляду або запису на огляд.'),
 ('bold','Bold',O('19_08_35'),'#f6f6f4','#000000','Контрастний білий з електричним синім. Щільний жирний заголовок і швидкі фільтри за бюджетом та призначенням.'),
 ('marketplace','Marketplace',N('01-marketplace'),'#0f1f1c','#ffffff','Щільна сітка з фільтрами збоку: на одному екрані до дев’яти авто. Ціна в $ і гривні, а Viber, Telegram і дзвінок доступні прямо на картці.'),
 ('hybrid','Hybrid',N('03-hybrid-ev'),'#07110d','#e8f5ee','Ефективність у цифрах: вартість 100 км, запас ходу й час заряджання поряд з авто. Темна палітра з м’ятним акцентом.'),
 ('budget','Budget',N('04-budget'),'#ffe500','#0d0d0d','Гучний жовтий із чорним і великі цінники. Чіпси бюджету зверху, кожне авто з кнопкою «Написати».'),
 ('turnkey','Turnkey',N('02-import'),'#0b1f3a','#ffffff','Калькулятор одразу показує повну вартість авто «під ключ». Нижче таймлайн із п’яти кроків і кейси з реальними термінами доставки.'),
]

TPL = '''<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>{name}</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0}}
body{{width:1080px;height:1920px;overflow:hidden;font-family:Onest,sans-serif;background:{bg};color:{fg};position:relative}}
.tag{{position:absolute;top:335px;left:60px;font-size:30px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.6}}
h1{{position:absolute;top:395px;left:60px;right:60px;font-size:150px;line-height:.98;letter-spacing:-6px;font-weight:800}}
.lap{{position:absolute;left:50px;right:50px;top:650px;border-radius:22px 22px 0 0;background:#1a1a1f;padding:14px 14px 0;box-shadow:0 50px 90px -30px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);border-bottom:0}}
.bar{{height:30px;display:flex;gap:10px;align-items:center;padding-left:10px}}
.bar i{{width:14px;height:14px;border-radius:50%;background:#555}}
.lap img{{display:block;width:100%;border-radius:6px 6px 0 0}}
.base{{position:absolute;left:10px;right:10px;top:1408px;height:22px;background:linear-gradient(#c9c9cf,#8d8d95);border-radius:0 0 40px 40px}}
.for{{position:absolute;left:60px;right:60px;top:1465px;font-size:35px;line-height:1.3;font-weight:500}}
</style></head><body>
<div class="tag">Дизайн {num}</div>
<h1>{name}</h1>
<div class="lap"><div class="bar"><i></i><i></i><i></i></div><img src="{img}"></div>
<div class="base"></div>
<div class="for">{desc}</div>
</body></html>'''

for i, (slug, name, img, bg, fg, desc) in enumerate(D, 1):
    open(f'{i:02d}-{slug}.html', 'w').write(TPL.format(num=f'{i:02d}', name=name, img=img, bg=bg, fg=fg, desc=desc))

# Highlight cover: Instagram shows only the central circle, so the glyph stays small and centered.
open('00-cover.html', 'w').write('''<!doctype html><html><head><meta charset="utf-8"><title>cover</title>
<style>*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:#141414;display:grid;place-items:center}
.g{width:440px;height:340px;border-radius:36px;border:14px solid #f1ece2;padding:26px;display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:18px}
.g i{border-radius:12px;background:#f1ece2}
.g i:first-child{grid-row:span 2;background:#d2582b}
.g i:nth-child(3){background:#7fd6c4}
</style></head><body><div class="g"><i></i><i></i><i></i></div></body></html>''')
print(len(D), 'frames')
