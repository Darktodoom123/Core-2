import type { DefectCategoryGroup } from './defect-types';

/**
 * Every DVIR defect the field client offers, grouped by area. Ids are stable:
 * saved inspections refer to them. Which groups a unit sees is decided in
 * defect-sets.ts from the unit's type.
 */
export const DVIR_DEFECT_CATEGORIES: DefectCategoryGroup[] = [
    // ==========================================
    // 1. Mobile Crane Specific Categories
    // ==========================================
    {
        key: 'mobile_crane_boom',
        title: 'Mobile Crane: Boom & Telescoping',
        applicableTo: ['mobile_crane'],
        items: [
            {
                id: 'crane_telescopic_boom',
                label: 'Telescopic Boom Sections & Wear Pads',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_boom_hoist_cylinder',
                label: 'Boom Derricking / Lift Cylinder & Holding Valves',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_boom_extension_cables',
                label: 'Telescoping Extension Cables, Chains & Tensioners',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_boom_nose_sheaves',
                label: 'Boom Head Nose Sheaves & Bearings',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_fly_jib_extension',
                label: 'Fly Jib / Lattice Extension & Locking Pins',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_boom_angle_sensor',
                label: 'Boom Angle Indicator & Length Sensors',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
                critical: true,
            },
            {
                id: 'crane_rooster_sheave',
                label: 'Auxiliary Nose Sheave (Rooster Sheave)',
                categoryKey: 'mobile_crane_boom',
                categoryTitle: 'Mobile Crane: Boom & Telescoping',
            },
        ],
    },
    {
        key: 'mobile_crane_outriggers',
        title: 'Mobile Crane: Outriggers & Leveling',
        applicableTo: ['mobile_crane'],
        items: [
            {
                id: 'crane_outrigger_beams',
                label: 'Outrigger Beams & Extension Cylinders',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
                critical: true,
            },
            {
                id: 'crane_outriggers_jacks',
                label: 'Hydraulic Jack Cylinders & Pilot Check Valves',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
                critical: true,
            },
            {
                id: 'crane_outrigger_floats',
                label: 'Outrigger Sole Pads / Steel Floats & Retaining Pins',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
            },
            {
                id: 'crane_level_inclinometer',
                label: 'Chassis Bubble Level & Electronic Inclinometer',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
                critical: true,
            },
            {
                id: 'crane_outrigger_pressure_sensors',
                label: 'Outrigger Ground Pressure & Extension Sensors',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
                critical: true,
            },
            {
                id: 'crane_outrigger_pin_locks',
                label: 'Mid-Span / Full-Extension Mechanical Lock Pins',
                categoryKey: 'mobile_crane_outriggers',
                categoryTitle: 'Mobile Crane: Outriggers & Leveling',
                critical: true,
            },
        ],
    },
    {
        key: 'mobile_crane_superstructure',
        title: 'Mobile Crane: Slewing & Upper Cab',
        applicableTo: ['mobile_crane'],
        items: [
            {
                id: 'crane_slewing_bearing',
                label: 'Slewing Ring / Turntable & Pre-Torqued Bolts',
                categoryKey: 'mobile_crane_superstructure',
                categoryTitle: 'Mobile Crane: Slewing & Upper Cab',
                critical: true,
            },
            {
                id: 'crane_swing_drive_brake',
                label: '360° Swing Drive Motor, Brake & House Lock Pin',
                categoryKey: 'mobile_crane_superstructure',
                categoryTitle: 'Mobile Crane: Slewing & Upper Cab',
                critical: true,
            },
            {
                id: 'crane_counterweight_system',
                label: 'Counterweight Slabs & Hydraulic Clamping Cylinders',
                categoryKey: 'mobile_crane_superstructure',
                categoryTitle: 'Mobile Crane: Slewing & Upper Cab',
                critical: true,
            },
            {
                id: 'crane_upper_cab_controls',
                label: 'Crane Operator Cab Glass, Joysticks & Deadman Switch',
                categoryKey: 'mobile_crane_superstructure',
                categoryTitle: 'Mobile Crane: Slewing & Upper Cab',
            },
            {
                id: 'crane_upper_apu_engine',
                label: 'Upperstructure Auxiliary Engine / PTO Hydraulic Drive',
                categoryKey: 'mobile_crane_superstructure',
                categoryTitle: 'Mobile Crane: Slewing & Upper Cab',
            },
        ],
    },

    // ==========================================
    // 2. Tower Crane Specific Categories
    // ==========================================
    {
        key: 'tower_crane_mast',
        title: 'Tower Crane: Mast, Anchors & Ties',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_mast_anchors',
                label: 'Foundation Fixing Stools, Anchor Bolts & Base Grout',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
                critical: true,
            },
            {
                id: 'tower_mast_sections',
                label: 'Mast Tower Sections & Diagonal Lattice Bracing',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
                critical: true,
            },
            {
                id: 'tower_mast_pins_bolts',
                label: 'High-Tensile Mast Connection Pins & Torqued Bolts',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
                critical: true,
            },
            {
                id: 'tower_building_ties',
                label: 'Building Tie-In Struts, Collars & Anchor Brackets',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
                critical: true,
            },
            {
                id: 'tower_climbing_cage',
                label: 'Telescoping Climbing Cage & Hydraulic Jacking Unit',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
                critical: true,
            },
            {
                id: 'tower_access_ladder',
                label: 'Mast Access Ladder, Safety Cage & Rest Landings',
                categoryKey: 'tower_crane_mast',
                categoryTitle: 'Tower Crane: Mast, Anchors & Ties',
            },
        ],
    },
    {
        key: 'tower_crane_jib',
        title: 'Tower Crane: Jib & Weather-Vaning',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_main_jib_lattice',
                label: 'Main Jib Lattice Chords, Diagonals & Pin Connections',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_counter_jib_ballast',
                label: 'Counter-Jib Structure & Concrete Ballast Blocks',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_jib_pendant_ropes',
                label: 'Jib Suspension Pendant Ropes & Tie Rod Equalizer',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_slewing_drives',
                label: 'Dual Slewing Drive Motors & VFD Frequency Inverters',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_weather_vaning_brake',
                label: 'Weather-Vaning / Free-Slewing Release Mechanism & Brake',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_cathead_apex',
                label: 'A-Frame / Cathead Apex & Pendant Guide Sheaves',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
                critical: true,
            },
            {
                id: 'tower_catwalk_lifeline',
                label: 'Jib Walkway Catwalk & Continuous Fall-Arrest Lifeline',
                categoryKey: 'tower_crane_jib',
                categoryTitle: 'Tower Crane: Jib & Weather-Vaning',
            },
        ],
    },
    {
        key: 'tower_crane_trolley',
        title: 'Tower Crane: Trolley & Luffing Drive',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_trolley_winch',
                label: 'Trolley Drive Winch Motor, Brake & Gearbox',
                categoryKey: 'tower_crane_trolley',
                categoryTitle: 'Tower Crane: Trolley & Luffing Drive',
                critical: true,
            },
            {
                id: 'tower_trolley_wire_rope',
                label: 'Trolley Wire Rope, Tensioner & Rope Slack Limiter',
                categoryKey: 'tower_crane_trolley',
                categoryTitle: 'Tower Crane: Trolley & Luffing Drive',
                critical: true,
            },
            {
                id: 'tower_trolley_wheels',
                label: 'Trolley Wheels, Guide Rollers & Derailment Catches',
                categoryKey: 'tower_crane_trolley',
                categoryTitle: 'Tower Crane: Trolley & Luffing Drive',
                critical: true,
            },
            {
                id: 'tower_luffing_gear',
                label: 'Luffing Jib Drum, Rope & Safety Pawl Mechanism',
                categoryKey: 'tower_crane_trolley',
                categoryTitle: 'Tower Crane: Trolley & Luffing Drive',
                critical: true,
            },
            {
                id: 'tower_trolley_buffers',
                label: 'Trolley Rail End Buffers & Emergency Bumpers',
                categoryKey: 'tower_crane_trolley',
                categoryTitle: 'Tower Crane: Trolley & Luffing Drive',
                critical: true,
            },
        ],
    },

    // ==========================================
    // 3. Hoisting & Wire Ropes (All Cranes)
    // ==========================================
    {
        key: 'crane_hoist_rigging',
        title: 'Hoisting Winch, Wire Rope & Hook',
        applicableTo: ['mobile_crane', 'tower_crane'],
        items: [
            {
                id: 'crane_hoist_winch_drum',
                label: 'Main Hoist Winch Drum, Flanges & Rope Grooves',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_aux_winch_drum',
                label: 'Auxiliary / Whip Line Winch Drum & Brake',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_hoist_wire_rope',
                label: 'Hoist Wire Rope (Broken wires, kinking, bird-caging)',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_rope_wedge_socket',
                label: 'Wedge Socket, Thimble & Rope Termination Clips',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_hook_latch',
                label: 'Main Hook Block, Safety Latch & Trunnion Pin',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_hook_swivel',
                label: 'Hook Swivel Thrust Bearing & Throat Wear',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_sheaves_bearings',
                label: 'Load Sheave Grooves, Flange Chipping & Bearings',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
                critical: true,
            },
            {
                id: 'crane_winch_rotation_indicator',
                label: 'Drum Rotation Indicator & Cable Layering Guide',
                categoryKey: 'crane_hoist_rigging',
                categoryTitle: 'Hoisting Winch, Wire Rope & Hook',
            },
        ],
    },

    // ==========================================
    // 4. Crane Safety Systems & LMI (All Cranes)
    // ==========================================
    {
        key: 'crane_lmi_safety',
        title: 'Crane Safety Devices, LMI & Limits',
        applicableTo: ['mobile_crane', 'tower_crane'],
        items: [
            {
                id: 'crane_lmi_a2b',
                label: 'Load Moment Indicator (LMI / RCL) & A2B Alarm',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_hoist_limit_switches',
                label: 'Upper & Lower Hoist Travel Limit Switches',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_trolley_limit_switches',
                onlyFor: ['tower_crane'],
                label: 'Trolley In / Out Travel Limit Switches',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_anti_collision_system',
                onlyFor: ['tower_crane'],
                label: 'Anti-Collision Zoning & Slewing Limiters',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_anemometer_wind',
                label: 'Anemometer / Wind Speed Sensor & High-Wind Alarm',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_aviation_lights',
                label: 'Aviation Warning Beacon Lights (Boom / Tower Top)',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
            },
            {
                id: 'crane_estop_controls',
                label: 'Emergency Stop Pushbuttons (Cab & Remote Console)',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_lightning_earthing',
                label: 'Lightning Protection System & Earthing Conductor',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
        ],
    },

    // ==========================================
    // 5. Carrier, Chassis & General Roadability (Screenshot 3)
    // ==========================================
    {
        key: 'exterior_front',
        title: 'Exterior - Front',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'front_battery',
                label: 'Battery',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_belts_hoses',
                label: 'Belts & Hoses',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_defroster_heater',
                label: 'Defroster Heater',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_fluid_levels',
                label: 'Fluid Levels',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_frame_assembly',
                label: 'Frame Assembly',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
                critical: true,
            },
            {
                id: 'front_front_axle',
                label: 'Front Axle',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
                critical: true,
            },
            {
                id: 'front_lights_front',
                label: 'Lights, Front',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_oil_pressure',
                label: 'Oil Pressure',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_radiator',
                label: 'Radiator',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_starter',
                label: 'Starter',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
            },
            {
                id: 'front_transmission',
                label: 'Transmission',
                categoryKey: 'exterior_front',
                categoryTitle: 'Exterior - Front',
                critical: true,
            },
        ],
    },
    {
        key: 'exterior_sides',
        title: 'Exterior - Sides & Cab',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'side_doors_steps',
                label: 'Doors & Entry Steps',
                categoryKey: 'exterior_sides',
                categoryTitle: 'Exterior - Sides & Cab',
            },
            {
                id: 'side_fuel_tank_cap',
                label: 'Fuel Tank & Cap',
                categoryKey: 'exterior_sides',
                categoryTitle: 'Exterior - Sides & Cab',
            },
            {
                id: 'side_mirrors_windshield',
                label: 'Mirrors & Windshield',
                categoryKey: 'exterior_sides',
                categoryTitle: 'Exterior - Sides & Cab',
            },
            {
                id: 'side_exhaust_system',
                label: 'Exhaust System',
                categoryKey: 'exterior_sides',
                categoryTitle: 'Exterior - Sides & Cab',
            },
            {
                id: 'side_marker_lights',
                label: 'Side Marker Lights & Reflectors',
                categoryKey: 'exterior_sides',
                categoryTitle: 'Exterior - Sides & Cab',
            },
        ],
    },
    {
        key: 'exterior_rear',
        title: 'Exterior - Rear',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'rear_brake_lights',
                label: 'Brake Lights & Turn Signals',
                categoryKey: 'exterior_rear',
                categoryTitle: 'Exterior - Rear',
                critical: true,
            },
            {
                id: 'rear_coupling_hitch',
                label: 'Coupling / Pintle Hitch',
                categoryKey: 'exterior_rear',
                categoryTitle: 'Exterior - Rear',
                critical: true,
            },
            {
                id: 'rear_license_plate_light',
                label: 'License Plate & Rear Lights',
                categoryKey: 'exterior_rear',
                categoryTitle: 'Exterior - Rear',
            },
            {
                id: 'rear_mud_flaps',
                label: 'Mud Flaps & Splash Guards',
                categoryKey: 'exterior_rear',
                categoryTitle: 'Exterior - Rear',
            },
            {
                id: 'rear_bumper',
                label: 'Rear Bumper & Underride Guard',
                categoryKey: 'exterior_rear',
                categoryTitle: 'Exterior - Rear',
            },
        ],
    },
    {
        key: 'in_cab_controls',
        title: 'In-Cab / Controls',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'cab_steering',
                label: 'Steering Mechanism & Free Play',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
                critical: true,
            },
            {
                id: 'cab_horn_alarm',
                label: 'Horn & Backup Alarm',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
            },
            {
                id: 'cab_wipers_washer',
                label: 'Windshield Wipers & Washer',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
            },
            {
                id: 'cab_gauges_indicators',
                label: 'Gauges & Warning Indicators',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
            },
            {
                id: 'cab_seatbelts',
                label: 'Seatbelts & Cab Seating',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
            },
            {
                id: 'cab_emergency_gear',
                label: 'Emergency Gear (Fire Extinguisher, Triangles)',
                categoryKey: 'in_cab_controls',
                categoryTitle: 'In-Cab / Controls',
            },
        ],
    },
    {
        key: 'brakes_suspension',
        title: 'Brakes & Suspension',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'brake_service_brakes',
                label: 'Service Brakes / Foot Pedal',
                categoryKey: 'brakes_suspension',
                categoryTitle: 'Brakes & Suspension',
                critical: true,
            },
            {
                id: 'brake_parking_brake',
                label: 'Parking Brake / Spring Brake',
                categoryKey: 'brakes_suspension',
                categoryTitle: 'Brakes & Suspension',
                critical: true,
            },
            {
                id: 'brake_lines_hoses',
                label: 'Brake Lines & Air Hoses',
                categoryKey: 'brakes_suspension',
                categoryTitle: 'Brakes & Suspension',
                critical: true,
            },
            {
                id: 'brake_air_compressor',
                label: 'Air Compressor & Pressure Build',
                categoryKey: 'brakes_suspension',
                categoryTitle: 'Brakes & Suspension',
                critical: true,
            },
            {
                id: 'brake_suspension_springs',
                label: 'Suspension Springs & Shock Absorbers',
                categoryKey: 'brakes_suspension',
                categoryTitle: 'Brakes & Suspension',
            },
        ],
    },
    {
        key: 'tires_wheels',
        title: 'Tires & Wheels',
        applicableTo: ['carrier', 'mobile_crane'],
        items: [
            {
                id: 'tire_tread_depth',
                label: 'Tire Tread Depth & Condition',
                categoryKey: 'tires_wheels',
                categoryTitle: 'Tires & Wheels',
            },
            {
                id: 'tire_pressure',
                label: 'Tire Inflation Pressure (Baseline 120 PSI)',
                categoryKey: 'tires_wheels',
                categoryTitle: 'Tires & Wheels',
            },
            {
                id: 'tire_wheel_rims_lugs',
                label: 'Wheel Rims & Lug Nut Torque',
                categoryKey: 'tires_wheels',
                categoryTitle: 'Tires & Wheels',
                critical: true,
            },
            {
                id: 'tire_hub_oil_seals',
                label: 'Hub Seals & Bearings',
                categoryKey: 'tires_wheels',
                categoryTitle: 'Tires & Wheels',
            },
        ],
    },
    // ==========================================
    // Tower crane: cab, electrics and slewing ring.
    // DRAFT (2026-09-27): drafted to close gaps in the tower crane list.
    // Needs review by someone who inspects the company's tower cranes.
    // ==========================================
    {
        key: 'tower_crane_slewing',
        title: 'Tower Crane: Slewing Ring & Brakes',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_slewing_ring_bolts',
                label: 'Slewing Ring Bearing & Pre-Torqued Bolts',
                categoryKey: 'tower_crane_slewing',
                categoryTitle: 'Tower Crane: Slewing Ring & Brakes',
                critical: true,
            },
            {
                id: 'tower_slewing_brake',
                label: 'Slewing Brake Holding & Release',
                categoryKey: 'tower_crane_slewing',
                categoryTitle: 'Tower Crane: Slewing Ring & Brakes',
                critical: true,
            },
            {
                id: 'tower_slewing_gear_lube',
                label: 'Slewing Gear Teeth & Lubrication',
                categoryKey: 'tower_crane_slewing',
                categoryTitle: 'Tower Crane: Slewing Ring & Brakes',
            },
        ],
    },
    {
        key: 'tower_crane_cab',
        title: 'Tower Crane: Operator Cab & Controls',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_cab_joysticks_deadman',
                label: 'Joysticks, Deadman Switch & Control Response',
                categoryKey: 'tower_crane_cab',
                categoryTitle: 'Tower Crane: Operator Cab & Controls',
                critical: true,
            },
            {
                id: 'tower_cab_glass_wipers',
                label: 'Cab Glass, Wipers & Visibility',
                categoryKey: 'tower_crane_cab',
                categoryTitle: 'Tower Crane: Operator Cab & Controls',
            },
            {
                id: 'tower_cab_seat_restraint',
                label: 'Operator Seat & Cab Door Latch',
                categoryKey: 'tower_crane_cab',
                categoryTitle: 'Tower Crane: Operator Cab & Controls',
            },
            {
                id: 'tower_cab_radio_comms',
                label: 'Radio / Intercom to Signaller',
                categoryKey: 'tower_crane_cab',
                categoryTitle: 'Tower Crane: Operator Cab & Controls',
                critical: true,
            },
            {
                id: 'tower_cab_fire_extinguisher',
                label: 'Cab Fire Extinguisher',
                categoryKey: 'tower_crane_cab',
                categoryTitle: 'Tower Crane: Operator Cab & Controls',
            },
        ],
    },
    {
        key: 'tower_crane_electrical',
        title: 'Tower Crane: Electrical & Power Supply',
        applicableTo: ['tower_crane'],
        items: [
            {
                id: 'tower_main_power_cable',
                label: 'Main Power Cable, Plugs & Cable Drum',
                categoryKey: 'tower_crane_electrical',
                categoryTitle: 'Tower Crane: Electrical & Power Supply',
                critical: true,
            },
            {
                id: 'tower_isolator_panel',
                label: 'Main Isolator & Control Panel Enclosure',
                categoryKey: 'tower_crane_electrical',
                categoryTitle: 'Tower Crane: Electrical & Power Supply',
                critical: true,
            },
            {
                id: 'tower_earth_leakage',
                label: 'Earth Leakage / RCD Protection Test',
                categoryKey: 'tower_crane_electrical',
                categoryTitle: 'Tower Crane: Electrical & Power Supply',
                critical: true,
            },
            {
                id: 'tower_panel_warning_lights',
                label: 'Control Panel Fault & Warning Lights',
                categoryKey: 'tower_crane_electrical',
                categoryTitle: 'Tower Crane: Electrical & Power Supply',
            },
        ],
    },
];
