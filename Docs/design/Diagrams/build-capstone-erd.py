"""Build the five-module ERD from checked, migration-backed field selections.

Produces a vector PDF, SVG, editable diagrams.net file, and a source manifest.
Only reads migrations; never connects to an application database.
"""

from __future__ import annotations

import html
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "output" / "pdf"
W, H = 1684, 1191  # A2 landscape, points (rounded).
REV = "2026-09-17"
INK = "#222222"
MUTED = "#555555"
RULE = "#b6b6b6"
HEAD = "#eeeeee"


def read_schema():
    schema = {}
    for service in ("operations", "tracking"):
        for path in sorted((ROOT / "apps" / service / "database" / "migrations").glob("*.php")):
            source = path.read_text(encoding="utf-8-sig").split("public function down", 1)[0]
            blocks = re.finditer(
                r"Schema::(create|table)\(\s*'([^']+)'\s*,\s*(?:static\s+)?function[^\{]*\{(.*?)\n\s{8,}\}\);",
                source,
                re.S,
            )
            for block in blocks:
                key = (service, block[2])
                table = schema.setdefault(key, {"columns": {}, "sources": []})
                rel = path.relative_to(ROOT).as_posix()
                if rel not in table["sources"]:
                    table["sources"].append(rel)
                for statement in re.findall(r"\$table->(.*?);", block[3], re.S):
                    first = re.match(r"(\w+)\((.*?)\)", statement, re.S)
                    if not first:
                        continue
                    method, args = first.groups()
                    if method == "unique":
                        unique_column = re.match(r"\s*'([^']+)'", args)
                        if unique_column and unique_column[1] in table["columns"]:
                            table["columns"][unique_column[1]]["uk"] = True
                        continue
                    if method in {"index", "primary", "foreign", "dropColumn", "dropIndex", "dropUnique", "dropForeign", "dropConstrainedForeignId"}:
                        continue
                    if method in {"timestamps", "softDeletes"}:
                        names = ["created_at", "updated_at"] if method == "timestamps" else ["deleted_at"]
                        for name in names:
                            table["columns"][name] = {"type": "timestamp", "nullable": True, "pk": False, "uk": False, "target": None, "source": rel}
                        continue
                    if method in {"morphs", "nullableMorphs"}:
                        match = re.search(r"'([^']+)'", args)
                        if match:
                            for suffix, typ in (("_type", "string"), ("_id", "unsignedBigInteger")):
                                table["columns"][match[1] + suffix] = {"type": typ, "nullable": method == "nullableMorphs", "pk": False, "uk": False, "target": None, "source": rel}
                        continue
                    name_match = re.search(r"'([^']+)'", args)
                    if method == "id":
                        name = name_match[1] if name_match else "id"
                    elif not name_match:
                        continue
                    else:
                        name = name_match[1]
                    if method in {"renameColumn", "dropTimestamps", "dropSoftDeletes"}:
                        continue
                    previous = table["columns"].get(name, {})
                    target = None
                    constrained = re.search(r"->constrained\((.*?)\)", statement, re.S)
                    if constrained:
                        explicit = re.search(r"'([^']+)'", constrained[1])
                        target = explicit[1] if explicit else name.removesuffix("_id") + "s"
                    nullable_call = re.search(r"->nullable\((.*?)\)", statement, re.S)
                    nullable = bool(nullable_call) and nullable_call[1].strip() not in {"false", "0"}
                    table["columns"][name] = {
                        "type": method,
                        "nullable": nullable,
                        "pk": method == "id" or "->primary(" in statement or previous.get("pk", False),
                        "uk": "->unique(" in statement or previous.get("uk", False),
                        "target": target or previous.get("target"),
                        "source": rel,
                    }
    return schema


SCHEMA = read_schema()


@dataclass
class Entity:
    name: str
    x: float
    y: float
    w: float
    fields: list[str]
    module: str
    service: str = "operations"

    @property
    def h(self):
        return 34 + 17 * len(self.fields)

    def port(self, side, offset=0.5):
        return {
            "L": (self.x, self.y + self.h * offset),
            "R": (self.x + self.w, self.y + self.h * offset),
            "T": (self.x + self.w * offset, self.y),
            "B": (self.x + self.w * offset, self.y + self.h),
        }[side]


ENTITIES = [
    Entity("clients", 53, 147, 232, ["id", "code", "company_name", "status"], "1"),
    Entity("service_requests", 347, 147, 232, ["id", "client_id", "reference", "project_name", "service_type", "scheduled_date", "status"], "1"),
    Entity("dispatch_jobs", 347, 385, 232, ["id", "service_request_id", "reference", "source_type", "source_id", "title", "scheduled_start", "scheduled_end", "status", "version"], "1"),
    Entity("job_reports", 53, 430, 232, ["id", "dispatch_job_id", "author_id", "work_summary", "status"], "1"),
    Entity("users", 650, 147, 240, ["id", "username", "name", "is_active"], "shared"),
    Entity("operational_assets", 650, 411, 240, ["id", "code", "name", "kind", "status", "rated_capacity", "meter_value"], "shared"),
    Entity("personnel_profiles", 956, 147, 310, ["id", "user_id", "employee_number", "availability_status"], "2"),
    Entity("personnel_credentials", 1318, 147, 310, ["id", "user_id", "kind", "credential_number", "expires_at", "status"], "2"),
    Entity("dispatch_personnel_assignments", 956, 325, 310, ["id", "dispatch_job_id", "user_id", "assignment_type", "response_status", "active_from", "active_until"], "2"),
    Entity("dispatch_asset_assignments", 1318, 325, 310, ["id", "dispatch_job_id", "operational_asset_id", "assignment_type", "active_from", "active_until"], "2"),
    Entity("operator_shifts", 956, 525, 310, ["id", "user_id", "operational_asset_id", "dispatch_job_id", "started_at", "ended_at", "status"], "2"),
    Entity("operator_duty_logs", 1318, 525, 310, ["id", "operator_shift_id", "user_id", "duty_status", "started_at", "ended_at"], "2"),
    Entity("dvir_inspections", 65, 768, 235, ["id", "user_id", "operational_asset_id", "dispatch_job_id", "inspection_type", "has_defects"], "3"),
    Entity("dvir_inspection_checks", 65, 951, 235, ["id", "dvir_inspection_id", "category", "label", "status"], "3"),
    Entity("dvir_inspection_photos", 322, 951, 225, ["id", "dvir_inspection_id", "angle", "file_path"], "3"),
    Entity("inspections", 610, 768, 240, ["id", "operational_asset_id", "technician_id", "type", "result"], "4"),
    Entity("maintenance_work_orders", 610, 949, 240, ["id", "operational_asset_id", "technician_id", "status", "dispatch_blocking"], "4"),
    Entity("critical_lift_plans", 895, 768, 240, ["id", "dispatch_job_id", "operational_asset_id", "crane_operator_id", "lift_reference", "status"], "4"),
    Entity("tower_crane_shift_logs", 895, 968, 240, ["id", "operational_asset_id", "operator_id", "dispatch_job_id", "shift_date", "operating_hours"], "4"),
    Entity("fuel_requests", 1200, 768, 215, ["id", "requester_id", "dispatch_job_id", "operational_asset_id", "operator_shift_id", "quantity_litres", "status"], "5"),
    Entity("fuel_logs", 1449, 968, 182, ["id", "fuel_request_id", "recorded_by", "quantity_litres", "recorded_at"], "5"),
]
BY_NAME = {e.name: e for e in ENTITIES}

GROUPS = [
    ("1", 35, 104, 570, 591, "1  Dispatch Job and Scheduling"),
    ("shared", 630, 104, 280, 591, "Shared records"),
    ("2", 935, 104, 714, 591, "2  Assign Driver/Operator and Equipment"),
    ("3", 35, 730, 530, 387, "3  Fleet Management"),
    ("4", 590, 730, 565, 387, "4  Crane and Equipment Management"),
    ("5", 1180, 730, 469, 387, "5  Fuel Management"),
]


def port(name, side, value=None):
    e = BY_NAME[name]
    if value is None:
        return e.port(side)
    if side in ("L", "R"):
        return (e.x if side == "L" else e.x + e.w, value)
    return (value, e.y if side == "T" else e.y + e.h)


RELATIONS = []


def relation(parent, child, fk, start, end, via=()):
    col = SCHEMA[("operations", child)]["columns"][fk]
    assert col["target"] == parent, (parent, child, fk, col)
    p = port(parent, *start)
    q = port(child, *end)
    RELATIONS.append({
        "parent": parent, "child": child, "fk": fk,
        "parent_card": "zero_one" if col["nullable"] else "one",
        "child_card": "zero_one" if col["uk"] else "zero_many",
        "points": [p, *via, q],
    })


relation("clients", "service_requests", "client_id", ("R", 206), ("L", 206))
relation("service_requests", "dispatch_jobs", "service_request_id", ("B", 463), ("T", 463))
relation("dispatch_jobs", "job_reports", "dispatch_job_id", ("L", 493), ("R", 493))
relation("dispatch_jobs", "dispatch_personnel_assignments", "dispatch_job_id", ("R", 421), ("L", 362), [(612, 421), (612, 306), (930, 306), (930, 362)])
relation("dispatch_jobs", "dispatch_asset_assignments", "dispatch_job_id", ("R", 447), ("L", 362), [(621, 447), (621, 295), (1288, 295), (1288, 362)])
relation("users", "personnel_profiles", "user_id", ("R", 199), ("L", 199))
relation("users", "personnel_credentials", "user_id", ("R", 223), ("L", 223), [(918, 223), (918, 286), (1290, 286), (1290, 223)])
relation("users", "dispatch_personnel_assignments", "user_id", ("R", 235), ("L", 414), [(923, 235), (923, 414)])
relation("users", "operator_shifts", "user_id", ("B", 780), ("L", 572), [(780, 281), (926, 281), (926, 572)])
relation("operational_assets", "dispatch_asset_assignments", "operational_asset_id", ("R", 448), ("B", 1450), [(918, 448), (918, 496), (1450, 496)])
relation("operational_assets", "operator_shifts", "operational_asset_id", ("R", 538), ("L", 615), [(915, 538), (915, 615)])
relation("dispatch_jobs", "operator_shifts", "dispatch_job_id", ("B", 385), ("L", 651), [(385, 686), (931, 686), (931, 651)])
relation("operator_shifts", "operator_duty_logs", "operator_shift_id", ("R", 587), ("L", 587))
relation("operational_assets", "dvir_inspections", "operational_asset_id", ("L", 489), ("T", 282), [(615, 489), (615, 710), (282, 710)])
relation("dvir_inspections", "dvir_inspection_checks", "dvir_inspection_id", ("B", 182), ("T", 182))
relation("dvir_inspections", "dvir_inspection_photos", "dvir_inspection_id", ("B", 267), ("T", 433), [(267, 924), (433, 924)])
relation("operational_assets", "inspections", "operational_asset_id", ("B", 710), ("L", 810), [(710, 701), (578, 701), (578, 810)])
relation("operational_assets", "maintenance_work_orders", "operational_asset_id", ("B", 750), ("T", 730), [(750, 699), (1162, 699), (1162, 924), (730, 924)])
relation("operational_assets", "critical_lift_plans", "operational_asset_id", ("B", 799), ("T", 1015), [(799, 706), (1015, 706)])
relation("operational_assets", "tower_crane_shift_logs", "operational_asset_id", ("R", 514), ("T", 1015), [(919, 514), (919, 723), (1143, 723), (1143, 941), (1015, 941)])
relation("operational_assets", "fuel_requests", "operational_asset_id", ("B", 850), ("T", 1398), [(850, 715), (1398, 715)])
relation("dispatch_jobs", "fuel_requests", "dispatch_job_id", ("B", 531), ("L", 834), [(531, 720), (1170, 720), (1170, 834)])
relation("fuel_requests", "fuel_logs", "fuel_request_id", ("R", 862), ("T", 1540), [(1433, 862), (1433, 939), (1540, 939)])


class Drawing:
    def __init__(self):
        self.items = []

    def rect(self, x, y, w, h, fill=None, stroke=INK, width=0.8):
        self.items.append(("rect", x, y, w, h, fill, stroke, width))

    def line(self, points, color=INK, width=0.8):
        self.items.append(("line", list(points), color, width))

    def circle(self, x, y, r, fill="white", stroke=INK, width=0.8):
        self.items.append(("circle", x, y, r, fill, stroke, width))

    def text(self, x, y, text, size=10.5, bold=False, color=INK, align="left"):
        self.items.append(("text", x, y, text, size, bold, color, align))


D = Drawing()


def glyph(point, inward, cardinality):
    x, y = point
    dx, dy = inward
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    vx, vy = -uy, ux

    def at(distance, offset=0):
        return (x + ux * distance + vx * offset, y + uy * distance + vy * offset)

    if cardinality == "zero_many":
        for offset in (-5, 5):
            D.line([at(0, offset), at(11)])
        D.circle(*at(19), 3.2)
    else:
        D.line([at(7, -5), at(7, 5)])
        if cardinality == "one":
            D.line([at(13, -5), at(13, 5)])
        else:
            D.circle(*at(17), 3.2)


def field_label(e, field):
    c = SCHEMA[(e.service, e.name)]["columns"][field]
    keys = []
    if c["pk"]:
        keys.append("PK")
    if c["target"]:
        keys.append("FK")
    if c["uk"]:
        keys.append("UK")
    return "/".join(keys), field + (" ?" if c["nullable"] else "")


def build_drawing():
    D.rect(0, 0, W, H, fill="white", stroke=None)
    D.text(35, 31, "CORE TRANSACTION 2", 10.5, True)
    D.text(35, 64, "Entity-Relationship Diagram", 25, True)
    D.text(35, 84, "Five operational modules | Selected keys and business fields", 11, color=MUTED)
    D.text(1649, 34, "Alibaton Construction", 11.5, True, align="right")
    D.text(1649, 54, "Schema revision: 17 September 2026", 10.5, align="right")
    D.text(1649, 74, "Operations database | A2 landscape", 10.5, color=MUTED, align="right")
    for _, x, y, w, h, title in GROUPS:
        D.rect(x, y, w, h, stroke=RULE, width=0.6)
        D.text(x + 15, y + 24, title, 13.5, True)
    for r in RELATIONS:
        D.line(r["points"], width=0.8)
    for e in ENTITIES:
        D.rect(e.x, e.y, e.w, e.h, fill="white")
        D.rect(e.x, e.y, e.w, 26, fill=HEAD)
        D.line([(e.x + 42, e.y + 26), (e.x + 42, e.y + e.h)], color=RULE, width=0.45)
        D.text(e.x + 10, e.y + 18, e.name, 10.7, True)
        for i, f in enumerate(e.fields):
            key, label = field_label(e, f)
            y = e.y + 42 + i * 17
            D.text(e.x + 7, y, key, 8.5, True)
            D.text(e.x + 50, y, label, 10.2)
    for r in RELATIONS:
        pts = r["points"]
        glyph(pts[0], (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), r["parent_card"])
        glyph(pts[-1], (pts[-2][0] - pts[-1][0], pts[-2][1] - pts[-1][1]), r["child_card"])
    D.text(650, 340, "Common identity and asset records", 10.2, True)
    D.text(650, 360, "used across the five modules.", 10.2, color=MUTED)
    D.text(650, 391, "Vehicles, cranes and other equipment.", 10.2, color=MUTED)
    D.text(53, 644, "Project planning and Dispatch V2 records", 10.2, color=MUTED)
    D.text(53, 661, "are documented in the companion schema notes.", 10.2, color=MUTED)
    D.text(65, 1097, "Inspection records support field safety checks.", 10.2, color=MUTED)
    D.text(610, 1095, "Maintenance also covers fleet assets.", 10.2, color=MUTED)
    D.text(1200, 1009, "Fuel request", 10.2, color=MUTED)
    D.text(1200, 1026, "and usage history.", 10.2, color=MUTED)

    D.line([(35, 1138), (1649, 1138)], color=RULE, width=0.7)
    D.text(35, 1159, "PK  Primary key    FK  Foreign key    UK  Unique column    ?  Nullable field", 10.2)
    legends = [(656, "one", "Exactly one"), (810, "zero_one", "Zero or one"), (963, "zero_many", "Zero or many")]
    for x, card, label in legends:
        D.line([(x, 1155), (x + 40, 1155)])
        glyph((x, 1155), (40, 0), card)
        D.text(x + 49, 1159, label, 10.2)
    D.text(1649, 1159, "Sheet 1 of 1", 10.2, align="right")
    D.text(35, 1180, "Selected business relationships are drawn. Additional FK columns retain their schema meaning; see companion notes for all displayed FK targets and scope.", 9.8, color=MUTED)


def write_pdf(path):
    font_dir = Path("C:/Windows/Fonts")
    for name, file in (("ErdRegular", "arial.ttf"), ("ErdBold", "arialbd.ttf")):
        pdfmetrics.registerFont(TTFont(name, str(font_dir / file)))
    c = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
    c.setTitle("Core Transaction 2 - Entity-Relationship Diagram")
    c.setSubject("Five operational modules; migration-backed keys and selected relationships")
    c.setAuthor("")
    for item in D.items:
        if item[0] == "rect":
            _, x, y, w, h, fill, stroke, lw = item
            c.setLineWidth(lw)
            if fill:
                c.setFillColor(HexColor(fill) if fill != "white" else HexColor("#ffffff"))
            if stroke:
                c.setStrokeColor(HexColor(stroke))
            c.rect(x, H - y - h, w, h, stroke=int(bool(stroke)), fill=int(bool(fill)))
        elif item[0] == "line":
            _, points, color, lw = item
            c.setStrokeColor(HexColor(color))
            c.setLineWidth(lw)
            path_obj = c.beginPath()
            path_obj.moveTo(points[0][0], H - points[0][1])
            for x, y in points[1:]:
                path_obj.lineTo(x, H - y)
            c.drawPath(path_obj)
        elif item[0] == "circle":
            _, x, y, radius, fill, stroke, lw = item
            c.setStrokeColor(HexColor(stroke))
            c.setFillColor(HexColor("#ffffff" if fill == "white" else fill))
            c.setLineWidth(lw)
            c.circle(x, H - y, radius, stroke=1, fill=1)
        else:
            _, x, y, content, size, bold, color, align = item
            c.setFont("ErdBold" if bold else "ErdRegular", size)
            c.setFillColor(HexColor(color))
            {"left": c.drawString, "right": c.drawRightString, "center": c.drawCentredString}[align](x, H - y, content)
    c.showPage()
    c.save()


def write_svg(path):
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">',
             '<title id="title">Core Transaction 2: Entity-Relationship Diagram</title>',
             '<desc id="desc">Twenty-one application tables grouped into five operational modules, with shared users and operational assets. Crow\'s-foot symbols indicate relationship cardinality. Primary keys, foreign keys, unique columns and nullable fields are marked.</desc>']
    for item in D.items:
        if item[0] == "rect":
            _, x, y, w, h, fill, stroke, lw = item
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill or "none"}" stroke="{stroke or "none"}" stroke-width="{lw}"/>')
        elif item[0] == "line":
            _, points, color, lw = item
            coords = " ".join(f"{x},{y}" for x, y in points)
            parts.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{lw}"/>')
        elif item[0] == "circle":
            _, x, y, r, fill, stroke, lw = item
            parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{lw}"/>')
        else:
            _, x, y, content, size, bold, color, align = item
            anchor = {"left": "start", "center": "middle", "right": "end"}[align]
            parts.append(f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{html.escape(content)}</text>')
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def write_drawio(path):
    mxfile = ET.Element("mxfile", {"host": "app.diagrams.net", "type": "device"})
    diagram = ET.SubElement(mxfile, "diagram", {"id": "core2-erd", "name": "Five-module ERD"})
    model = ET.SubElement(diagram, "mxGraphModel", {"dx": "1684", "dy": "1191", "grid": "1", "gridSize": "10", "guides": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": str(W), "pageHeight": str(H)})
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    def cell(id_, value, style, x, y, w, h):
        node = ET.SubElement(root, "mxCell", {"id": id_, "value": value, "style": style, "vertex": "1", "parent": "1"})
        ET.SubElement(node, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})
        return node

    base = "fontFamily=Arial;html=1;whiteSpace=wrap;rounded=0;shadow=0;"
    for key, x, y, w, h, title in GROUPS:
        cell("group-" + key, html.escape(title), base + "fillColor=none;strokeColor=#b6b6b6;strokeWidth=0.6;align=left;verticalAlign=top;spacingLeft=15;spacingTop=10;fontSize=13.5;fontStyle=1;", x, y, w, h)
    for i, r in enumerate(RELATIONS):
        parent, child = BY_NAME[r["parent"]], BY_NAME[r["child"]]
        start, end = r["points"][0], r["points"][-1]
        exit_x, exit_y = (start[0] - parent.x) / parent.w, (start[1] - parent.y) / parent.h
        entry_x, entry_y = (end[0] - child.x) / child.w, (end[1] - child.y) / child.h
        markers = {"one": "ERmandOne", "zero_one": "ERzeroToOne", "zero_many": "ERzeroToMany"}
        style = f"edgeStyle=segmentEdgeStyle;html=1;rounded=0;strokeWidth=0.8;strokeColor=#222222;startArrow={markers[r['parent_card']]};endArrow={markers[r['child_card']]};startSize=16;endSize=16;exitX={exit_x};exitY={exit_y};entryX={entry_x};entryY={entry_y};exitPerimeter=0;entryPerimeter=0;"
        edge = ET.SubElement(root, "mxCell", {"id": f"rel-{i}", "value": "", "style": style, "edge": "1", "parent": "1", "source": parent.name, "target": child.name})
        geom = ET.SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
        if len(r["points"]) > 2:
            points = ET.SubElement(geom, "Array", {"as": "points"})
            for x, y in r["points"][1:-1]:
                ET.SubElement(points, "mxPoint", {"x": str(x), "y": str(y)})
    for e in ENTITIES:
        rows = []
        for f in e.fields:
            key, label = field_label(e, f)
            rows.append(f'<tr><td style="width:34px;border-right:1px solid #b6b6b6;font-size:8.5px;font-weight:bold;padding:1px 4px;">{key}</td><td style="padding:1px 7px;">{html.escape(label)}</td></tr>')
        value = f'<div style="font-family:Arial;font-size:10.2px;"><div style="background:#eeeeee;border-bottom:1px solid #222222;font-size:10.7px;font-weight:bold;padding:6px 9px;">{html.escape(e.name)}</div><table style="width:100%;border-collapse:collapse;line-height:15px;">{"".join(rows)}</table></div>'
        cell(e.name, value, base + "fillColor=#ffffff;strokeColor=#222222;strokeWidth=0.8;align=left;verticalAlign=top;spacing=0;overflow=fill;", e.x, e.y, e.w, e.h)
    # Add captions and page furniture as editable text, not a flattened image.
    for i, item in enumerate(D.items):
        if item[0] != "text":
            continue
        _, x, y, value, size, bold, color, align = item
        if 140 <= y <= 1117 and any(e.x <= x <= e.x + e.w and e.y <= y <= e.y + e.h for e in ENTITIES):
            continue
        if any(value == group[-1] for group in GROUPS):
            continue
        width = min(1614, max(100, len(value) * size * 0.58 + 15))
        left = x - width if align == "right" else x
        cell(f"caption-{i}", html.escape(value), base + f"text;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;fontSize={size};fontStyle={1 if bold else 0};fontColor={color};spacing=0;", left, y - size, width, size + 6)
    ET.indent(mxfile, space="  ")
    ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=True)


def verify():
    issues = []
    for e in ENTITIES:
        assert (e.service, e.name) in SCHEMA, e.name
        for f in e.fields:
            assert f in SCHEMA[(e.service, e.name)]["columns"], (e.name, f)
        assert e.x >= 0 and e.y >= 0 and e.x + e.w < W and e.y + e.h < 1138
        for other in ENTITIES:
            if e is other:
                continue
            assert not (e.x < other.x + other.w and e.x + e.w > other.x and e.y < other.y + other.h and e.y + e.h > other.y), (e.name, other.name)
    for r in RELATIONS:
        for a, b in zip(r["points"], r["points"][1:]):
            assert a != b and (a[0] == b[0] or a[1] == b[1]), (r, a, b)
            for e in ENTITIES:
                if a[0] == b[0]:
                    cuts = e.x + 0.5 < a[0] < e.x + e.w - 0.5 and max(min(a[1], b[1]), e.y + 0.5) < min(max(a[1], b[1]), e.y + e.h - 0.5)
                else:
                    cuts = e.y + 0.5 < a[1] < e.y + e.h - 0.5 and max(min(a[0], b[0]), e.x + 0.5) < min(max(a[0], b[0]), e.x + e.w - 0.5)
                if cuts:
                    issues.append(f"{r['parent']} -> {r['child']} crosses {e.name}: {a} to {b}")
    if issues:
        raise ValueError("\n".join(issues))


def manifest():
    drawn = {(r["child"], r["fk"]) for r in RELATIONS}
    return {
        "revision": REV,
        "scope": "Five operational modules: selected application fields and business relationships; repository schema, not a live database inspection.",
        "entities": [{"name": e.name, "module": e.module, "service": e.service, "fields": {f: SCHEMA[(e.service, e.name)]["columns"][f] for f in e.fields}, "migration_sources": SCHEMA[(e.service, e.name)]["sources"]} for e in ENTITIES],
        "relationships": RELATIONS,
        "displayed_fk_without_line": [{"table": e.name, "column": f, "target": SCHEMA[(e.service, e.name)]["columns"][f]["target"]} for e in ENTITIES for f in e.fields if SCHEMA[(e.service, e.name)]["columns"][f]["target"] and (e.name, f) not in drawn],
    }


def er_lines(table_names, show_fields=False):
    names = set(table_names)
    result = ["```mermaid", "erDiagram"]
    for child in table_names:
        table = SCHEMA[("operations", child)]
        fields = BY_NAME[child].fields if show_fields and child in BY_NAME else list(table["columns"])
        for f in fields:
            col = table["columns"][f]
            if col["target"] not in names:
                continue
            left = "o|" if col["nullable"] else "||"
            right = "o|" if col["uk"] else "o{"
            result.append(f"    {col['target']} {left}--{right} {child} : {f}")
    if show_fields:
        for name in table_names:
            e = BY_NAME[name]
            result.append(f"    {name} {{")
            for field in e.fields:
                col = SCHEMA[(e.service, e.name)]["columns"][field]
                key, _ = field_label(e, field)
                typ = col["type"]
                if typ in {"id", "foreignId", "unsignedBigInteger", "bigInteger"}:
                    typ = "bigint"
                elif "Integer" in typ or typ == "integer":
                    typ = "integer"
                elif typ in {"char", "text"}:
                    typ = "string"
                qualifiers = " " + key.replace("/", ",") if key else ""
                note = ' "nullable"' if col["nullable"] else ""
                result.append(f"        {typ} {field}{qualifiers}{note}")
            result.append("    }")
    result.append("```")
    return result


def write_notes():
    parts = [
        "# Core Transaction 2 - Entity-Relationship Diagram",
        "",
        f"Last updated: {REV}.",
        "",
        "The main sheet presents the five operational modules, their shared records, and the keys used to connect them. It contains 21 tables and 122 selected fields. Table names, foreign keys, nullable columns, and single-column unique constraints were checked against the repository migrations.",
        "",
        "- [Print PDF - A2 landscape](../../../output/pdf/core2-erd.pdf)",
        "- [Vector diagram](./capstone-erd-clear.svg)",
        "- [Editable diagrams.net diagram](./capstone-erd.drawio)",
        "- [Field and relationship source manifest](./capstone-erd.schema.json)",
        "",
        "![Core Transaction 2 five-module ERD](./capstone-erd-clear.svg)",
        "",
        "## Scope and notation",
        "",
        "This is the core operational ERD. The printable sheet shows selected business fields and 23 principal relationships. The Mermaid source below includes every declared foreign key among the displayed fields. Additional scheduling, transaction, platform, and tracking records are summarized after the main ERD. Framework tables and a complete column-by-column database dump are outside this sheet's scope.",
        "",
        "The revision describes the current repository, including local migration additions. It does not certify which migrations have been applied to a live database.",
        "",
        "| Mark | Meaning |",
        "| --- | --- |",
        "| PK | Primary key |",
        "| FK | Declared foreign key |",
        "| UK | Single-column unique constraint |",
        "| ? | Nullable column |",
        "| Two bars | Exactly one related parent |",
        "| Circle and bar | Zero or one related record |",
        "| Circle and crow's foot | Zero or many related records |",
        "",
        "A nullable foreign key permits a child record without that parent. A parent may have no child records unless another constraint requires them. The connecting line itself does not indicate whether a relationship is optional; the endpoint symbols do.",
        "",
        "## Five-module mapping",
        "",
        "| Module | Records shown |",
        "| --- | --- |",
        "| 1. Dispatch Job and Scheduling | `clients`, `service_requests`, `dispatch_jobs`, `job_reports` |",
        "| 2. Assign Driver/Operator and Equipment | `personnel_profiles`, `personnel_credentials`, `dispatch_personnel_assignments`, `dispatch_asset_assignments`, `operator_shifts`, `operator_duty_logs` |",
        "| 3. Fleet Management | `dvir_inspections`, `dvir_inspection_checks`, `dvir_inspection_photos` |",
        "| 4. Crane and Equipment Management | `inspections`, `maintenance_work_orders`, `critical_lift_plans`, `tower_crane_shift_logs` |",
        "| 5. Fuel Management | `fuel_requests`, `fuel_logs` |",
        "| Shared records | `users`, `operational_assets` |",
        "",
        "Fleet and Crane/Equipment Management share `operational_assets`. Its `kind` and `subtype` distinguish asset categories. Inspection and maintenance records can apply to both. Placement within a module indicates the business area where a table is explained; it does not impose a database restriction.",
        "",
        "The three software roles are held through the permission model. Separate administrator, manager, and operator account tables are not created by these migrations.",
        "",
        "## Schema details that affect the diagram",
        "",
        "- `dispatch_jobs.service_request_id` is nullable. Manual, rental, and sales dispatches do not require a service-request row.",
        "- `dispatch_jobs.source_type` and `source_id` form a polymorphic application reference. They are not declared database foreign keys.",
        "- `personnel_profiles.user_id` is required and unique in the current migrations. The product description of employees without user accounts is broader than this implemented relationship; the diagram follows the migrations.",
        "- `personnel_credentials` has a composite unique constraint on `(kind, credential_number)`. A credential number is not independently unique.",
        "- An operator may have many historical shifts. A partial unique index permits at most one `active` or `on_break` shift per user; it does not make `operator_shifts.user_id` globally unique.",
        "- `fuel_requests` may reference a job, an asset, and an operator shift independently. Its requester remains required.",
        "- Creator, reviewer, approver, and other role/audit columns are only partly displayed. The table below records FK columns visible on the sheet whose connector lines were omitted for legibility.",
        "",
        "| Displayed foreign key | References |",
        "| --- | --- |",
    ]
    for item in manifest()["displayed_fk_without_line"]:
        parts.append(f"| `{item['table']}.{item['column']}` | `{item['target']}.id` |")
    parts.extend(["", "## Main ERD source", ""])
    parts.extend(er_lines([e.name for e in ENTITIES], show_fields=True))
    parts.extend([
        "", "## Project planning and Dispatch V2", "",
        "These records extend modules 1 and 2. A project shift has one required, unique `dispatch_job_id`; a dispatch job may have zero or one project-shift row. A canonical handoff also has one required, unique legacy job link.", "",
    ])
    parts.extend(er_lines([
        "dispatch_project_plans", "dispatch_project_phases", "dispatch_project_allocations", "dispatch_project_shifts", "operational_assets", "dispatch_jobs",
    ]))
    parts.extend(["", "Dispatch V2 preserves handoffs, execution attempts, plan versions, requirement slots, offers, and approvals:", ""])
    parts.extend(er_lines([
        "dispatch_jobs", "dispatch_handoffs", "dispatch_execution_attempts", "dispatch_plan_versions", "dispatch_plan_requirement_slots", "dispatch_assignment_offers", "dispatch_plan_approvals", "dispatch_emergency_overrides",
    ]))
    parts.extend([
        "", "Related persistence includes `dispatch_idempotency_keys`, `dispatch_outbox_messages`, `dispatch_audit_lineage`, `dispatch_reconciliation_runs`, and `dispatch_reconciliation_findings`.",
        "", "## Rental and sales operational records", "",
        "The diagrams below show the implemented Core-2 records. They do not establish completion of upstream Core 1 integration or move commercial ownership into Core-2.", "",
    ])
    parts.extend(er_lines([
        "clients", "dispatch_jobs", "operational_assets", "users", "rental_reservations", "rental_reservation_items", "rental_operator_assignments", "rental_checkouts", "rental_returns", "rental_handover_evidences",
    ]))
    parts.extend(["", "Sales catalog and fulfillment records:", ""])
    parts.extend(er_lines([
        "clients", "dispatch_jobs", "operational_assets", "sales_catalog_items", "sales_quotes", "sales_quote_items", "sales_orders", "sales_order_items", "sales_inventory_ledger", "ownership_transfers", "sales_delivery_evidences",
    ]))
    parts.extend([
        "", "`rental_handover_evidences` and `sales_delivery_evidences` are defined by the 17 September migration. Each evidence row has a required parent reservation/order, a required submitting user, and an optional dispatch job.",
        "", "`sales_orders.sales_quote_id` is not unique in the migrations. The physical schema therefore permits multiple orders to refer to a quote. `ownership_transfers` has composite uniqueness on `(sales_order_item_id, sales_catalog_item_id)` and single-column uniqueness on `operational_asset_id`; the latter must not be mistaken for uniqueness on `sales_order_item_id` alone.",
        "", "## Shared platform and Tracking database", "",
        "| Area | Principal records |",
        "| --- | --- |",
        "| AI assistance | `gpt_recommendations`, `gpt_recommendation_metrics` |",
        "| Audit and documents | `audit_events`, `attachments`, `notifications`, `report_exports` |",
        "| Emergency response | `sos_incidents`, `sos_incident_recipients`, `sos_delivery_attempts`, `sos_emergency_contacts` |",
        "| Site safety | `toolbox_meetings`, `site_hazard_tickets`, `work_stoppage_notices` |",
        "",
        "GPT subjects, attachment owners, and audit subjects use polymorphic identifiers rather than a foreign key to every possible subject table. JSON arrays such as work-stoppage asset IDs and toolbox-meeting attendance are not junction tables and do not create foreign-key constraints.",
        "",
        "Tracking is stored in a separate service database:",
        "",
        "| Tracking table | Key references |",
        "| --- | --- |",
        "| `location_samples` | Scalar `user_id`; optional scalar `operational_asset_id` and `dispatch_job_id` |",
        "| `latest_locations` | Nullable, unique `user_id`; optional scalar `operational_asset_id`, `dispatch_job_id`, and `location_sample_id` |",
        "| `tracking_command_receipts` | Unique `command_id`; optional scalar `user_id` and `location_sample_id` |",
        "",
        "These reference columns have no declared foreign-key constraints, including `location_sample_id` within Tracking. The Operations database retains the older `location_updates` table and model. A cross-service ID reference must not be drawn as a database-enforced relationship between Operations and Tracking.",
        "", "## Source and verification", "",
        "The build script checks all selected table/column names and drawn FK targets against the migrations, and rejects overlapping entities or connectors through table interiors. The PDF is rendered and visually reviewed after generation. This documentation change does not run migrations or modify application data.", "",
        "Sources for the main sheet:", "",
    ])
    source_paths = sorted({s for e in ENTITIES for s in SCHEMA[(e.service, e.name)]["sources"]})
    for path in source_paths:
        parts.append(f"- [{Path(path).name}](../../../{path})")
    parts.extend([
        "", "Supplemental relationships come from the [Operations migrations](../../../apps/operations/database/migrations/) and [Tracking migrations](../../../apps/tracking/database/migrations/).", "",
        "To regenerate with Python and ReportLab installed, run from the repository root:", "",
        "```text", "python Docs/design/Diagrams/build-capstone-erd.py", "```", "",
        "The PDF is written to `output/pdf/core2-erd.pdf`; the SVG, editable diagram, manifest, and this companion source are written beside the builder. Review both the diagram and this source after changing the selected schema fields. Earlier `.prisma` reference diagrams are historical views and have not been synchronized by this revision.", "",
    ])
    (OUT / "capstone-erd.md").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    verify()
    build_drawing()
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    write_pdf(PDF_DIR / "core2-erd.pdf")
    write_svg(OUT / "capstone-erd-clear.svg")
    write_drawio(OUT / "capstone-erd.drawio")
    (OUT / "capstone-erd.schema.json").write_text(json.dumps(manifest(), indent=2) + "\n", encoding="utf-8")
    write_notes()
    print(json.dumps({"tables": len(ENTITIES), "fields": sum(len(e.fields) for e in ENTITIES), "drawn_relationships": len(RELATIONS), "validation": "All selected columns and FK targets found in migrations; no overlapping tables or connectors through table interiors.", "pdf": str(PDF_DIR / "core2-erd.pdf")}, indent=2))
