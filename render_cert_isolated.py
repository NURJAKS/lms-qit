import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BACKEND_ROOT = Path("backend").resolve()
TEMPLATE_PATH = BACKEND_ROOT / "uploads" / "certificates" / "certification-template.png"
ISSUED_DIR = BACKEND_ROOT / "uploads" / "certificates" / "issued"

DESIGN_W = 1024
DESIGN_H_REF = 724
NAME_CENTER_FRAC = (0.645, 0.35)
COURSE_CENTER_FRAC = (0.57, 0.47)
DATE_RIGHT_BASELINE_FRAC = (0.84, 0.828)
NAME_PT_DESIGN = 40
COURSE_PT_DESIGN = 30
DATE_PT_DESIGN = 20
TEXT_COLOR = (255, 255, 255)

_FONT_REGULAR = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
)

def _pick_existing(paths):
    for p in paths:
        if Path(p).is_file():
            return p
    return None

def _truetype(path, size):
    if path:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()

def _text_width(draw, text, font):
    if hasattr(draw, "textlength"):
        return int(draw.textlength(text, font=font))
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]

def _wrap_lines(draw, text, font, max_width):
    words = text.split()
    if not words:
        return [text] if text else [""]
    lines = []
    current = []
    for w in words:
        trial = " ".join(current + [w])
        if _text_width(draw, trial, font) <= max_width:
            current.append(w)
        else:
            if current:
                lines.append(" ".join(current))
            if _text_width(draw, w, font) > max_width:
                lines.append(w)
                current = []
            else:
                current = [w]
    if current:
        lines.append(" ".join(current))
    return lines if lines else [text]

def _frac_xy(fx, fy, img_w, img_h):
    return (fx * img_w, fy * img_h)

def render_certificate_png(cert_id, student_name, course_title, issued_at=None):
    ISSUED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = ISSUED_DIR / f"cert_{cert_id}.png"

    name = (student_name or "").strip() or "Студент"
    course = (course_title or "").strip() or "Курс"
    when = issued_at or datetime.now(timezone.utc)
    date_str = when.strftime("%d.%m.%Y")

    img = Image.open(TEMPLATE_PATH).convert("RGBA")
    draw = ImageDraw.Draw(img)
    iw, ih = img.size

    sx = iw / DESIGN_W
    sy = ih / DESIGN_H_REF

    regular_path = _pick_existing(_FONT_REGULAR)

    max_name_w = int(iw * 0.85)
    name_size = max(18, int(round(NAME_PT_DESIGN * sx)))
    if len(name) > 20:
        name_size = max(18, name_size - 6)
    font_name = _truetype(regular_path, name_size)
    while name_size > 18 and _text_width(draw, name, font_name) > max_name_w:
        name_size -= 2
        font_name = _truetype(regular_path, name_size)

    nx, ny = _frac_xy(*NAME_CENTER_FRAC, iw, ih)
    draw.text((nx, ny), name, fill=TEXT_COLOR, font=font_name, anchor="mm")

    course_size = max(16, int(round(COURSE_PT_DESIGN * sx)))
    font_course = _truetype(regular_path, course_size)
    max_course_w = int(iw * 0.88)
    lines = []
    while course_size > 10:
        lines = _wrap_lines(draw, course, font_course, max_course_w)
        if len(lines) <= 3:
            break
        course_size -= 2
        font_course = _truetype(regular_path, course_size)
    lines = _wrap_lines(draw, course, font_course, max_course_w)

    cx, cy = _frac_xy(*COURSE_CENTER_FRAC, iw, ih)
    line_gap = max(4, int(round(8 * sy)))
    if len(lines) == 1:
        draw.text((cx, cy), lines[0], fill=TEXT_COLOR, font=font_course, anchor="mm")
    else:
        heights = []
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font_course)
            heights.append(bbox[3] - bbox[1])
        total_h = sum(heights) + line_gap * max(0, len(lines) - 1)
        y_top = cy - total_h / 2
        for line, h in zip(lines, heights):
            draw.text((cx, y_top + h / 2), line, fill=TEXT_COLOR, font=font_course, anchor="mm")
            y_top += h + line_gap

    date_size = max(14, int(round(DATE_PT_DESIGN * sx)))
    font_date = _truetype(regular_path, date_size)
    dx, dy = _frac_xy(*DATE_RIGHT_BASELINE_FRAC, iw, ih)
    tw = _text_width(draw, date_str, font_date)
    pad = max(8, date_size // 2)
    dx = float(min(max(dx, pad + tw), iw - pad))
    dy = float(min(max(dy, pad), ih - pad))
    draw.text((dx, dy), date_str, fill=TEXT_COLOR, font=font_date, anchor="rs")

    img.convert("RGB").save(out_path, format="PNG", optimize=True)
    return f"/uploads/certificates/issued/cert_{cert_id}.png"

def main():
    db_path = "backend/education.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("SELECT id, full_name, email FROM users WHERE email='student1@edu.kz'")
    user_row = cur.fetchone()
    if not user_row:
        return
    user_id, full_name, email = user_row
    
    cur.execute("SELECT id, title FROM courses LIMIT 1")
    course_row = cur.fetchone()
    if not course_row:
        return
    course_id, course_title = course_row
    
    cur.execute("SELECT id FROM certificates WHERE user_id=? AND course_id=?", (user_id, course_id))
    cert_row = cur.fetchone()
    if not cert_row:
        return
    cert_id = cert_row[0]
    
    student_label = full_name.strip() if full_name else email
    
    cert_url = render_certificate_png(
        cert_id=cert_id,
        student_name=student_label,
        course_title=course_title,
        issued_at=datetime.now(timezone.utc)
    )
    
    cur.execute("UPDATE certificates SET certificate_url=? WHERE id=?", (cert_url, cert_id))
    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    main()
