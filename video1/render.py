"""情景短视频1 —— 地下体育馆工地（Q版，16:9，1920x1080@25fps）
用法: python3 render.py <语音wav目录> <输出mp4>
"""
import sys, json, math, random, subprocess, os
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter

VOICE_DIR, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
OW, OH, FPS = 1920, 1080, 25
BW, BH = 2400, 1350          # 背景（世界）尺寸
SR = 44100
random.seed(7)

def font(sz): return ImageFont.truetype(FONT, sz)

# ------------------------------------------------------------------ 时间线
LINES = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
INTRO = 3.0
GAP = 0.45
t = INTRO
for i, ln in enumerate(LINES):
    a, sr = sf.read(f'{VOICE_DIR}/line{i}.wav', dtype='float32')
    if sr != SR:
        a = np.interp(np.arange(0, len(a), sr / SR), np.arange(len(a)), a).astype(np.float32)
    ln['audio'] = a
    ln['dur'] = len(a) / SR
    if i > 0:
        t += GAP + (0.35 if ln['who'] != LINES[i-1]['who'] else 0)
    ln['t0'] = t
    t += ln['dur']
    ln['t1'] = t
END_CARD = 4.0
T_TOTAL = t + 0.8 + END_CARD
END_T0 = t + 0.8
NF = int(T_TOTAL * FPS)

# 口型：按帧计算音量包络
def envelope(who):
    env = np.zeros(NF)
    for ln in LINES:
        if ln['who'] != who: continue
        a = ln['audio']
        for f in range(NF):
            tt = f / FPS - ln['t0']
            if 0 <= tt < ln['dur']:
                s = int(tt * SR); w = a[s:s + SR // FPS]
                if len(w): env[f] = math.sqrt(float((w ** 2).mean()))
    return env
ENV = {w: envelope(w) for w in ('jia', 'yi', 'wang')}
for w in ENV:
    m = ENV[w].max()
    if m > 0: ENV[w] /= m

def speaking(who, tt):
    return any(ln['who'] == who and ln['t0'] <= tt <= ln['t1'] for ln in LINES)

# ------------------------------------------------------------------ 工具
def ease(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def rrect(d, box, r, **kw): d.rounded_rectangle(box, r, **kw)

def lerp(a, b, k): return a + (b - a) * k

def mix(c1, c2, k): return tuple(int(lerp(a, b, k)) for a, b in zip(c1, c2))

# ------------------------------------------------------------------ 背景
def make_background():
    S = 1  # 直接绘制在 2400x1350
    img = Image.new('RGB', (BW, BH), (70, 72, 80))
    d = ImageDraw.Draw(img, 'RGBA')
    # 后墙（混凝土）
    for y in range(0, 860):
        c = mix((96, 100, 110), (138, 140, 146), y / 860)
        d.line([(0, y), (BW, y)], fill=c)
    # 墙板缝 + 模板孔
    for x in range(0, BW, 300):
        d.line([(x, 240), (x, 860)], fill=(110, 112, 118), width=4)
    for y in (420, 640):
        d.line([(0, y), (BW, y)], fill=(112, 114, 120), width=3)
    for x in range(150, BW, 300):
        for y in (330, 530, 750):
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(100, 102, 108))
    # 天花板 + 梁
    d.rectangle([0, 0, BW, 240], fill=(62, 64, 72))
    for x in range(-100, BW + 200, 480):
        d.polygon([(x, 0), (x + 120, 0), (x + 100, 240), (x + 20, 240)], fill=(78, 80, 88))
    d.rectangle([0, 200, BW, 250], fill=(84, 86, 94))
    # 通风管道
    rrect(d, [0, 95, BW, 165], 30, fill=(160, 168, 176))
    for x in range(60, BW, 220):
        d.rectangle([x, 92, x + 16, 168], fill=(140, 148, 156))
    # 墙上横幅
    rrect(d, [700, 290, 1700, 420], 18, fill=(196, 40, 40))
    rrect(d, [712, 302, 1688, 408], 12, outline=(255, 214, 90), width=4)
    f = font(78)
    txt = '地下体育馆建设工地'
    w = d.textlength(txt, font=f)
    d.text(((2400 - w) / 2, 314), txt, font=f, fill=(255, 240, 200))
    # 安全标语牌
    for (x, s, col) in [(160, '安全第一', (30, 120, 60)), (1980, '质量为本', (30, 90, 160))]:
        rrect(d, [x, 470, x + 260, 560], 10, fill=col)
        d.text((x + 30, 485), s, font=font(52), fill='white')
    # 进度看板
    rrect(d, [1980, 600, 2300, 820], 12, fill=(240, 240, 232), outline=(80, 80, 80), width=5)
    d.text((2020, 615), '球场施工进度', font=font(38), fill=(40, 40, 40))
    rrect(d, [2010, 690, 2270, 730], 8, fill=(200, 200, 200))
    rrect(d, [2010, 690, 2010 + 260 / 3, 730], 8, fill=(240, 120, 40))
    d.text((2010, 745), '已完成 1/3', font=font(34), fill=(200, 80, 20))
    # 柱子
    for x in (560, 1840):
        d.rectangle([x - 60, 240, x + 60, 880], fill=(150, 152, 158))
        d.rectangle([x - 60, 240, x - 40, 880], fill=(170, 172, 178))
        d.rectangle([x + 40, 240, x + 60, 880], fill=(120, 122, 128))
        # 黄黑警示条
        for k in range(0, 120, 30):
            d.polygon([(x - 60 + k, 800), (x - 60 + k + 15, 800), (x - 60 + k + 35, 840), (x - 60 + k + 20, 840)], fill=(30, 30, 30))
        d.rectangle([x - 60, 800, x + 60, 840], outline=(240, 200, 40), width=0)
    # 地面
    for y in range(860, BH):
        c = mix((150, 146, 138), (120, 116, 108), (y - 860) / (BH - 860))
        d.line([(0, y), (BW, y)], fill=c)
    d.line([(0, 860), (BW, 860)], fill=(90, 90, 96), width=6)
    # 球场（透视梯形），左 1/3 已铺好
    tl, tr, br, bl = (420, 900), (1980, 900), (2340, 1320), (60, 1320)
    def pt(u, v):  # u: 0..1 左->右, v: 0..1 远->近
        x0 = lerp(tl[0], bl[0], v); x1 = lerp(tr[0], br[0], v)
        return (lerp(x0, x1, u), lerp(tl[1], bl[1], v))
    d.polygon([tl, tr, br, bl], fill=(128, 124, 116))
    # 钢筋网（未完成区）
    for k in range(1, 24):
        u = k / 24
        if u > 1 / 3: d.line([pt(u, 0), pt(u, 1)], fill=(110, 92, 78), width=3)
    for k in range(1, 9):
        v = k / 9
        d.line([pt(1 / 3, v), pt(1, v)], fill=(110, 92, 78), width=3)
    # 已完成部分：蓝色塑胶面 + 白线
    d.polygon([pt(0, 0), pt(1 / 3, 0), pt(1 / 3, 1), pt(0, 1)], fill=(52, 120, 190))
    lw = 6
    d.line([pt(0.02, 0.06), pt(1 / 3, 0.06)], fill='white', width=lw)
    d.line([pt(0.02, 0.94), pt(1 / 3, 0.94)], fill='white', width=lw)
    d.line([pt(0.02, 0.06), pt(0.02, 0.94)], fill='white', width=lw)
    # 三分线弧
    arc = [pt(0.02 + 0.13 * math.sin(a), 0.5 + 0.42 * math.cos(a)) for a in np.linspace(0, math.pi, 30)]
    d.line(arc, fill='white', width=lw)
    d.polygon([pt(0.02, 0.35), pt(0.09, 0.35), pt(0.09, 0.65), pt(0.02, 0.65)], outline='white', width=lw)
    # 分界：黄色施工带
    d.line([pt(1 / 3, 0), pt(1 / 3, 1)], fill=(250, 200, 40), width=10)
    # 篮球架（左）
    bx, by = 520, 860
    d.rectangle([bx - 12, 600, bx + 12, by + 60], fill=(220, 90, 40))
    d.line([(bx, 640), (bx + 110, 640)], fill=(220, 90, 40), width=18)
    rrect(d, [bx + 100, 540, bx + 130, 700], 6, fill=(240, 240, 245), outline=(60, 60, 60), width=3)
    d.ellipse([bx + 120, 660, bx + 210, 690], outline=(240, 90, 30), width=7)
    # 脚手架（右侧后方）
    sx = 2050
    for x in (sx, sx + 140, sx + 280):
        d.line([(x, 260), (x, 900)], fill=(200, 150, 50), width=12)
    for y in range(300, 900, 140):
        d.line([(sx, y), (sx + 280, y)], fill=(200, 150, 50), width=10)
        d.rectangle([sx - 10, y - 18, sx + 290, y - 4], fill=(150, 110, 60))
    # 道具：砖堆、水泥袋、沙堆、锥桶、推车
    for r in range(4):
        for c in range(5 - r):
            x = 1700 + c * 64 + r * 32; y = 1020 - r * 30
            d.rectangle([x, y, x + 60, y + 28], fill=(180, 80, 60), outline=(120, 50, 40), width=3)
    for k in range(3):
        rrect(d, [2160 + k * 20, 1000 - k * 46, 2320 + k * 20, 1050 - k * 46], 16, fill=(222, 214, 196), outline=(160, 150, 130), width=3)
        d.text((2205 + k * 20, 1008 - k * 46), '水泥', font=font(28), fill=(120, 110, 90))
    d.pieslice([40, 960, 400, 1240], 180, 360, fill=(212, 180, 120))
    for x, y in [(330, 1210), (2120, 1200), (1500, 1250)]:
        d.polygon([(x, y - 110), (x - 40, y), (x + 40, y)], fill=(250, 110, 30))
        d.polygon([(x - 18, y - 60), (x + 18, y - 60), (x + 26, y - 38), (x - 26, y - 38)], fill='white')
        rrect(d, [x - 52, y - 10, x + 52, y + 8], 4, fill=(240, 100, 30))
    # 吊灯 + 光锥
    glow = Image.new('RGBA', (BW, BH), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for x in (380, 1200, 2020):
        gd.polygon([(x - 40, 300), (x + 40, 300), (x + 420, 1300), (x - 420, 1300)], fill=(255, 236, 170, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    img.paste(glow, (0, 0), glow)
    d = ImageDraw.Draw(img, 'RGBA')
    for x in (380, 1200, 2020):
        d.line([(x, 165), (x, 270)], fill=(40, 40, 40), width=6)
        d.pieslice([x - 70, 240, x + 70, 340], 180, 360, fill=(60, 64, 70))
        d.ellipse([x - 40, 280, x + 40, 310], fill=(255, 246, 200))
    # 暗角
    vig = Image.new('L', (BW, BH), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-500, -400, BW + 500, BH + 400], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(200))
    dark = Image.new('RGB', (BW, BH), (20, 20, 30))
    img = Image.composite(img, dark, vig)
    return img

# ------------------------------------------------------------------ Q版角色
SKIN = (255, 222, 196)
OUTL = (60, 40, 40)
CHAR = {
    'jia':  dict(hat=(230, 50, 50), mark='甲', top=(250, 130, 30), pants=(60, 80, 120), hair=(40, 30, 30), glasses=False, role='甲队队长'),
    'yi':   dict(hat=(40, 120, 220), mark='乙', top=(60, 170, 110), pants=(70, 70, 90), hair=(70, 45, 30), glasses=False, role='乙队队长'),
    'wang': dict(hat=(250, 250, 250), mark='王', top=(70, 110, 170), pants=(50, 55, 70), hair=(30, 30, 35), glasses=True, role='项目负责人'),
}
CW, CH = 440, 640   # 角色贴图最终尺寸
_cache = {}

def draw_char(who, mouth, blink, look, arm_l, arm_r, holding=False):
    """mouth 0..1 张嘴程度(量化); look: -1左 0前 1右; arm_* 角度(度)，0=下垂。"""
    key = (who, mouth, blink, look, arm_l, arm_r, holding)
    if key in _cache: return _cache[key]
    c = CHAR[who]
    S = 2
    im = Image.new('RGBA', (CW * S, CH * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def P(x, y): return (x * S, y * S)
    def B(x0, y0, x1, y1): return [x0 * S, y0 * S, x1 * S, y1 * S]
    lw = 5 * S
    cx = CW / 2
    # 影子
    d.ellipse(B(cx - 120, 610, cx + 120, 636), fill=(0, 0, 0, 70))
    # 腿 + 鞋
    for sx in (-1, 1):
        x = cx + sx * 42
        rrect(d, B(x - 30, 500, x + 30, 600), 18 * S, fill=c['pants'], outline=OUTL, width=lw)
        rrect(d, B(x - 40 + sx * 6, 585, x + 40 + sx * 6, 620), 16 * S, fill=(70, 50, 40), outline=OUTL, width=lw)
    # 手臂（先画后侧）
    def arm(side, ang):
        sx = cx + side * 92; sy = 400
        a = math.radians(ang)
        L = 105
        ex = sx + side * math.sin(a) * L
        ey = sy + math.cos(a) * L
        d.line([P(sx, sy), P(ex, ey)], fill=OUTL, width=46 * S)
        d.line([P(sx, sy), P(ex, ey)], fill=c['top'], width=36 * S)
        d.ellipse(B(sx - 18, sy - 18, sx + 18, sy + 18), fill=c['top'])
        d.ellipse(B(ex - 24, ey - 24, ex + 24, ey + 24), fill=SKIN, outline=OUTL, width=lw)
        return ex, ey
    hl = arm(-1, arm_l)
    hr = arm(1, arm_r)
    # 身体
    rrect(d, B(cx - 105, 370, cx + 105, 530), 50 * S, fill=c['top'], outline=OUTL, width=lw)
    if who in ('jia', 'yi'):
        # 反光条
        for y in (430, 470):
            d.rectangle(B(cx - 100, y, cx + 100, y + 14), fill=(250, 245, 120))
        # 队长袖标
        rrect(d, B(cx - 50, 390, cx + 50, 420), 8 * S, fill=(255, 255, 255), outline=OUTL, width=3 * S)
        f = font(22 * S)
        d.text(P(cx - 23, 391), '队长', font=f, fill=(200, 30, 30))
    else:
        # 衬衫领 + 领带 + 胸牌
        d.polygon([P(cx - 40, 372), P(cx, 410), P(cx + 40, 372)], fill='white', outline=OUTL)
        d.polygon([P(cx - 10, 408), P(cx + 10, 408), P(cx + 14, 470), P(cx, 488), P(cx - 14, 470)], fill=(200, 40, 50))
        rrect(d, B(cx + 30, 420, cx + 92, 460), 6 * S, fill='white', outline=OUTL, width=3 * S)
        d.text(P(cx + 37, 426), '王工', font=font(24 * S), fill=(40, 60, 140))
    # 拿图纸（王工）
    if holding:
        ex, ey = hl
        d.line([P(ex - 10, ey - 80), P(ex + 10, ey + 40)], fill=OUTL, width=34 * S)
        d.line([P(ex - 10, ey - 80), P(ex + 10, ey + 40)], fill=(150, 200, 250), width=26 * S)
        d.ellipse(B(ex - 24, ey - 24, ex + 24, ey + 24), fill=SKIN, outline=OUTL, width=lw)
    # 头
    hx, hy, hr_ = cx, 205, 165
    d.ellipse(B(hx - hr_, hy - hr_ + 10, hx + hr_, hy + hr_), fill=SKIN, outline=OUTL, width=lw)
    # 耳朵
    for sx in (-1, 1):
        d.ellipse(B(hx + sx * 160 - 22, hy + 10, hx + sx * 160 + 22, hy + 60), fill=SKIN, outline=OUTL, width=lw)
        d.ellipse(B(hx + sx * 160 - 22, hy + 10, hx + sx * 160 + 22, hy + 60), fill=SKIN)
    d.ellipse(B(hx - hr_ + 3, hy - hr_ + 13, hx + hr_ - 3, hy + hr_ - 3), fill=SKIN)
    # 头发：帽檐下的刘海 + 两侧短鬓角
    bang = [P(hx - 158, hy - 66)]
    for k in range(9):
        x = hx - 158 + k * 316 / 8
        bang.append(P(x, hy - 66))
        if k < 8: bang.append(P(x + 316 / 16, hy - 30 + (8 if k % 2 else 0)))
    bang.append(P(hx + 158, hy - 66))
    d.polygon(bang, fill=c['hair'])
    for sx in (-1, 1):
        d.polygon([P(hx + sx * 158, hy - 66), P(hx + sx * 140, hy - 66), P(hx + sx * 150, hy + 10), P(hx + sx * 162, hy - 20)], fill=c['hair'])
    # 安全帽
    hb = B(hx - 175, hy - 200, hx + 175, hy + 40)
    d.pieslice(hb, 180, 360, fill=c['hat'], outline=OUTL, width=lw)
    rrect(d, B(hx - 195, hy - 92, hx + 195, hy - 62), 15 * S, fill=c['hat'], outline=OUTL, width=lw)
    d.line([P(hx, hy - 196), P(hx, hy - 96)], fill=mix(c['hat'], (0, 0, 0), 0.18), width=16 * S)
    d.pieslice(B(hx - 140, hy - 170, hx - 60, hy - 90), 200, 290, fill=(255, 255, 255, 140))
    # 帽徽
    d.ellipse(B(hx - 38, hy - 168, hx + 38, hy - 92), fill='white', outline=OUTL, width=3 * S)
    fm = font(52 * S)
    tw = d.textlength(c['mark'], font=fm) / S
    d.text(P(hx - tw / 2, hy - 160), c['mark'], font=fm, fill=c['hat'] if who != 'wang' else (40, 60, 140))
    # 眉毛
    ex_off = look * 14
    for sx in (-1, 1):
        x = hx + sx * 70 + ex_off * 0.5
        d.line([P(x - 26, hy - 14 + (4 if sx * look > 0 else 0)), P(x + 26, hy - 18)], fill=c['hair'], width=9 * S)
    # 眼睛
    for sx in (-1, 1):
        x = hx + sx * 68 + ex_off; y = hy + 25
        if blink:
            d.arc(B(x - 28, y - 12, x + 28, y + 22), 200, 340, fill=OUTL, width=8 * S)
        else:
            d.ellipse(B(x - 26, y - 34, x + 26, y + 34), fill=(40, 30, 40))
            d.ellipse(B(x - 18, y + 4, x + 18, y + 30), fill=(90, 60, 110))
            d.ellipse(B(x - 14 + look * 4, y - 24, x + 4 + look * 4, y - 6), fill='white')
            d.ellipse(B(x + 6, y + 8, x + 14, y + 16), fill='white')
    # 眼镜
    if c['glasses']:
        for sx in (-1, 1):
            x = hx + sx * 68 + ex_off
            rrect(d, B(x - 44, hy - 14, x + 44, hy + 66), 20 * S, outline=(40, 40, 40), width=6 * S)
        d.line([P(hx - 24 + ex_off, hy + 14), P(hx + 24 + ex_off, hy + 14)], fill=(40, 40, 40), width=6 * S)
    # 腮红
    for sx in (-1, 1):
        x = hx + sx * 110 + ex_off * 0.6
        d.ellipse(B(x - 30, hy + 68, x + 30, hy + 92), fill=(255, 160, 160))
    # 嘴
    mx, my = hx + ex_off * 0.6, hy + 100
    if mouth == 0:
        d.arc(B(mx - 22, my - 16, mx + 22, my + 12), 20, 160, fill=OUTL, width=7 * S)
    else:
        h = 10 + mouth * 12
        d.ellipse(B(mx - 22 - mouth * 3, my - 8, mx + 22 + mouth * 3, my - 8 + h * 2), fill=(150, 40, 50), outline=OUTL, width=5 * S)
        d.ellipse(B(mx - 12, my - 8 + h * 1.2, mx + 12, my - 8 + h * 2 - 2), fill=(240, 120, 120))
    im = im.resize((CW, CH), Image.LANCZOS)
    _cache[key] = im
    return im

# 角色位置（世界坐标，脚底中心）
POS = {'jia': (760, 1265), 'yi': (1150, 1270), 'wang': (1640, 1255)}

def char_state(who, f):
    tt = f / FPS
    env = ENV[who][f]
    talking = speaking(who, tt)
    mouth = 0
    if talking and env > 0.12:
        mouth = 1 if env < 0.45 else 2
    # 眨眼
    period = {'jia': 3.1, 'yi': 3.7, 'wang': 4.3}[who]
    ph = (tt + {'jia': 0.4, 'yi': 1.3, 'wang': 2.2}[who]) % period
    blink = ph < 0.13
    # 视线：队长看王工；王工在开场看队长，镜头段看正前方
    wang_cam = tt >= LINES[2]['t0'] - 0.6
    if who == 'wang':
        look = 0 if wang_cam else -1
    elif who == 'jia':
        look = 1
    else:
        look = 1 if not wang_cam else 1
    arm_l = arm_r = 12
    bob = math.sin(tt * 2.2 + hash(who) % 7) * 3
    holding = who == 'wang'
    if who == 'wang':
        arm_l = 20
        # “同学们好”挥手
        l2 = LINES[2]
        if l2['t0'] - 0.3 <= tt <= l2['t0'] + 1.6:
            arm_r = 150 + 22 * math.sin((tt - l2['t0']) * 12)
        # 第二句：手指向镜头/摊手
        elif LINES[3]['t0'] <= tt <= LINES[3]['t1']:
            arm_r = 70 + 10 * math.sin(tt * 4)
        elif LINES[4]['t0'] <= tt <= LINES[4]['t1'] + 0.5:
            arm_r = 110 + 8 * math.sin(tt * 5)
    else:
        if talking:
            arm_r = 40 + 25 * abs(math.sin(tt * 3.0))  # 说话时比划
            bob += 3 * math.sin(tt * 9) * env
        if who == 'jia' and talking and tt > LINES[0]['t0'] + LINES[0]['dur'] * 0.6:
            arm_l = 160  # 举手比“三分之一”
    if talking: bob -= 4 * env
    return draw_char(who, mouth, blink, look, round(arm_l / 2) * 2, round(arm_r / 2) * 2, holding), bob

# ------------------------------------------------------------------ 镜头
def cam_at(tt):
    """返回世界坐标下的取景框 (cx, cy, zoom)。"""
    keys = [
        (0.0, (1200, 675, 1.0)),
        (INTRO - 0.4, (1200, 690, 1.06)),
        (LINES[0]['t0'], (980, 860, 1.45)),      # 甲队队长 + 王工
        (LINES[0]['t1'], (990, 860, 1.5)),
        (LINES[1]['t0'], (1300, 860, 1.45)),      # 乙队队长 + 王工
        (LINES[1]['t1'], (1310, 860, 1.5)),
        (LINES[2]['t0'] - 0.2, (1640, 940, 2.25)),  # 王工对镜头
        (LINES[4]['t1'], (1640, 950, 2.4)),
        (END_T0 + 0.3, (1200, 690, 1.06)),
        (T_TOTAL, (1200, 690, 1.06)),
    ]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t0 <= tt <= t1:
            span = t1 - t0
            # 长段：缓慢线性推镜；短段：缓动转场
            k = (tt - t0) / span if span > 2.0 else ease((tt - t0) / span)
            return tuple(lerp(x, y, k) for x, y in zip(a, b))
    return keys[-1][1]

# ------------------------------------------------------------------ 叠加层（屏幕空间）
def outline_text(d, xy, s, f, fill, stroke=(30, 30, 40), sw=6):
    d.text(xy, s, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)

NAME = {'jia': ('甲队队长', (230, 60, 50)), 'yi': ('乙队队长', (40, 120, 220)), 'wang': ('王工 · 项目负责人', (240, 150, 30))}

def wrap(s, f, maxw, d):
    """一行放得下就一行；否则在最接近中间的逗号/冒号处断开。"""
    if d.textlength(s, font=f) <= maxw: return [s]
    cuts = [i + 1 for i, ch in enumerate(s[:-1]) if ch in '，：；']
    if cuts:
        i = min(cuts, key=lambda c: abs(c - len(s) / 2))
        return [s[:i], s[i:]]
    return [s[:len(s) // 2], s[len(s) // 2:]]

def draw_subtitle(img, tt):
    d = ImageDraw.Draw(img, 'RGBA')
    for ln in LINES:
        if ln['t0'] - 0.1 <= tt <= ln['t1'] + 0.25:
            name, col = NAME[ln['who']]
            f = font(54)
            lines = wrap(ln['sub'], f, 1760, d)
            lh = 70
            y0 = OH - 70 - lh * len(lines)
            # 名牌
            fn = font(36)
            nw = d.textlength(name, font=fn)
            rrect(d, [OW / 2 - nw / 2 - 24, y0 - 62, OW / 2 + nw / 2 + 24, y0 - 8], 27, fill=col + (235,), outline=(255, 255, 255), width=4)
            d.text((OW / 2 - nw / 2, y0 - 55), name, font=fn, fill='white')
            band = Image.new('RGBA', (OW, lh * len(lines) + 40), (10, 14, 30, 120))
            img.paste(band, (0, int(y0 - 14)), band)
            d = ImageDraw.Draw(img, 'RGBA')
            rrect(d, [OW / 2 - nw / 2 - 24, y0 - 62, OW / 2 + nw / 2 + 24, y0 - 8], 27, fill=col + (235,), outline=(255, 255, 255), width=4)
            d.text((OW / 2 - nw / 2, y0 - 55), name, font=fn, fill='white')
            for i, s in enumerate(lines):
                w = d.textlength(s, font=f)
                outline_text(d, (OW / 2 - w / 2, y0 + i * lh), s, f, (255, 255, 255))
            return

def pop(k):
    """弹出缩放曲线 0..1 -> 带回弹"""
    k = max(0.0, min(1.0, k))
    return 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2

def draw_card(img, tt, t0, t1, box, render):
    if not (t0 <= tt <= t1): return
    a = min(1.0, (tt - t0) / 0.35, (t1 - tt) / 0.3)
    s = pop((tt - t0) / 0.45)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    card = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    render(ImageDraw.Draw(card), w, h)
    sw, sh = max(1, int(w * s)), max(1, int(h * s))
    card = card.resize((sw, sh), Image.LANCZOS)
    if a < 1:
        al = card.getchannel('A').point(lambda v: int(v * max(a, 0)))
        card.putalpha(al)
    img.paste(card, (int(x0 + (w - sw) / 2), int(y0 + (h - sh) / 2)), card)

def card_jia(d, w, h):
    rrect(d, [0, 0, w - 1, h - 1], 28, fill=(255, 250, 238, 240), outline=(230, 60, 50), width=6)
    d.text((30, 22), '甲队 单独施工', font=font(40), fill=(230, 60, 50))
    d.text((30, 80), '用时：1 个月', font=font(36), fill=(50, 50, 60))
    d.text((30, 130), '完成：全部工程的', font=font(36), fill=(50, 50, 60))
    # 分数 1/3
    fx = 330
    d.text((fx, 108), '1', font=font(44), fill=(230, 60, 50))
    d.line([(fx - 8, 160), (fx + 34, 160)], fill=(230, 60, 50), width=5)
    d.text((fx, 162), '3', font=font(44), fill=(230, 60, 50))
    rrect(d, [30, 230, w - 30, 270], 10, fill=(220, 220, 220))
    rrect(d, [30, 230, 30 + (w - 60) / 3, 270], 10, fill=(240, 120, 40))
    for k in (1, 2):
        x = 30 + (w - 60) * k / 3
        d.line([(x, 230), (x, 270)], fill='white', width=4)

def card_yi(d, w, h):
    rrect(d, [0, 0, w - 1, h - 1], 28, fill=(240, 248, 255, 240), outline=(40, 120, 220), width=6)
    d.text((30, 22), '乙队 刚进场', font=font(40), fill=(40, 120, 220))
    d.text((30, 80), '计划：甲 + 乙 合作', font=font(36), fill=(50, 50, 60))
    d.text((30, 130), '再干 半个月', font=font(36), fill=(50, 50, 60))
    d.text((30, 180), '→ 球场建设完工', font=font(36), fill=(30, 140, 80))
    rrect(d, [30, 240, w - 30, 280], 10, fill=(240, 120, 40))
    rrect(d, [30 + (w - 60) / 3, 240, w - 30, 280], 10, fill=(90, 160, 230))
    x = 30 + (w - 60) / 3
    d.line([(x, 240), (x, 280)], fill='white', width=4)
    d.text((x + 20, 244), '甲+乙', font=font(28), fill='white')

def draw_intro(img, tt):
    if tt > INTRO + 0.2: return
    a = min(1.0, tt / 0.4, (INTRO + 0.2 - tt) / 0.5)
    layer = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = pop(tt / 0.6)
    w, h = int(980 * s), int(300 * s)
    x0, y0 = (OW - w) // 2, 250 - h // 2 + 60
    if w > 10 and h > 10:
        rrect(d, [x0, y0, x0 + w, y0 + h], int(40 * s) + 1, fill=(255, 196, 40, 245), outline=(80, 50, 20), width=max(1, int(8 * s)))
        if s > 0.6:
            f1, f2 = font(int(96 * s)), font(int(54 * s))
            t1s, t2s = '情景短视频 1', '地下体育馆 · 施工现场'
            w1 = d.textlength(t1s, font=f1); w2 = d.textlength(t2s, font=f2)
            d.text(((OW - w1) / 2, y0 + 40 * s), t1s, font=f1, fill=(120, 40, 20), stroke_width=int(4 * s), stroke_fill='white')
            d.text(((OW - w2) / 2, y0 + 175 * s), t2s, font=f2, fill=(80, 50, 20))
    if a < 1:
        layer.putalpha(layer.getchannel('A').point(lambda v: int(v * max(a, 0))))
    img.paste(layer, (0, 0), layer)

def draw_end(img, tt):
    if tt < END_T0: return
    k = (tt - END_T0)
    a = min(1.0, k / 0.5)
    layer = Image.new('RGBA', (OW, OH), (20, 30, 60, int(150 * a)))
    d = ImageDraw.Draw(layer)
    s = pop(k / 0.6)
    w, h = int(1280 * s), int(600 * s)
    x0, y0 = (OW - w) // 2, (OH - h) // 2
    if w > 20:
        rrect(d, [x0, y0, x0 + w, y0 + h], int(48 * s) + 1, fill=(255, 252, 240, 250), outline=(255, 180, 40), width=max(1, int(10 * s)))
    if s > 0.8:
        f0 = font(70); f1 = font(52)
        t = '数学顾问团 · 请出动！'
        tw = d.textlength(t, font=f0)
        d.text(((OW - tw) / 2, y0 + 50), t, font=f0, fill=(200, 60, 30))
        qs = [('?', '哪个队的工作效率更高？', (230, 60, 50)), ('?', '后面该重点依靠哪个队？', (40, 120, 220))]
        for i, (_, q, col) in enumerate(qs):
            y = y0 + 190 + i * 110
            d.ellipse([x0 + 150, y, x0 + 230, y + 80], fill=col)
            d.text((x0 + 175, y + 6), str(i + 1), font=font(60), fill='white')
            d.text((x0 + 270, y + 10), q, font=f1, fill=(50, 50, 60))
        hint = '已知：甲队单独 1 个月完成 1/3；甲乙合作再干半个月完工'
        hw = d.textlength(hint, font=font(34))
        d.text(((OW - hw) / 2, y0 + 450), hint, font=font(34), fill=(110, 110, 120))
    img.paste(layer, (0, 0), layer)

# 灰尘粒子
DUST = [(random.uniform(0, BW), random.uniform(250, 1300), random.uniform(2, 5), random.uniform(5, 20), random.uniform(0, 6.28)) for _ in range(90)]

# ------------------------------------------------------------------ 主渲染
def render():
    bg = make_background()
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}',
                           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
                           OUT + '.video.mp4'], stdin=subprocess.PIPE)
    for f in range(NF):
        tt = f / FPS
        frame = bg.copy()
        d = ImageDraw.Draw(frame, 'RGBA')
        for (x, y, r, sp, ph) in DUST:
            yy = (y - tt * sp) % 1100 + 250
            xx = x + math.sin(tt * 0.6 + ph) * 20
            d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=(255, 245, 210, 60))
        # 按 y 排序绘制角色
        for who in sorted(POS, key=lambda w: POS[w][1]):
            sp, bob = char_state(who, f)
            px, py = POS[who]
            frame.paste(sp, (int(px - CW / 2), int(py - CH + 20 + bob)), sp)
        cx, cy, z = cam_at(tt)
        cw, ch = BW / z, BH / z
        cx = min(max(cx, cw / 2), BW - cw / 2); cy = min(max(cy, ch / 2), BH - ch / 2)
        frame = frame.resize((OW, OH), Image.BICUBIC, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
        draw_intro(frame, tt)
        draw_card(frame, tt, LINES[0]['t0'] + 1.2, LINES[0]['t1'] + 0.4, (OW - 560, 60, OW - 60, 360), card_jia)
        draw_card(frame, tt, LINES[1]['t0'] + 1.0, LINES[1]['t1'] + 0.4, (OW - 560, 60, OW - 60, 370), card_yi)
        draw_subtitle(frame, tt)
        draw_end(frame, tt)
        # 转场：开场淡入
        if tt < 0.4:
            frame = Image.blend(Image.new('RGB', (OW, OH)), frame, tt / 0.4)
        if tt > T_TOTAL - 0.5:
            frame = Image.blend(Image.new('RGB', (OW, OH)), frame, max(0, (T_TOTAL - tt) / 0.5))
        ff.stdin.write(frame.tobytes())
        if f % 100 == 0: print('frame', f, '/', NF, flush=True)
    ff.stdin.close(); ff.wait()

# ------------------------------------------------------------------ 音频：配音 + 轻快背景音乐
def make_audio():
    n = int(T_TOTAL * SR) + SR
    out = np.zeros(n, np.float32)
    for ln in LINES:
        s = int(ln['t0'] * SR)
        out[s:s + len(ln['audio'])] += ln['audio'] * 0.95
    # BGM：大调五声音阶拨弦 + 低音
    bpm = 104; beat = 60 / bpm
    tt = np.arange(n) / SR
    bgm = np.zeros(n, np.float32)
    notes = [0, 2, 4, 7, 9, 12, 14]
    root = 261.63
    prog = [0, -3, 5, 7]  # C Am F G（半音偏移，作低音根音）
    rng = random.Random(3)
    def pluck(t0, freq, dur, amp):
        s = int(t0 * SR); m = int(dur * SR)
        if s >= n: return
        m = min(m, n - s)
        x = np.arange(m) / SR
        env = np.exp(-x * 5.5) * np.minimum(1, x / 0.005)
        w = np.sin(2 * np.pi * freq * x) + 0.35 * np.sin(4 * np.pi * freq * x) + 0.12 * np.sin(6 * np.pi * freq * x)
        bgm[s:s + m] += (w * env * amp).astype(np.float32)
    b = 0
    while b * beat < T_TOTAL:
        bar = (b // 4) % 4
        if b % 4 == 0:
            pluck(b * beat, root / 2 * 2 ** (prog[bar] / 12), beat * 3.5, 0.5)
        if b % 2 == 1:
            pluck(b * beat, root / 2 * 2 ** ((prog[bar] + 7) / 12), beat * 1.5, 0.3)
        for half in (0, 0.5):
            if rng.random() < 0.75:
                pluck((b + half) * beat, root * 2 ** ((notes[rng.randrange(len(notes))] + 0) / 12), beat, 0.22)
        b += 1
    # 说话时压低 BGM（ducking）
    duck = np.ones(n, np.float32)
    for ln in LINES:
        s, e = int((ln['t0'] - 0.2) * SR), int((ln['t1'] + 0.2) * SR)
        duck[s:e] = 0.35
    k = int(0.15 * SR)
    duck = np.convolve(duck, np.ones(k) / k, mode='same').astype(np.float32)
    bgm = bgm / (np.abs(bgm).max() + 1e-9) * 0.18 * duck
    # 开场 / 结尾提示音
    def ding(t0, f):
        s = int(t0 * SR); x = np.arange(int(0.6 * SR)) / SR
        out[s:s + len(x)] += (0.25 * np.sin(2 * np.pi * f * x) * np.exp(-x * 6)).astype(np.float32)
    ding(0.2, 880); ding(0.32, 1318.5)
    ding(END_T0 + 0.1, 1046.5); ding(END_T0 + 0.25, 1568)
    out += bgm
    fade = int(0.5 * SR); end = int(T_TOTAL * SR)
    out[end - fade:end] *= np.linspace(1, 0, fade)
    out = out[:end]
    out /= max(1.0, np.abs(out).max() / 0.95)
    sf.write(OUT + '.audio.wav', out, SR)

if __name__ == '__main__':
    print('total', round(T_TOTAL, 2), 's', NF, 'frames')
    make_audio()
    render()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', OUT + '.video.mp4', '-i', OUT + '.audio.wav',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT], check=True)
    os.remove(OUT + '.video.mp4'); os.remove(OUT + '.audio.wav')
    print('done', OUT)
