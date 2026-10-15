"""Build an audio-only preview change while copying approved video packets."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,subprocess

PROJECT=Path(__file__).parent/'animation'
SOURCE_OFFSET=9.50495

class AudioTags(HTMLParser):
    def __init__(self):
        super().__init__(); self.tracks=[]
    def handle_starttag(self,tag,attrs):
        if tag=='audio': self.tracks.append(dict(attrs))

def run(args):
    subprocess.run(args,check=True,capture_output=True,text=True)

cut=PROJECT/'assets/audio/funk/funkorama-30s.wav'
run(['ffmpeg','-v','error','-ss',str(SOURCE_OFFSET),'-i',str(PROJECT/'assets/audio/funk/Funkorama-original.mp3'),'-t','30','-ar','48000','-ac','2','-c:a','pcm_s16le',str(cut)])
index=PROJECT/'index.html'
source=index.read_text()
source=source.replace('src="assets/audio/music.m4a"','src="assets/audio/funk/funkorama-30s.wav"',1)
index.write_text(source)
parser=AudioTags();parser.feed(source)
inputs=[];filters=[];labels=[]
for number,track in enumerate(parser.tracks):
    inputs+=['-i',str(PROJECT/track['src'])]
    duration=float(track['data-duration']);start=float(track['data-start']);gain=float(track['data-volume'])
    chain=f'[{number}:a]atrim=0:{duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={gain}'
    if track['id']=='music':
        envelope=json.loads(track['data-automation'])['lanes'][0]['points']
        assert envelope==[{'t':0,'v':0},{'t':0.5,'v':0.68},{'t':28.4,'v':0.68},{'t':30,'v':0}]
        assert gain==0.68
        chain+=',afade=t=in:st=0:d=0.5,afade=t=out:st=28.4:d=1.6'
    if start:chain+=f',adelay={round(start*1000)}|{round(start*1000)}'
    label=f'a{number}';labels.append(f'[{label}]');filters.append(chain+f'[{label}]')
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0:duration=longest[mix]')
out=PROJECT/'renders/funk-preview';out.mkdir(exist_ok=True)
(out/'mix-filter.txt').write_text(';\n'.join(filters))
run(['ffmpeg','-v','error',*inputs,'-filter_complex',';'.join(filters),'-map','[mix]','-t','30','-c:a','pcm_s24le',str(out/'funk-sfx-mix.wav')])
credit='Funkorama — Kevin MacLeod (incompetech.com). Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Excerpt, trim, gain and fades applied.'
preview=PROJECT/'renders/autoflow-promo-funk-preview.mp4'
run(['ffmpeg','-v','error','-i',str(PROJECT/'renders/autoflow-promo-final.mp4'),'-i',str(out/'funk-sfx-mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','30','-movflags','+faststart','-metadata','comment='+credit,str(preview)])
(out/'mix-ledger.json').write_text(json.dumps({'status':'preview-awaiting-track-approval','music_title':'Funkorama','artist':'Kevin MacLeod','bpm':101,'source_offset_seconds':SOURCE_OFFSET,'duration_seconds':30,'gain':0.68,'fade_in_seconds':0.5,'fade_out_start':28.4,'fade_out_seconds':1.6,'source_url':'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funkorama.mp3','track_page':'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100474','license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','attribution':credit,'live_music_path':'assets/audio/funk/funkorama-30s.wav','live_envelope':'existing data-automation owns fade/gain; raw WAV has no fades/gain','narration':False,'video':'copied compressed stream from preserved original final','sfx_tracks':[{k:v for k,v in t.items() if k!='data-hf-id'} for t in parser.tracks if t['id']!='music']},ensure_ascii=False,indent=2))
(out/'PUBLICATION-CREDIT.txt').write_text(credit+'\n')
print(preview,preview.stat().st_size)
