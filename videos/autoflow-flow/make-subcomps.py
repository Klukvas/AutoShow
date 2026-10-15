from pathlib import Path
import re
base=Path('.');s=(base/'storyboard.html').read_text();style=re.search(r'<style>(.*?)</style>',s,re.S)[1]
articles=re.findall(r'<article>.*?</article>',s,re.S);dest=base/'animation/compositions';dest.mkdir(parents=True,exist_ok=True)
starts=[0,3,9,14,19,25];dur=[3,6,5,5,6,5]
production='''
.frame{position:absolute;inset:0;width:100%;height:100%;border:0;aspect-ratio:auto;container-type:size}.folio{bottom:18cqw;font-size:2.35cqw}.v2-photo .raw-photo{background:var(--tile)}.v2-phone .post-photo{height:22cqw;background:var(--cream);padding:1cqw}.v2-phone .post-photo img{position:static;width:100%;height:100%;object-fit:contain;max-width:100%}.field{color:var(--ink)}.field span,.chatmeta,.sender,.post-stamp{opacity:1;color:#625B4B}.v2-phone .statusbar,.v2-phone .chatinput,.v2-phone .post-stamp{opacity:1;color:#625B4B}.v2-phone .post-link,.v2-phone .back{color:#1D6698}.v2-phone .phone{width:55.5cqw;height:99cqw;left:12.6cqw;top:28cqw}.v2-phone .island{left:calc(50% - 10cqw);width:20cqw}.v2-phone .homebar{left:calc(50% - 12cqw)}.v2-phone .headline.long{font-size:7.2cqw;line-height:1.0}
'''
motion=[
"tl.fromTo('.headline',{y:38,opacity:0},{y:0,opacity:1,duration:.42},.06);",
"""tl.fromTo('.headline',{y:24,opacity:0},{y:0,opacity:1,duration:.42},.06);
tl.fromTo('.panel',{y:60,opacity:0},{y:0,opacity:1,duration:.65},.04);
tl.fromTo('.field',{x:22,opacity:0},{x:0,opacity:1,duration:.4,stagger:.58},1.0);
tl.fromTo('.button',{opacity:0},{opacity:1,duration:.35},3.6);
tl.to('.button',{scale:.96,duration:.12,ease:'power2.inOut'},4.25);
tl.to('.button',{scale:1,duration:.18},4.37);
tl.to('.panel',{y:-45,opacity:0,duration:.35,ease:'power2.in'},5.62);""",
"""tl.fromTo('.headline',{y:24,opacity:0},{y:0,opacity:1,duration:.42},.06);
tl.fromTo('.public-window,.public-cta',{y:52,opacity:0},{y:0,opacity:1,duration:.65},.06);
tl.to('.public-cta',{scale:.975,duration:.12,ease:'power2.inOut'},3.7);
tl.to('.public-cta',{scale:1,duration:.2},3.83);
tl.to('.public-window,.public-cta',{x:-65,opacity:0,duration:.45,ease:'power2.in'},4.55);""",
"""tl.fromTo('.headline',{y:24,opacity:0},{y:0,opacity:1,duration:.42},.06);
tl.fromTo('.phone',{x:65,opacity:0},{x:0,opacity:1,duration:.55},0);
tl.fromTo('.post',{y:65,opacity:0},{y:0,opacity:1,duration:.55},1.1);
tl.fromTo('.post-title,.post-price,.post-spec,.post-link',{opacity:0,y:14},{opacity:1,y:0,duration:.3,stagger:.45},1.5);""",
"""tl.fromTo('.headline',{y:24,opacity:0},{y:0,opacity:1,duration:.42},.06);
tl.fromTo('.chatnav',{opacity:0},{opacity:1,duration:.35},0);
tl.fromTo('.lead-bubble',{y:80,opacity:0},{y:0,opacity:1,duration:.5},1.2);
tl.fromTo('.lead-title,.lead-car,.sender,.buyer-message,.post-stamp',{y:10,opacity:0},{y:0,opacity:1,duration:.3,stagger:.48},1.55);
tl.to('.phone',{y:-40,opacity:0,duration:.35,ease:'power2.in'},5.65);""",
"""tl.fromTo('.headline',{y:24,opacity:0},{y:0,opacity:1,duration:.42},.06);
tl.fromTo('.brand',{y:24,opacity:0},{y:0,opacity:1,duration:.4},.02);
tl.fromTo('.button',{y:24,opacity:0},{y:0,opacity:1,duration:.45},2.0);"""
]
initials=['.headline','.headline,.panel,.field,.button','.headline,.public-window,.public-cta','.headline,.phone,.post,.post-title,.post-price,.post-spec,.post-link','.headline,.chatnav,.lead-bubble,.lead-title,.lead-car,.sender,.buyer-message,.post-stamp','.headline,.brand,.button']
for i,a in enumerate(articles,1):
 id=f'scene-{i:02}';f=a.split('<div class="caption">')[0].replace('<article>','');f=f.replace(f'id="frame-{i:02}"',f'id="{id}-view"')
 f=f.replace('../autoflow-reels/assets/mobile-camry.png','assets/images/public-camry.png')
 if i==1:f=re.sub(r'<div class="raw-photo">.*?</div>','<div class="raw-photo" id="source-photo-slot"></div>',f)
 if i==2:f=re.sub(r'<div class="photo"><img[^>]+></div>','<div class="photo" id="editor-photo-slot"></div>',f)
 if i==3:f=f.replace('<img src=', '<img data-layout-allow-overflow src=')
 if i==4:f=f.replace('assets/images/public-camry.png','assets/images/camry-original-01.jpeg')
 css=style.replace('../autoflow-reels/assets/fonts/','assets/fonts/')+production+f'\n#{id}{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}}{initials[i-1]}{{opacity:0}}'
 script="const tl=gsap.timeline({paused:true,defaults:{ease:'power3.out'}});\n"+motion[i-1]+f"\nwindow.__timelines['{id}']=tl;"
 html=f'<!doctype html><html lang="uk"><body><template id="{id}-template"><style>{css}</style><div id="{id}" data-composition-id="{id}" data-width="1080" data-height="1920" data-duration="{dur[i-1]}">{f}</div><script>{script}</script></template></body></html>'
 (dest/f'{id}.html').write_text(html)
print('Written',len(list(dest.glob('*.html'))),'scene templates with local timelines')
