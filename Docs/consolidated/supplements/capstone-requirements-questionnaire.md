# BSIT Capstone System Requirements Questionnaire

**Project:** Crane and Trucking Management System (Core Transaction 2 – Operations, Dispatch, and Resource Management)  
**Institution:** Bestlink College of the Philippines  
**Document Status:** Empirical Field Survey & System Requirements Baseline  
**Source:** Academic Capstone Requirements Gathering Questionnaire  
**Source Artifact:** [capstone-requirements-questionnaire.pdf](./capstone-requirements-questionnaire.pdf)  

---

## Overview

This document records the empirical field survey responses gathered from operational personnel for the BSIT Capstone Project at Bestlink College of the Philippines. The questionnaire evaluates current baseline processes, operational pain points, resource constraints, and required system capabilities for the proposed Crane and Trucking Management System (Core Transaction 2).

---

## Section A: Dispatch Job and Scheduling (Real-Time Activation)

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **How are customer jobs currently scheduled?** | `using activity calender generated thru excel calender at onedrive` | Current scheduling relies on manual cloud spreadsheet calendars, lacking real-time validation or conflict prevention. |
| **Who is responsible for scheduling crane and trucking operations?** | `Operations manager` | Operations Manager holds central dispatch authority. |
| **What information is required before scheduling a job?** | • Customer Name<br>• Project Location<br>• Date<br>• Equipment Needed<br>• Estimated Duration | Baseline intake parameters required before creating a draft dispatch job. |
| **How do you know whether a crane or truck is available for a new booking?** | `confirmation and calender schedule` | Manual confirmation against static calendar schedules. |
| **Have you experienced scheduling conflicts or double bookings?** | `frequently` | **High Pain Point:** Double-booking occurs frequently due to unvalidated manual scheduling. |
| **If yes, what usually causes these conflicts?** | `lack of manpower/equipment` | Shortage of available personnel or equipment combined with manual tracking. |
| **How are schedule changes communicated to drivers and operators?** | • phone call<br>• message<br>• viber<br>• face to face | Unstructured multi-channel communication (calls, messaging apps, Viber, in-person). |
| **What challenges do you experience during dispatch scheduling?** | `late arrival, broken equipment` | Operational delays caused by unannounced late arrivals and unmonitored equipment breakdowns. |

---

## Section B: Assign Driver / Operator and Equipment

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **How do you assign drivers and crane operators to a job?** | `per schedule` | Manual matching based on existing calendar schedule. |
| **Who approves the assignment?** | `operations manager` | Operations Manager retains sole approval authority over driver/operator assignments. |
| **What factors do you consider before assigning equipment?** | • Equipment Availability<br>• Equipment Capacity<br>• Operator Availability<br>• Driver Availability<br>• Location<br>• Customer Request | Multi-factor eligibility checks required prior to equipment deployment. |
| **How do you verify that assigned personnel are qualified to operate specific equipment?** | `Hr records/201 file` | Manual verification via physical HR records / 201 files. |
| **What happens if an assigned driver or operator becomes unavailable?** | `assign rescue, source for different provider` | Ad-hoc rescue dispatch or sub-contracting/sourcing external providers. |
| **How are assignments communicated to field personnel?** | `phone call, messneger` | Communication via phone calls and consumer messaging apps (Messenger). |
| **What problems do you encounter during personnel assignment?** | `delays` | Assignment bottlenecks and communication delays. |

---

## Section C: Fleet Management

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **How do you currently monitor your fleet?** | `messenger, phone calls` | Fleet status is tracked informally through phone calls and messaging apps. |
| **Do you use GPS tracking?** | `yes` | GPS tracking is implemented in the organization. |
| **How do you know the real-time location of your trucks?** | `only for service vehicles` | Real-time tracking is currently restricted to service vehicles, leaving heavy equipment untracked. |
| **How do you monitor completed and ongoing trips?** | `messenger, app, call` | Manual check-ins via app, phone call, or messaging. |
| **How do you record trip history?** | `thru activity monitoring form` | Paper/digital activity monitoring forms. |
| **Which fleet information would you like to monitor in one system?** | • Current Location<br>• Fuel Usage<br>• Vehicle Status<br>• Trip History<br>• Maintenance Schedule<br>• Availability<br>• Utilization | **Core System Requirement:** Unified dashboard combining location, status, maintenance, fuel, and asset utilization. |

---

## Section D: Crane and Equipment Management

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **How do you monitor crane availability?** | `thru equipment schedule and deployment` | Availability tracked via equipment schedule and deployment logs. |
| **How do you record equipment usage?** | `yes` | Equipment usage records are maintained. |
| **How do you know when equipment requires maintenance?** | `equipment maintenance schedule` | Driven by static equipment maintenance schedules. |
| **Do you maintain maintenance records?** | `yes` | Maintenance history is recorded. |
| **What information do you record for each crane or equipment unit?** | • Plate Number<br>• Serial Number<br>• Equipment Type<br>• Capacity<br>• Purchase Date<br>• Maintenance History<br>• Current Status | Required fields for asset management registry. |
| **Have you experienced equipment breakdown during operations?** | `sometime` | Breakdowns occur periodically during active jobs. |
| **If yes, what were the common causes?** | `hydraulic leaks, electrical system issues, worn out parts` | Key mechanical/electrical failure modes requiring tracking and maintenance alerts. |
| **What improvements would you like for equipment management?** | `equipment monitoring system` | System requirement for automated equipment monitoring and maintenance alerts. |

---

## Section E: Fuel Management

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **How often is fuel consumption monitored?** | `weekly` | Fuel auditing occurs on a weekly cycle. |
| **Do you compare expected fuel consumption with actual fuel usage?** | `yes` | Variance analysis between expected and actual fuel usage is required. |
| **Have you experienced fuel-related issues?** | • Excessive Fuel Consumption | **Key Issue:** Excessive fuel consumption identified as primary fuel pain point. |
| **What reports do you currently generate regarding fuel usage?** | `weekly fuel consumption` | Weekly fuel consumption reporting required. |

---

## Section F: Overall System Requirements

| Question | Survey Response / Selected Options | Operational Context & Analysis |
| --- | --- | --- |
| **What are the biggest challenges you experience in dispatch and resource management?** | `availability of loading equipment and operator` | Resource constraints (equipment and operator availability) cause major dispatch delays. |
| **Which process takes the most time?** | `waiting` | Idle time / waiting time is the single largest operational friction point. |
| **If a new dispatch management system is implemented, what features are most important to you?** | • GPS Tracking<br>• Dispatch Dashboard<br>• Fuel Monitoring<br>• Maintenance Alerts<br>• Reports | **Must-Have Features:** Real-time tracking, dispatch dashboard, fuel tracking, maintenance alerts, and operational reports. |
| **Is there any additional feature you would like this system to include?** | `equipment location and status` | Real-time monitoring of equipment location and operational status. |

---

## Synthesis for CT2 Architecture & PRD

1. **Scheduling & Conflict Prevention:** Empirical evidence confirms frequent double-booking when using Excel/OneDrive calendars. CT2's automated collision detection (personnel and asset availability checks) directly solves this core pain point.
2. **Resource Intake Requirements:** Job creation must mandate Customer Name, Project Location, Date, Equipment Type/Capacity, and Estimated Duration.
3. **Qualification Verification:** Manual HR/201 file checks are replaced by CT2 server-side validation of driver license expiry and operator certification limits.
4. **Unified Fleet & Equipment Monitoring:** Heavy equipment and service vehicle status, location, maintenance schedules, and utilization must be aggregated into a single operational workspace (Dispatch Dashboard).
5. **Fuel & Maintenance Control:** Weekly fuel consumption reporting, expected vs. actual variance analysis, and maintenance alert triggers for hydraulic, electrical, and mechanical wear directly respond to operational failure modes.
