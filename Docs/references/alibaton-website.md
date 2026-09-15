# Alibaton website reference

**Reviewed:** 2026-09-15

**Primary source:** [Alibaton Construction Inc.](https://alibaton.com.ph/)

**Status:** External reference for equipment research, imagery, terminology, and design inspiration. This is not an implementation specification or a verified fleet inventory.

## Purpose and scope

Use Alibaton's public website when preparing equipment examples, choosing relevant construction imagery, and aligning Core-2 with the company's identity. The website presents rental, sales, lifting support, fit-out, and waterproofing activities. [Source: company profile](https://alibaton.com.ph/about/).

Core-2's existing product documents remain authoritative for operational scope. In this workspace, consult `Docs/product/alibaton-business-scope.md` and `Docs/design/Design.md`; these local documents may be absent from a fresh checkout because they are Git-ignored. Core 1 owns commercial and customer transactions; Core-2 processes their operational handoffs. Public quotation and marketing flows do not establish new Core-2 requirements.

## Source map

| Page | Reference material | Review result |
| --- | --- | --- |
| [Home](https://alibaton.com.ph/) | Brand presentation, navigation, service overview, featured photography | Read and visually inspected |
| [Equipment](https://alibaton.com.ph/products/) | Crane categories, model tables, additional equipment, supported brands | Read in live browser; hero visually inspected |
| [Services](https://alibaton.com.ph/services/) | Field-service terminology and support activities | Text reviewed |
| [Projects](https://alibaton.com.ph/projects/) | Project/model pairings, published dimensions, image links | Read in live browser |
| [About](https://alibaton.com.ph/about/) | Company background and business positioning | Text reviewed |

The web reader initially returned a suspended-page redirect for Equipment and a 404 for Projects. Both pages subsequently loaded through the live browser. These initial results are retrieval limitations, not evidence that the pages are unavailable. The reviewed pages displayed content version 2.1, August 2026. Recheck sources before updating production data.

## Equipment reference

### Categories and brands

The [equipment page](https://alibaton.com.ph/products/) lists:

- Tower cranes: luffing, topless, and hammerhead.
- Gantry cranes.
- Construction hoists for people and materials.
- Mobile cranes.
- Heavy equipment, without a detailed model list for that category.

It names LiuGong, SCM, XCMG, and Potain by Manitowoc as supplied or supported brands, subject to requirements and availability. Do not infer a manufacturer for an individual model from this general brand list. Hammerhead equipment is described as available through alternative supported brands.

### Published tower-crane models

These are the figures displayed in the [equipment catalogue](https://alibaton.com.ph/products/) on the review date. Units follow the source: `t` and `m`.

| Type | Model | Published maximum load (t) | Published maximum radius (m) |
| --- | --- | ---: | ---: |
| Luffing | JHD140N-8 | 8 | 50 |
| Luffing | JHD140N-10 | 10 | 50 |
| Luffing | JHD190A-12 | 12 | 55 |
| Luffing | JHD190A-14 | 14 | 55 |
| Luffing | JHD200C-16 | 16 | 55 |
| Luffing | JHD300C-18 | 18 | 60 |
| Topless | JHT6013N-6 | 6 | 60 |
| Topless | JHT6017N-8 | 8 | 60 |
| Topless | JHT6515N-10 | 10 | 65 |
| Topless | JHT7025A-12 | 12 | 70 |
| Topless | JHT7527C-16 | 16 | 75 |
| Topless | JHT8024B-20 | 20 | 80 |

These independent maxima do not establish lifting capacity at maximum radius. Use approved manufacturer load charts and the actual equipment configuration for operational decisions. A catalogue entry does not establish ownership, serial number, current availability, inspection status, rental price, or readiness for dispatch.

### Selected project examples

The following examples come from the [project portfolio](https://alibaton.com.ph/projects/). They provide realistic equipment names and project contexts for reference discussions. They are separate from the catalogue above.

| Project label | Model as displayed | Type | Max capacity | Jib length | H.U.H. as displayed |
| --- | --- | --- | --- | --- | --- |
| Cement Plant Project | POTAIN MC200A | Hammerhead | 10 tons | 60 meters | 130 meters |
| Royal Pacific Residence | POTAIN MC175 | Hammerhead | 10 tons | 55 meters | 101 meters |
| Condominium Project | SCM D125 | Luffing | 10 tons | 50 meters | 145 meters |
| Cement Plant Project | POTAIN MCT385 | Topless | 20 tons | 75 meters | 131.7 meters |
| Water Reclamation Facilities | POTAIN MCT278 K12 | Topless | 12 tons | 70 meters | 23 meters |
| Factory Project | POTAIN MR608 | Luffing | 32 tons | 60 meters | 51.6 meters |

The page does not expand “H.U.H.” in the reviewed content; preserve the source label until its meaning and configuration are confirmed. Its Subway entry says `MTC278 K12`, while its Water Reclamation entry says `MCT278 K12`. Do not silently normalize this discrepancy or merge those model records without confirmation.

## Services and operational context

The [services page](https://alibaton.com.ph/services/) describes operator and rigger support, crane assembly and removal, climbing and telescoping, maintenance and repairs, equipment logistics, and technical consultation. It also covers interior finishing and waterproofing.

Suggested uses in Core-2, subject to existing requirements:

| Reference theme | Possible operational use |
| --- | --- |
| Operators and riggers | Realistic role terminology in assignment examples |
| Erection, dismantling, climbing | Representative field-work descriptions |
| Inspection and repair | Equipment history and maintenance examples |
| Logistics and yard handling | Mobilization and transport scenarios |
| Technical consultation | Context for capacity, radius, height, and site constraints |

These mappings are recommendations, not evidence that the website describes Core-2 workflows. Fit-out and waterproofing references do not authorize adding new modules.

## Visual design reference

Observed in desktop screenshots of the [homepage](https://alibaton.com.ph/) and [equipment page](https://alibaton.com.ph/products/):

| Element | Observed design | Suggested Core-2 adaptation |
| --- | --- | --- |
| Palette | Yellow accents, black/dark surfaces, white backgrounds and text | Use approved brand accents within existing semantic tokens |
| Header | White navigation band, dark lettering, yellow active underline and quotation button | Clear active navigation and a distinct primary action |
| Typography | Bold uppercase display headings; smaller sans-serif body text | Reserve display styling for brief brand surfaces; keep operational labels readable |
| Photography | Real cranes and construction sites behind a dark overlay | Use relevant imagery for asset identity or introductory surfaces |
| Hierarchy | Small yellow section labels, large headings, strong spacing | Adapt section hierarchy to compact operational screens |

These are visual observations, not extracted design tokens. Exact colors, font families, spacing values, responsive behavior, and accessibility compliance were not measured.

Keep the existing light-first operational design, compact data presentation, keyboard support, focus indicators, and text labels for statuses. Large photographic heroes and promotional slides are references for brand presentation; evaluate their usefulness separately for dispatch and field workflows. Brand yellow must not make warning and availability states ambiguous.

## Image and asset reference register

These direct image destinations were exposed by the reviewed pages. They are source pointers; image files were not downloaded, licensed, or individually inspected at full resolution during this task.

| Reference | Source image | Potential use |
| --- | --- | --- |
| Residential crane/project scene | [Royal Pacific hero](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/royal-pacific-hero.jpg) | Brand or project mood reference |
| Subway site | [Subway image](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/subway-project-3.jpg) | Infrastructure context |
| Industrial scene | [Cement plant overview](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/cement-plant-wide.jpg) | Heavy-equipment context |
| Railway site | [Railway image](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/railway-project.jpg) | Transport/infrastructure context |
| POTAIN MC200A project card | [Cement plant project image](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/project-cement-plant-1.jpg) | Equipment/project relationship reference |
| SCM D125 project card | [Condominium project image](https://alibaton.com.ph/cms/wp-content/themes/alibaton/assets/images/condominium-project.jpg) | Luffing crane context |

For category illustrations, consult the Equipment page's luffing, topless, gantry, hoist, mobile-crane, and heavy-equipment images. The homepage also contains the company logo and client artwork.

When collecting assets for implementation, record the source page and asset URL, retrieval date, equipment depicted, dimensions, intended placement, and company approval for reuse. Prefer original company-provided files. A project photograph should not be presented as a photograph of a specific registered asset without confirming that relationship. Keep source attribution in asset metadata and provide appropriate alternative text.

## Using this reference in future work

1. Check the applicable Core-2 product/design document before selecting a reference.
2. Use this catalogue to propose realistic examples; label demonstration data clearly.
3. Confirm model spelling, manufacturer, specifications, and actual asset identity before importing operational records.
4. Obtain approved image/logo files and map colors to existing design tokens before changing UI assets.
5. Record remaining unknowns instead of inventing prices, quantities, condition, availability, certification, or operational status.
6. Refresh this document's review date and source evidence when the website changes.

No application code, database records, or runtime assets were changed as part of creating this reference.
