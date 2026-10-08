"""Deterministic SFX/music mixdown for the reel, timed to the frame timelines.

Cue times mirror the GSAP timelines in compositions/frames/*.html
(Frame 2 starts at 2.5s, Frame 3 at 15.5s on the master timeline).
"""
import subprocess
import sys

FRAME2, FRAME3 = 2.5, 15.5
DURATION = 20.0
SFX = "assets/sfx/"

LEFT_ARRIVALS = [0.25, 0.6, 1.1, 1.55, 2.0, 2.45, 2.9, 3.35, 3.8, 4.0, 4.25, 4.5, 4.75,
                 5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8, 7.0, 7.2, 7.38, 7.56, 7.74, 8.75]


def cue(file, at, volume, pan=0.0, trim=None, fade_out=None):
    return {"file": SFX + file, "at": at, "volume": volume, "pan": pan, "trim": trim, "fade_out": fade_out}


def build_cues():
    pings = [cue("message-notification-pop.mp3", FRAME2 + t, 0.30 + 0.25 * i / len(LEFT_ARRIVALS), pan=-0.55)
             for i, t in enumerate(LEFT_ARRIVALS)]
    return pings + [
        cue("soft-whoosh.mp3", 1.30, 0.35),                                   # phones rise
        cue("phone-vibration-buzz.mp3", FRAME2 + 5.0, 0.22, pan=-0.6, trim=3.2, fade_out=0.5),
        cue("deep-impact-hit.mp3", FRAME2 + 7.95, 0.30, pan=-0.4),            # left phone shakes
        cue("phone-screen-tap.mp3", FRAME2 + 1.4, 0.35, pan=0.5),             # link bubble sent
        cue("phone-screen-tap.mp3", FRAME2 + 4.0, 0.7, pan=0.55),             # tap 0: link
        cue("soft-whoosh.mp3", FRAME2 + 4.3, 0.22, pan=0.5),
        cue("phone-screen-tap.mp3", FRAME2 + 5.9, 0.7, pan=0.55),             # tap 1: Toyota
        cue("phone-screen-tap.mp3", FRAME2 + 7.45, 0.7, pan=0.55),            # tap 2: Camry
        cue("soft-whoosh.mp3", FRAME2 + 7.7, 0.22, pan=0.5),
        cue("keyboard-typing-phone.mp3", FRAME2 + 10.0, 0.30, pan=0.5, trim=0.68, fade_out=0.1),
        cue("success-chime.mp3", FRAME2 + 10.7, 0.45, pan=0.35),              # "Беру"
        cue("soft-whoosh.mp3", FRAME3 - 0.1, 0.30),                           # to the close
        cue("deep-impact-hit.mp3", FRAME3 + 1.2, 0.45),                       # "1 посилання"
        cue("phone-screen-tap.mp3", FRAME3 + 3.3, 0.6),                       # CTA press
    ]


def cue_filter(index, c):
    chain = []
    if c["trim"]:
        chain.append(f"atrim=0:{c['trim']}")
    if c["fade_out"]:
        start = (c["trim"] or 0) - c["fade_out"]
        chain.append(f"afade=t=out:st={max(start, 0):.3f}:d={c['fade_out']}")
    left, right = (1 - max(c["pan"], 0)), (1 + min(c["pan"], 0))
    chain += [f"volume={c['volume']:.3f}", "aformat=channel_layouts=stereo",
              f"pan=stereo|c0={left:.2f}*c0|c1={right:.2f}*c1",
              f"adelay={int(c['at'] * 1000)}:all=1"]
    return f"[{index}:a]{','.join(chain)}[s{index}]"


def run(with_music, out):
    cues = build_cues()
    inputs = sum((["-i", c["file"]] for c in cues), [])
    graph = [cue_filter(i + 1, c).replace(f"[s{i + 1}]", f"[s{i}]") for i, c in enumerate(cues)]
    labels = "".join(f"[s{i}]" for i in range(len(cues)))
    if with_music:
        m = len(cues) + 1  # input 0 is the video
        inputs += ["-ss", "2.0", "-i", "assets/bgm/track.mp3"]
        graph.append(f"[{m}:a]atrim=0:{DURATION},volume=0.28,afade=t=in:d=0.4,"
                     f"afade=t=out:st={DURATION - 1.5}:d=1.5,aformat=channel_layouts=stereo[music]")
        labels += "[music]"
    count = len(cues) + (1 if with_music else 0)
    graph.append(f"{labels}amix=inputs={count}:normalize=0,apad,atrim=0:{DURATION},"
                 f"loudnorm=I={-14 if with_music else -16}:TP=-1.5:LRA=11,aresample=48000[mix]")
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", "renders/video.mp4", *inputs,
           "-filter_complex", ";".join(graph), "-map", "0:v", "-map", "[mix]",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(DURATION), out]
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "both"
    if mode in ("sfx", "both"):
        run(False, "renders/video-sfx.mp4")
    if mode in ("music", "both"):
        run(True, "renders/video-music.mp4")
