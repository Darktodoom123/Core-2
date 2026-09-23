"""Core Operations page and entry point for the simplified two-service ERD."""

from __future__ import annotations

import html
import importlib.util
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("core2_detailed_erd", HERE / "build-capstone-erd.py")
base = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = base
spec.loader.exec_module(base)

WIDTH, HEIGHT = 595.28, 841.89
D = base.Drawing()
SCHEMA = base.SCHEMA


def table(name, title, x, y, w, fields):
    columns = SCHEMA[("operations", name)]["columns"]
    for field in fields:
        assert field in columns, (name, field)
    return {"name": name, "title": title, "x": x, "y": y, "w": w, "h": 42 + 14 * len(fields), "fields": fields}


TABLES = [
    table("dispatch_jobs", "Jobs", 204, 105, 188, ["id", "title"]),
    table("dispatch_personnel_assignments", "Operator assignments", 44, 250, 220, ["id", "dispatch_job_id", "user_id"]),
    table("dispatch_asset_assignments", "Equipment assignments", 331, 250, 220, ["id", "dispatch_job_id", "operational_asset_id"]),
    table("users", "People", 44, 396, 220, ["id", "name"]),
    table("operational_assets", "Equipment", 331, 396, 220, ["id", "kind"]),
    table("dvir_inspections", "Vehicle checks", 34, 558, 150, ["id", "operational_asset_id", "has_defects"]),
    table("inspections", "Equipment inspections", 224, 558, 147, ["id", "operational_asset_id", "result"]),
    table("fuel_requests", "Fuel requests", 414, 558, 147, ["id", "operational_asset_id", "quantity_litres"]),
    table("fuel_logs", "Fuel usage", 414, 688, 147, ["id", "fuel_request_id", "quantity_litres"]),
]
BY_NAME = {item["name"]: item for item in TABLES}
GROUPS = [
    ("module-1", 190, 73, 216, 119, ["1. Dispatch Job and Scheduling"]),
    ("module-2", 24, 213, 547, 137, ["2. Assign Driver/Operator and Equipment"]),
    ("module-3", 24, 507, 169, 165, ["3. Fleet Management"]),
    ("module-4", 213, 507, 170, 165, ["4. Crane and Equipment", "Management"]),
    ("module-5", 403, 507, 168, 277, ["5. Fuel Management"]),
]


def fk(parent, child, column, points):
    col = SCHEMA[("operations", child)]["columns"][column]
    assert col["target"] == parent, (parent, child, column)
    return {"parent": parent, "child": child, "fk": column, "points": points, "parent_card": "zero_one" if col["nullable"] else "one", "child_card": "zero_one" if col["uk"] else "zero_many"}


LINKS = [
    fk("dispatch_jobs", "dispatch_personnel_assignments", "dispatch_job_id", [(204, 143), (16, 143), (16, 292), (44, 292)]),
    fk("dispatch_jobs", "dispatch_asset_assignments", "dispatch_job_id", [(392, 143), (579, 143), (579, 292), (551, 292)]),
    fk("users", "dispatch_personnel_assignments", "user_id", [(154, 396), (154, 334)]),
    fk("operational_assets", "dispatch_asset_assignments", "operational_asset_id", [(441, 396), (441, 334)]),
    fk("operational_assets", "dvir_inspections", "operational_asset_id", [(331, 444), (304, 444), (304, 485), (172, 485), (172, 558)]),
    fk("operational_assets", "inspections", "operational_asset_id", [(421, 466), (421, 482), (202, 482), (202, 600), (224, 600)]),
    fk("operational_assets", "fuel_requests", "operational_asset_id", [(514, 466), (514, 492), (550, 492), (550, 558)]),
    fk("fuel_requests", "fuel_logs", "fuel_request_id", [(488, 642), (488, 688)]),
]


def draw():
    base.D, base.W, base.H = D, WIDTH, HEIGHT
    D.rect(0, 0, WIDTH, HEIGHT, fill="white", stroke=None)
    D.text(24, 32, "Core-2: Simplified ERD", 19, True)
    D.text(24, 52, "Five modules and their main records", 11, color=base.MUTED)
    for _, x, y, w, h, title in GROUPS:
        D.rect(x, y, w, h, stroke=base.RULE, width=0.55)
        for i, line in enumerate(title):
            D.text(x + 11, y + 17 + i * 13, line, 10.4, True)
    for link in LINKS:
        D.line(link["points"], width=0.8)
    for t in TABLES:
        x, y, w, h = t["x"], t["y"], t["w"], t["h"]
        D.rect(x, y, w, h, fill="white", stroke=base.INK)
        D.rect(x, y, w, 36, fill=base.HEAD, stroke=base.INK)
        D.text(x + 8, y + 15, t["title"], 10.3, True)
        D.text(x + 8, y + 28, t["name"], 7.6, color=base.MUTED)
        D.line([(x + 25, y + 36), (x + 25, y + h)], color=base.RULE, width=0.4)
        for i, field in enumerate(t["fields"]):
            col = SCHEMA[("operations", t["name"])]["columns"][field]
            key = "PK" if col["pk"] else "FK" if col["target"] else ""
            label = field + (" ?" if col["nullable"] else "")
            D.text(x + 5, y + 49 + i * 14, key, 7.8, True)
            D.text(x + 31, y + 49 + i * 14, label, 8.9)
    for link in LINKS:
        p = link["points"]
        base.glyph(p[0], (p[1][0] - p[0][0], p[1][1] - p[0][1]), link["parent_card"])
        base.glyph(p[-1], (p[-2][0] - p[-1][0], p[-2][1] - p[-1][1]), link["child_card"])
    D.text(24, 717, "Shared equipment records cover", 10.5)
    D.text(24, 733, "vehicles, cranes and other assets.", 10.5)
    D.text(24, 758, "Only the main relationships are shown.", 9.5, color=base.MUTED)
    D.line([(24, 796), (571, 796)], color=base.RULE, width=0.55)
    D.text(24, 812, "PK = record ID    FK = linked record    ? = optional", 9.3)
    for x, card, label in [(325, "one", "One"), (397, "zero_one", "0 or 1"), (474, "zero_many", "0 or many")]:
        D.line([(x, 807), (x + 26, 807)])
        base.glyph((x, 807), (26, 0), card)
        D.text(x + 32, 812, label, 8.8)
    D.text(24, 831, "Core Transaction 2 | Alibaton Construction", 8.8, color=base.MUTED)
    D.text(571, 831, "17 September 2026", 8.8, color=base.MUTED, align="right")


def write_drawio(path):
    file = ET.Element("mxfile", {"host": "app.diagrams.net", "type": "device"})
    diagram = ET.SubElement(file, "diagram", {"name": "Simplified ERD", "id": "core2-simple"})
    model = ET.SubElement(diagram, "mxGraphModel", {"page": "1", "pageWidth": str(WIDTH), "pageHeight": str(HEIGHT), "grid": "1", "gridSize": "10"})
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    def cell(key, value, x, y, w, h, style):
        obj = ET.SubElement(root, "mxCell", {"id": key, "value": value, "style": "html=1;fontFamily=Arial;whiteSpace=wrap;rounded=0;" + style, "vertex": "1", "parent": "1"})
        ET.SubElement(obj, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})

    for key, x, y, w, h, title in GROUPS:
        cell(key, "<br>".join(html.escape(s) for s in title), x, y, w, h, "fillColor=none;strokeColor=#b6b6b6;strokeWidth=0.55;align=left;verticalAlign=top;spacingLeft=11;spacingTop=7;fontSize=10.4;fontStyle=1;")
    markers = {"one": "ERmandOne", "zero_one": "ERzeroToOne", "zero_many": "ERzeroToMany"}
    for i, link in enumerate(LINKS):
        parent, child = BY_NAME[link["parent"]], BY_NAME[link["child"]]
        p, q = link["points"][0], link["points"][-1]
        style = f"edgeStyle=segmentEdgeStyle;rounded=0;strokeWidth=0.8;strokeColor=#222222;startArrow={markers[link['parent_card']]};endArrow={markers[link['child_card']]};startSize=16;endSize=16;exitX={(p[0]-parent['x'])/parent['w']};exitY={(p[1]-parent['y'])/parent['h']};entryX={(q[0]-child['x'])/child['w']};entryY={(q[1]-child['y'])/child['h']};exitPerimeter=0;entryPerimeter=0;"
        edge = ET.SubElement(root, "mxCell", {"id": f"link-{i}", "source": link["parent"], "target": link["child"], "style": style, "edge": "1", "parent": "1"})
        geom = ET.SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
        arr = ET.SubElement(geom, "Array", {"as": "points"})
        for x, y in link["points"][1:-1]:
            ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})
    for t in TABLES:
        rows = []
        for f in t["fields"]:
            col = SCHEMA[("operations", t["name"])]["columns"][f]
            key = "PK" if col["pk"] else "FK" if col["target"] else ""
            label = f + (" ?" if col["nullable"] else "")
            rows.append(f'<tr><td style="width:20px;border-right:1px solid #b6b6b6;font-size:7.8px;padding-left:4px;">{key}</td><td style="padding-left:6px;">{html.escape(label)}</td></tr>')
        val = f'<div style="font-family:Arial;"><div style="background:#eeeeee;border-bottom:1px solid #222222;padding:4px 7px;"><b style="font-size:10.3px;">{html.escape(t["title"])}</b><br><span style="font-size:7.6px;color:#555555;">{html.escape(t["name"])}</span></div><table style="font-size:8.9px;line-height:12px;width:100%;border-collapse:collapse;">{"".join(rows)}</table></div>'
        cell(t["name"], val, t["x"], t["y"], t["w"], t["h"], "strokeColor=#222222;fillColor=#ffffff;strokeWidth=0.8;align=left;verticalAlign=top;spacing=0;overflow=fill;")
    for i, item in enumerate(D.items):
        if item[0] != "text":
            continue
        _, x, y, value, size, bold, color, align = item
        if 65 <= y <= 680:
            continue
        w = max(90, min(547, len(value) * size * 0.56 + 10))
        cell(f"caption-{i}", html.escape(value), x-w if align == "right" else x, y-size, w, size+4, f"text;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;fontSize={size};fontStyle={1 if bold else 0};fontColor={color};spacing=0;")
    ET.indent(file, space="  ")
    ET.ElementTree(file).write(path, encoding="utf-8", xml_declaration=True)


def verify():
    for link in LINKS:
        for a, b in zip(link["points"], link["points"][1:]):
            assert a[0] == b[0] or a[1] == b[1]
            for t in TABLES:
                x, y, w, h = t["x"], t["y"], t["w"], t["h"]
                if a[0] == b[0]:
                    cuts = x+0.5 < a[0] < x+w-0.5 and max(min(a[1], b[1]), y+0.5) < min(max(a[1], b[1]), y+h-0.5)
                else:
                    cuts = y+0.5 < a[1] < y+h-0.5 and max(min(a[0], b[0]), x+0.5) < min(max(a[0], b[0]), x+w-0.5)
                assert not cuts, (link["child"], t["name"], a, b)


if __name__ == "__main__":
    import runpy

    runpy.run_path(str(HERE / "build-service-erd.py"), run_name="__main__")
