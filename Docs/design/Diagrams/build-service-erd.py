"""Build the simplified ERD with Operations, AI, and isolated Tracking storage."""

from __future__ import annotations

import html
import importlib.util
import json
import math
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfReader, PdfWriter


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("core2_simple_erd", HERE / "build-simple-erd.py")
simple = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = simple
spec.loader.exec_module(simple)
base = simple.base
SCHEMA = base.SCHEMA
WIDTH, HEIGHT = 1191, 842
D = base.Drawing()


def table(service, name, title, x, y, w, fields):
    columns = SCHEMA[(service, name)]["columns"]
    for field in fields:
        assert field in columns, (service, name, field)
    return {"service": service, "name": name, "title": title, "x": x, "y": y, "w": w, "h": 42 + 14 * len(fields), "fields": fields}


TABLES = [
    table("operations", "dispatch_jobs", "Jobs", 42, 132, 230, ["id", "title"]),
    table("operations", "users", "People", 312, 132, 230, ["id", "name"]),
    table("operations", "operational_assets", "Equipment", 602, 132, 230, ["id", "kind"]),
    table("operations", "dispatch_personnel_assignments", "Operator assignments", 42, 300, 230, ["id", "dispatch_job_id", "user_id"]),
    table("operations", "dispatch_asset_assignments", "Equipment assignments", 312, 300, 230, ["id", "dispatch_job_id", "operational_asset_id"]),
    table("operations", "dvir_inspections", "Vehicle checks", 42, 470, 230, ["id", "operational_asset_id", "has_defects"]),
    table("operations", "inspections", "Equipment inspections", 312, 470, 230, ["id", "operational_asset_id", "result"]),
    table("operations", "fuel_requests", "Fuel requests", 602, 470, 230, ["id", "operational_asset_id", "quantity_litres"]),
    table("operations", "fuel_logs", "Fuel usage", 602, 645, 230, ["id", "fuel_request_id", "quantity_litres"]),
    table("operations", "gpt_recommendations", "AI recommendations", 42, 645, 230, ["id", "requested_by", "subject_type", "subject_id", "status"]),
    table("operations", "gpt_recommendation_metrics", "AI performance records", 312, 645, 230, ["id", "recommendation_id", "event"]),
    table("tracking", "location_samples", "GPS history", 922, 132, 230, ["id", "user_id", "operational_asset_id", "dispatch_job_id", "latitude", "longitude", "captured_at"]),
    table("tracking", "latest_locations", "Latest position", 922, 350, 230, ["id", "user_id", "operational_asset_id", "dispatch_job_id", "location_sample_id", "captured_at"]),
    table("tracking", "tracking_command_receipts", "Ingestion receipts", 922, 570, 230, ["id", "command_id", "user_id", "location_sample_id", "status_code"]),
]
BY_NAME = {t["name"]: t for t in TABLES}
GROUPS = [
    ("operations", 24, 64, 846, 710, "Operations service", "One database: five business modules, shared records and AI"),
    ("tracking", 904, 64, 263, 710, "Tracking microservice", "Separate Tracking database"),
]



def relationship(parent, child, column, points, kind="fk"):
    target = BY_NAME[child]
    col = SCHEMA[(target["service"], child)]["columns"][column]
    if kind == "fk":
        assert BY_NAME[parent]["service"] == target["service"]
        assert col["target"] == parent, (parent, child, column)
    else:
        assert col["target"] is None, (child, column)
    return {"parent": parent, "child": child, "column": column, "kind": kind, "points": points,
            "parent_card": "zero_one" if col["nullable"] else "one", "child_card": "zero_one" if col["uk"] else "zero_many"}


LINKS = [
    relationship("dispatch_jobs", "dispatch_personnel_assignments", "dispatch_job_id", [(260,202),(260,300)]),
    relationship("dispatch_jobs", "dispatch_asset_assignments", "dispatch_job_id", [(272,160),(294,160),(294,245),(427,245),(427,300)]),
    relationship("users", "dispatch_personnel_assignments", "user_id", [(312,180),(285,180),(285,342),(272,342)]),
    relationship("operational_assets", "dispatch_asset_assignments", "operational_asset_id", [(717,202),(717,250),(562,250),(562,342),(542,342)]),
    relationship("operational_assets", "dvir_inspections", "operational_asset_id", [(602,174),(574,174),(574,435),(260,435),(260,470)]),
    relationship("operational_assets", "inspections", "operational_asset_id", [(692,202),(692,424),(535,424),(535,470)]),
    relationship("operational_assets", "fuel_requests", "operational_asset_id", [(820,202),(820,470)]),
    relationship("fuel_requests", "fuel_logs", "fuel_request_id", [(717,554),(717,645)]),
    relationship("users", "gpt_recommendations", "requested_by", [(312,160),(280,160),(280,610),(260,610),(260,645)]),
    relationship("dispatch_jobs", "gpt_recommendations", "subject_id", [(42,170),(34,170),(34,680),(42,680)], "polymorphic"),
    relationship("gpt_recommendations", "gpt_recommendation_metrics", "recommendation_id", [(272,686),(312,686)]),
    relationship("users", "location_samples", "user_id", [(530,132),(530,110),(888,110),(888,188),(922,188)], "cross-service"),
    relationship("dispatch_jobs", "location_samples", "dispatch_job_id", [(262,132),(262,104),(896,104),(896,216),(922,216)], "cross-service"),
    relationship("operational_assets", "location_samples", "operational_asset_id", [(832,160),(880,160),(880,202),(922,202)], "cross-service"),
    relationship("location_samples", "latest_locations", "location_sample_id", [(1037,272),(1037,350)], "scalar"),
    relationship("location_samples", "tracking_command_receipts", "location_sample_id", [(1152,249),(1159,249),(1159,661),(1152,661)], "scalar"),
]



def dashed_line(points):
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        ux, uy = (b[0]-a[0])/length, (b[1]-a[1])/length
        for i in range(0, math.ceil(length), 7):
            end = min(i+4, length)
            D.line([(a[0]+ux*i, a[1]+uy*i), (a[0]+ux*end, a[1]+uy*end)], color="#666666", width=0.75)


def field_label(t, field):
    col = SCHEMA[(t["service"], t["name"])]["columns"][field]
    ref = (t["service"] == "tracking" and field.endswith("_id") and field != "command_id") or (t["name"] == "gpt_recommendations" and field in {"subject_type", "subject_id"})
    key = "PK" if col["pk"] else "FK" if col["target"] else "REF" if ref else ""
    if col["uk"]:
        key = key + "/UK" if key else "UK"
    return key, field + (" ?" if col["nullable"] else "")


def draw():
    base.D, base.W, base.H = D, WIDTH, HEIGHT
    D.rect(0, 0, WIDTH, HEIGHT, fill="white", stroke=None)
    D.text(24, 32, "Core-2 | Entity-Relationship Diagram", 19, True)
    D.text(24, 51, "Five modules, AI assistance and GPS tracking", 11, color=base.MUTED)
    for _, x, y, w, h, title, subtitle in GROUPS:
        D.rect(x, y, w, h, stroke=base.RULE, width=0.65)
        D.text(x+12, y+20, title, 12.2, True)
        D.text(x+12, y+36, subtitle, 9.5, color=base.MUTED)
    for link in LINKS:
        if link["kind"] == "fk":
            D.line(link["points"], width=0.8)
        else:
            dashed_line(link["points"])
    for t in TABLES:
        x, y, w, h = t["x"], t["y"], t["w"], t["h"]
        D.rect(x, y, w, h, fill="white")
        D.rect(x, y, w, 36, fill=base.HEAD)
        D.text(x+8, y+15, t["title"], 10.3, True)
        D.text(x+8, y+28, t["name"], 7.8, color=base.MUTED)
        D.line([(x+41, y+36), (x+41, y+h)], color=base.RULE, width=0.4)
        for i, f in enumerate(t["fields"]):
            key, label = field_label(t, f)
            D.text(x+5, y+49+i*14, key, 7.3, True)
            D.text(x+47, y+49+i*14, label, 8.9)
    for link in LINKS:
        if link["kind"] != "fk":
            continue
        p = link["points"]
        base.glyph(p[0], (p[1][0]-p[0][0], p[1][1]-p[0][1]), link["parent_card"])
        base.glyph(p[-1], (p[-2][0]-p[-1][0], p[-2][1]-p[-1][1]), link["child_card"])
    for x,y,label in [
        (42,124,"1  Dispatch Job and Scheduling"),
        (312,124,"Shared people"), (602,124,"Shared fleet, cranes and equipment"),
        (42,286,"2  Assign Driver/Operator and Equipment"),
        (42,458,"3  Fleet Management"),
        (312,458,"4  Crane and Equipment Management"),
        (602,458,"5  Fuel Management"),
        (42,633,"AI assistance"),
    ]:
        D.text(x,y,label,10.4,True)
    D.text(312,744,"Five modules share Operations data.",10,color=base.MUTED)
    D.text(312,760,"AI runs on its dedicated worker queue.",10,color=base.MUTED)
    D.text(602,760,"Tracking communicates through an API.",10,color=base.MUTED)
    D.text(922,710,"REF fields store IDs without foreign keys.",9.5,color=base.MUTED)
    D.text(922,728,"Dashed links show selected references.",9.5,color=base.MUTED)
    D.line([(24,789),(1167,789)],color=base.RULE,width=0.55)
    D.text(24,807,"PK  Primary key     FK  Foreign key     UK  Unique     REF  Application reference     ?  Nullable",10)
    D.text(24,825,"Solid: database FK     Dashed: reference only     Crow's foot: many; circle: optional; bar: one",9.5,color=base.MUTED)
    D.text(1167,807,"Selected fields and relationships | 14 tables | 2 services",9.5,color=base.MUTED,align="right")
    D.text(1167,825,"17 September 2026  |  1 of 1",9.5,color=base.MUTED,align="right")



def write_drawio_diagram():
    diagram = ET.Element("diagram", {"id": "core2-final", "name": "Core-2 - Final ERD"})
    model = ET.SubElement(diagram, "mxGraphModel", {"page": "1", "pageWidth": str(WIDTH), "pageHeight": str(HEIGHT), "grid": "1", "gridSize": "10"})
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    def cell(key, value, x, y, w, h, style):
        obj = ET.SubElement(root, "mxCell", {"id": key, "value": value, "style": "html=1;fontFamily=Arial;whiteSpace=wrap;rounded=0;"+style, "vertex": "1", "parent": "1"})
        ET.SubElement(obj, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})

    for key, x, y, w, h, title, subtitle in GROUPS:
        value = f'<b style="font-size:12.2px;">{html.escape(title)}</b><br><span style="font-size:9.5px;color:#555555;">{html.escape(subtitle)}</span>'
        cell("group-"+key, value, x, y, w, h, "fillColor=none;strokeColor=#b6b6b6;strokeWidth=0.65;align=left;verticalAlign=top;spacingLeft=12;spacingTop=9;")
    markers = {"one": "ERmandOne", "zero_one": "ERzeroToOne", "zero_many": "ERzeroToMany"}
    for i, link in enumerate(LINKS):
        parent, child = BY_NAME[link["parent"]], BY_NAME[link["child"]]
        p, q = link["points"][0], link["points"][-1]
        fk = link["kind"] == "fk"
        style = f"edgeStyle=segmentEdgeStyle;rounded=0;strokeWidth=0.8;dashed={0 if fk else 1};dashPattern=4 3;strokeColor={'#222222' if fk else '#666666'};startArrow={markers[link['parent_card']] if fk else 'none'};endArrow={markers[link['child_card']] if fk else 'none'};startSize=16;endSize=16;exitX={(p[0]-parent['x'])/parent['w']};exitY={(p[1]-parent['y'])/parent['h']};entryX={(q[0]-child['x'])/child['w']};entryY={(q[1]-child['y'])/child['h']};exitPerimeter=0;entryPerimeter=0;"
        edge = ET.SubElement(root, "mxCell", {"id": f"edge-{i}", "source": parent["name"], "target": child["name"], "style": style, "edge": "1", "parent": "1"})
        geom = ET.SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
        arr = ET.SubElement(geom, "Array", {"as": "points"})
        for x, y in link["points"][1:-1]:
            ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})
    for t in TABLES:
        rows = []
        for field in t["fields"]:
            key, label = field_label(t, field)
            rows.append(f'<tr><td style="width:36px;border-right:1px solid #b6b6b6;font-size:7.3px;padding-left:4px;">{key}</td><td style="padding-left:6px;">{html.escape(label)}</td></tr>')
        val = f'<div style="font-family:Arial;"><div style="background:#eeeeee;border-bottom:1px solid #222222;padding:4px 7px;"><b style="font-size:10.3px;">{html.escape(t["title"])}</b><br><span style="font-size:7.8px;color:#555555;">{html.escape(t["name"])}</span></div><table style="font-size:8.9px;line-height:12px;width:100%;border-collapse:collapse;">{"".join(rows)}</table></div>'
        cell(t["name"], val, t["x"], t["y"], t["w"], t["h"], "strokeColor=#222222;fillColor=#ffffff;strokeWidth=0.8;align=left;verticalAlign=top;spacing=0;overflow=fill;")
    for i, item in enumerate(D.items):
        if item[0] != "text":
            continue
        _, x, y, value, size, bold, color, align = item
        if any(t["x"] <= x < t["x"]+t["w"] and t["y"] <= y <= t["y"]+t["h"] for t in TABLES):
            continue
        if value in {group[-1] for group in GROUPS} | {group[-2] for group in GROUPS}:
            continue
        width = max(75, min(547, len(value)*size*0.55+10))
        cell(f"note-{i}", html.escape(value), x-width if align == "right" else x, y-size, width, size+4, f"text;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;fontSize={size};fontStyle={1 if bold else 0};fontColor={color};spacing=0;")
    return diagram


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


def write_svg(path, title, description):
    base.write_svg(path)
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    svg = ET.parse(path)
    svg.find("{http://www.w3.org/2000/svg}title").text = title
    svg.find("{http://www.w3.org/2000/svg}desc").text = description
    svg.write(path, encoding="utf-8", xml_declaration=True)


def build():
    verify()
    out = base.ROOT / "output/pdf"
    out.mkdir(parents=True, exist_ok=True)
    draw()
    base.write_pdf(out / "core2-erd-simple.pdf")
    write_svg(HERE / "core2-erd-simple.svg", "Core-2: Final One-Page ERD", "Five Operations modules, shared AI records and the separate Tracking database. Fourteen selected tables. Solid lines are foreign keys; dashed links are application references.")
    xml = ET.ElementTree(ET.Element("mxfile", {"host":"app.diagrams.net"}))
    xml.getroot().append(write_drawio_diagram())
    ET.indent(xml, space="  ")
    xml.write(HERE / "core2-erd-simple.drawio", encoding="utf-8", xml_declaration=True)
    manifest = {"revision":"2026-09-17", "scope":"Final one-page two-service ERD, selected fields and relationships", "pages":[{"title":"Core-2 ERD", "tables":TABLES, "relationships":LINKS}]}
    (HERE / "core2-erd-simple.schema.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    assert len(PdfReader(out / "core2-erd-simple.pdf").pages) == 1
    print(json.dumps({"pages":1,"services":2,"tables":len(TABLES),"fk_links":sum(l["kind"]=="fk" for l in LINKS),"reference_links":sum(l["kind"]!="fk" for l in LINKS)}))


if __name__ == "__main__":
    build()
