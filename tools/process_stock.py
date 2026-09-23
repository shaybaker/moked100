"""Turns stock clips into security-camera footage for the game.

Each entry in CLIPS is downloaded (free Mixkit / Pexels licenses, see
CREDITS.md), trimmed, converted to 16:9, desaturated a little, given a CCTV
overlay (camera label, running timestamp, REC dot) and saved as
src/assets/video/<id>.mp4 plus a poster image <id>.jpg.

To swap a clip for your own footage, drop a file at tools/_work/<id>.mp4
(any size, any length) and re-run: local files are never re-downloaded.

    python3 tools/process_stock.py            # all clips
    python3 tools/process_stock.py cat_tree   # one clip
"""
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
WORK = os.path.join(os.path.dirname(__file__), "_work")
OUT = os.path.join(ROOT, "src", "assets", "video")
W, H = 960, 540
DATE = "23/09/2026"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# first monospace font that exists on this machine (Linux, macOS, Windows)
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
    "/Library/Fonts/Courier New Bold.ttf",
    "C:/Windows/Fonts/consolab.ttf",
    "C:/Windows/Fonts/courbd.ttf",
]


def find_font():
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    raise SystemExit("no monospace font found, add one to FONT_CANDIDATES")


def mixkit(clip_id):
    return f"https://assets.mixkit.co/videos/{clip_id}/{clip_id}-720.mp4"


# id: (url, start_seconds, length_seconds, camera label, clock start, vertical?)
CLIPS = {
    # --- original seven ---
    "home_burglary":  (mixkit(31372), 2, 12, "CAM 01  REHOV HAGEFEN 12", "02:32:10", False),
    "shop_breakin":   (mixkit(31380), 1, 12, "CAM 03  KENYON HASHUK", "01:14:52", False),
    "car_breakin":    (mixkit(31363), 0, 12, "CAM 05  HANYON MERKAZI", "23:41:05", False),
    "bag_snatch":     (mixkit(31359), 0, 7.5, "CAM 06  REHOV HERZL", "18:05:33", False),
    "lost_child":     ("https://videos.pexels.com/video-files/19735477/19735477-uhd_1440_2560_30fps.mp4", 0, 12, "CAM 08  PARK HAIR", "16:20:47", True),
    "cat_tree":       ("https://videos.pexels.com/video-files/34285395/14525591_1450_1440_30fps.mp4", 2, 12, "CAM 10  GINAT HAPRAHIM", "10:12:09", True),
    "red_light":      (mixkit(4272), 6, 12, "CAM 07  TSOMET HAATSMAUT", "08:47:21", False),
    # --- added in v1.1 ---
    "pickpocket":     (mixkit(31354), 0, 7, "CAM 03  KENYON HASHUK  K2", "12:40:18", False),
    "phone_snatch":   (mixkit(31395), 0, 10.5, "CAM 11  TAHANA MERKAZIT", "17:22:41", False),
    "window_smash":   (mixkit(20864), 0, 6, "CAM 05  HANYON MERKAZI  K1", "00:15:37", False),
    "prowler":        (mixkit(31379), 0, 12, "CAM 01  REHOV HAGEFEN 8", "23:58:02", False),
    "tire_thief":     (mixkit(31366), 0, 12, "CAM 06  REHOV HERZL 40", "21:05:14", False),
    "hotel_burglar":  (mixkit(12830), 1, 12, "CAM 02  MALON HAIR  FL3", "03:12:45", False),
    "field_fire":     (mixkit(11028), 3, 12, "CAM 08  PARK HAIR  HURSHA", "14:37:09", False),
    "warehouse_fire": (mixkit(22587), 2, 12, "CAM 12  EZOR TAASIYA", "22:48:30", False),
    "tree_on_car":    (mixkit(26452), 2, 12, "CAM 01  REHOV HAGEFEN 20", "07:15:52", False),
    "suspicious_bag": (mixkit(21959), 0, 12, "CAM 09  TAHANAT RAKEVET", "09:31:26", False),
    "lost_dog":       (mixkit(33018), 0, 9.5, "CAM 10  GINAT HAPRAHIM", "11:05:33", False),
    "kid_on_road":    (mixkit(38438), 0, 12, "CAM 06  REHOV HERZL", "15:48:10", False),
    "speeding_moto":  (mixkit(39913), 0, 12, "CAM 04  KVISH MAHIR  KM 12", "13:20:55", False),
    "car_accident":   (mixkit(49234), 2, 12, "CAM 04  KVISH MAHIR  KM 9", "08:02:17", False),
    "tunnel_rescue":  (mixkit(47109), 0, 12, "CAM 04  KVISH MAHIR  MINHARA", "20:33:48", False),
    "missing_hiker":  (mixkit(21425), 0, 12, "CAM 08  PARK HAIR  HURSHA", "17:55:03", False),
}


def fetch(cid, url):
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, f"{cid}.mp4")
    if os.path.exists(path) and os.path.getsize(path) > 100_000:
        return path
    print("downloading", cid)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as r, open(path, "wb") as f:
        f.write(r.read())
    return path


def ff_escape(path):
    """Escapes a path for use inside an ffmpeg filter option."""
    return path.replace("\\", "/").replace(":", "\\:").replace(" ", "\\ ")


def process(cid):
    url, start, length, label, clock, vertical = CLIPS[cid]
    src = fetch(cid, url)
    font = ff_escape(find_font())
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"{cid}.mp4")
    if vertical:
        # blurred copy fills the frame, the sharp clip sits in the middle
        fit = (f"split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
               f"gblur=sigma=30,eq=brightness=-0.15[bg];"
               f"[b]scale=-2:{H}[fg];[bg][fg]overlay=(W-w)/2:0")
    else:
        fit = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    hh, mm, ss = (int(x) for x in clock.split(":"))
    base = hh * 3600 + mm * 60 + ss
    clock_expr = (f"%{{eif\\:mod(({base}+t)/3600\\,24)\\:d\\:2}}\\:"
                  f"%{{eif\\:mod(({base}+t)/60\\,60)\\:d\\:2}}\\:"
                  f"%{{eif\\:mod({base}+t\\,60)\\:d\\:2}}")
    vf = (
        f"{fit},"
        "eq=saturation=0.55:contrast=1.08,"
        "noise=alls=8:allf=t,"
        f"drawbox=x=0:y=0:w=iw:h=44:color=black@0.45:t=fill,"
        f"drawtext=fontfile={font}:text='{label}':x=18:y=12:fontsize=22:fontcolor=white,"
        f"drawtext=fontfile={font}:text='{DATE}  {clock_expr}':x=w-tw-18:y=12:fontsize=22:fontcolor=white,"
        f"drawtext=fontfile={font}:text='REC':x=18:y=h-38:fontsize=22:fontcolor=red:enable='lt(mod(t\\,1)\\,0.6)',"
        "drawbox=x=0:y=ih-4:w=iw:h=4:color=black@0.6:t=fill"
    )
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-t", str(length), "-i", src,
           "-vf", vf, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "26",
           "-movflags", "+faststart", "-r", "25", out]
    subprocess.run(cmd, check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(length * 0.5), "-i", out, "-frames:v", "1",
                    "-vf", "scale=480:-1", os.path.join(OUT, f"{cid}.jpg")], check=True)
    print("done", cid, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(CLIPS)
    for cid in wanted:
        process(cid)
