import React, { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import {
    getEquipmentPresentation,
    resolveDesignatedEquipmentType,
} from '../../utils/equipmentClassification';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

export type CraneEquipmentFilter =
    'all' | 'mobile_crane' | 'tower_crane' | 'carrier';

export interface DefectItem {
    id: string;
    label: string;
    categoryKey: string;
    categoryTitle: string;
    critical?: boolean;
}

export interface DefectCategoryGroup {
    key: string;
    title: string;
    applicableTo?: ('mobile_crane' | 'tower_crane' | 'carrier')[];
    items: DefectItem[];
}

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
                label: 'Trolley In / Out Travel Limit Switches',
                categoryKey: 'crane_lmi_safety',
                categoryTitle: 'Crane Safety Devices, LMI & Limits',
                critical: true,
            },
            {
                id: 'crane_anti_collision_system',
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
                label: 'Belts Hoses',
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
];

export interface DvirDefectsModalProps {
    visible: boolean;
    selectedDefectIds: string[];
    initialEquipmentFilter?: CraneEquipmentFilter;
    designatedEquipment?: CraneEquipmentFilter;
    assetCode?: string;
    assetName?: string;
    assetKind?: string;
    onClose: () => void;
    onApplyDefects: (selectedIds: string[]) => void;
}

export const DvirDefectsModal: React.FC<DvirDefectsModalProps> = ({
    visible,
    selectedDefectIds,
    initialEquipmentFilter,
    designatedEquipment,
    assetCode,
    assetName,
    assetKind,
    onClose,
    onApplyDefects,
}) => {
    const { isDarkHud } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const effectiveEquipmentType = useMemo(() => {
        if (designatedEquipment && designatedEquipment !== 'all') {
            return designatedEquipment;
        }

        if (initialEquipmentFilter && initialEquipmentFilter !== 'all') {
            return initialEquipmentFilter;
        }

        return resolveDesignatedEquipmentType({
            assetCode,
            assetName,
            assetKind,
        });
    }, [
        designatedEquipment,
        initialEquipmentFilter,
        assetCode,
        assetName,
        assetKind,
    ]);

    const presentation = useMemo(
        () => getEquipmentPresentation(effectiveEquipmentType),
        [effectiveEquipmentType],
    );

    const defaultFilter: CraneEquipmentFilter = useMemo(() => {
        if (initialEquipmentFilter) {
            return initialEquipmentFilter;
        }

        return effectiveEquipmentType;
    }, [initialEquipmentFilter, effectiveEquipmentType]);

    const [equipmentFilter, setEquipmentFilter] =
        useState<CraneEquipmentFilter>(defaultFilter);
    const [localSelectedIds, setLocalSelectedIds] =
        useState<string[]>(selectedDefectIds);
    const [collapsedCategories, setCollapsedCategories] = useState<
        Record<string, boolean>
    >({});
    const [prevSync, setPrevSync] = useState({
        selectedDefectIds,
        visible,
        initialEquipmentFilter,
        designatedEquipment,
        assetCode,
    });

    if (
        prevSync.visible !== visible ||
        prevSync.selectedDefectIds !== selectedDefectIds ||
        prevSync.initialEquipmentFilter !== initialEquipmentFilter ||
        prevSync.designatedEquipment !== designatedEquipment ||
        prevSync.assetCode !== assetCode
    ) {
        setPrevSync({
            selectedDefectIds,
            visible,
            initialEquipmentFilter,
            designatedEquipment,
            assetCode,
        });
        setLocalSelectedIds(selectedDefectIds);
        setSearchQuery('');
        setEquipmentFilter(defaultFilter);
    }

    const handleToggleDefect = (id: string) => {
        setLocalSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id],
        );
    };

    const handleToggleCategory = (categoryKey: string) => {
        setCollapsedCategories((prev) => ({
            ...prev,
            [categoryKey]: !prev[categoryKey],
        }));
    };

    const filteredGroups = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const groupsMatchingFilter =
            equipmentFilter === 'all'
                ? DVIR_DEFECT_CATEGORIES
                : DVIR_DEFECT_CATEGORIES.filter(
                      (group) =>
                          !group.applicableTo ||
                          group.applicableTo.includes(equipmentFilter),
                  );

        if (!query) {
            return groupsMatchingFilter;
        }

        const baseGroups =
            equipmentFilter === 'all'
                ? DVIR_DEFECT_CATEGORIES
                : groupsMatchingFilter;

        return baseGroups
            .map((group) => {
                const matchedItems = group.items.filter(
                    (item) =>
                        item.label.toLowerCase().includes(query) ||
                        group.title.toLowerCase().includes(query),
                );

                return {
                    ...group,
                    items: matchedItems,
                };
            })
            .filter((group) => group.items.length > 0);
    }, [equipmentFilter, searchQuery]);

    const handleDone = () => {
        onApplyDefects(localSelectedIds);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent={false}
            visible={visible}
        >
            <SafeAreaView
                style={[styles.modalRoot, isDarkHud && styles.darkModalRoot]}
                testID="defects-modal-container"
            >
                {/* Header with Search and Done */}
                <View
                    style={[
                        styles.headerContainer,
                        isDarkHud && styles.darkHeaderContainer,
                    ]}
                >
                    <View style={styles.headerTopRow}>
                        <Pressable
                            accessibilityLabel="Close defects modal"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.closeBtn}
                            testID="defects-modal-close"
                        >
                            <Icon
                                color={isDarkHud ? '#94A3B8' : colors.text}
                                name="close"
                                size={22}
                            />
                        </Pressable>

                        <Text
                            style={[
                                styles.headerTitle,
                                isDarkHud && styles.darkHeaderTitle,
                            ]}
                            testID="defects-modal-title"
                        >
                            {presentation.modalTitle}
                        </Text>

                        <Pressable
                            accessibilityLabel="Apply selected defects"
                            accessibilityRole="button"
                            onPress={handleDone}
                            style={styles.doneBtn}
                            testID="defects-modal-done"
                        >
                            <Text
                                style={[
                                    styles.doneBtnText,
                                    isDarkHud && styles.darkDoneBtnText,
                                ]}
                            >
                                Done{' '}
                                {localSelectedIds.length > 0
                                    ? `(${localSelectedIds.length})`
                                    : ''}
                            </Text>
                        </Pressable>
                    </View>

                    {/* Designated Asset Context Banner */}
                    {assetCode || assetName ? (
                        <View
                            style={[
                                styles.assetContextBanner,
                                isDarkHud && styles.darkAssetContextBanner,
                            ]}
                            testID="designated-asset-banner"
                        >
                            <Text style={styles.assetContextIcon}>
                                {presentation.icon}
                            </Text>
                            <View style={styles.assetContextDetails}>
                                <View style={styles.assetContextRow}>
                                    <Text
                                        style={[
                                            styles.assetContextCode,
                                            isDarkHud &&
                                                styles.darkAssetContextCode,
                                        ]}
                                    >
                                        {assetCode || 'DESIGNATED UNIT'}
                                    </Text>
                                    <View
                                        style={[
                                            styles.designatedBadge,
                                            isDarkHud &&
                                                styles.darkDesignatedBadge,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.designatedBadgeText,
                                                isDarkHud &&
                                                    styles.darkDesignatedBadgeText,
                                            ]}
                                        >
                                            {presentation.designatedBadgeLabel}
                                        </Text>
                                    </View>
                                </View>
                                {assetName ? (
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.assetContextName,
                                            isDarkHud &&
                                                styles.darkAssetContextName,
                                        ]}
                                    >
                                        {assetName}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    {/* Search Bar matching screenshot */}
                    <View
                        style={[
                            styles.searchBarWrapper,
                            isDarkHud && styles.darkSearchBarWrapper,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#64748B' : colors.muted}
                            name="search"
                            size={18}
                        />
                        <TextInput
                            accessibilityLabel="Search defects"
                            autoCapitalize="none"
                            autoCorrect={false}
                            clearButtonMode="while-editing"
                            onChangeText={setSearchQuery}
                            placeholder={presentation.searchPlaceholder}
                            placeholderTextColor={
                                isDarkHud ? '#64748B' : colors.muted
                            }
                            style={[
                                styles.searchInput,
                                isDarkHud && styles.darkSearchInput,
                            ]}
                            testID="defects-search-input"
                            value={searchQuery}
                        />
                        {searchQuery ? (
                            <Pressable
                                accessibilityLabel="Clear search"
                                onPress={() => setSearchQuery('')}
                                style={styles.clearSearchBtn}
                            >
                                <Icon
                                    color={isDarkHud ? '#94A3B8' : colors.muted}
                                    name="close"
                                    size={16}
                                />
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Equipment Filter Pills */}
                    <View style={styles.filterPillsContainer}>
                        <ScrollView
                            contentContainerStyle={styles.filterPillsContent}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                        >
                            {(
                                [
                                    {
                                        key: 'all',
                                        label: 'All Categories',
                                        testID: 'filter-all',
                                    },
                                    {
                                        key: 'mobile_crane',
                                        label: `🏗️ Mobile Crane${effectiveEquipmentType === 'mobile_crane' ? ' (Designated)' : ''}`,
                                        testID: 'filter-mobile-crane',
                                    },
                                    {
                                        key: 'tower_crane',
                                        label: `🗼 Tower Crane${effectiveEquipmentType === 'tower_crane' ? ' (Designated)' : ''}`,
                                        testID: 'filter-tower-crane',
                                    },
                                    {
                                        key: 'carrier',
                                        label: `🚛 Carrier & Road${effectiveEquipmentType === 'carrier' ? ' (Designated)' : ''}`,
                                        testID: 'filter-carrier',
                                    },
                                ] as const
                            ).map((filterOpt) => {
                                const isActive =
                                    equipmentFilter === filterOpt.key;

                                return (
                                    <Pressable
                                        accessibilityLabel={`Filter ${filterOpt.label}`}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: isActive,
                                        }}
                                        key={filterOpt.key}
                                        onPress={() =>
                                            setEquipmentFilter(filterOpt.key)
                                        }
                                        style={[
                                            styles.filterPill,
                                            isDarkHud && styles.darkFilterPill,
                                            isActive && styles.filterPillActive,
                                            isDarkHud &&
                                                isActive &&
                                                styles.darkFilterPillActive,
                                        ]}
                                        testID={filterOpt.testID}
                                    >
                                        <Text
                                            style={[
                                                styles.filterPillText,
                                                isDarkHud &&
                                                    styles.darkFilterPillText,
                                                isActive &&
                                                    styles.filterPillTextActive,
                                            ]}
                                        >
                                            {filterOpt.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>

                {/* Defect Categories & Items List */}
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    style={styles.scrollView}
                >
                    {filteredGroups.length === 0 ? (
                        <View style={styles.noResultsBox}>
                            <Text style={styles.noResultsText}>
                                No defects found matching "{searchQuery}"
                            </Text>
                        </View>
                    ) : (
                        filteredGroups.map((group) => {
                            const isCollapsed =
                                !searchQuery && collapsedCategories[group.key];
                            const selectedCountInGroup = group.items.filter(
                                (item) => localSelectedIds.includes(item.id),
                            ).length;

                            return (
                                <View
                                    key={group.key}
                                    style={[
                                        styles.categorySection,
                                        isDarkHud && styles.darkCategorySection,
                                    ]}
                                    testID={`category-section-${group.key}`}
                                >
                                    {/* Category Header Accordion */}
                                    <Pressable
                                        accessibilityLabel={`${group.title} category, ${group.items.length} items`}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            handleToggleCategory(group.key)
                                        }
                                        style={[
                                            styles.categoryHeaderRow,
                                            isDarkHud &&
                                                styles.darkCategoryHeaderRow,
                                        ]}
                                    >
                                        <View style={styles.categoryTitleGroup}>
                                            <Text
                                                style={[
                                                    styles.categoryTitle,
                                                    isDarkHud &&
                                                        styles.darkCategoryTitle,
                                                ]}
                                            >
                                                {group.title}
                                            </Text>
                                            {selectedCountInGroup > 0 ? (
                                                <View
                                                    style={
                                                        styles.groupSelectedBadge
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.groupSelectedBadgeText
                                                        }
                                                    >
                                                        {selectedCountInGroup}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Icon
                                            color={
                                                isDarkHud
                                                    ? '#94A3B8'
                                                    : '#64748B'
                                            }
                                            name={
                                                isCollapsed
                                                    ? 'chevron-down'
                                                    : 'chevron-up'
                                            }
                                            size={18}
                                        />
                                    </Pressable>

                                    {/* Category Checklist Items */}
                                    {!isCollapsed ? (
                                        <View
                                            style={[
                                                styles.itemList,
                                                isDarkHud &&
                                                    styles.darkItemList,
                                            ]}
                                        >
                                            {group.items.map((item) => {
                                                const isSelected =
                                                    localSelectedIds.includes(
                                                        item.id,
                                                    );

                                                return (
                                                    <Pressable
                                                        key={item.id}
                                                        accessibilityLabel={`${item.label}, ${isSelected ? 'selected as defect' : 'not selected'}`}
                                                        accessibilityRole="checkbox"
                                                        accessibilityState={{
                                                            checked: isSelected,
                                                        }}
                                                        onPress={() =>
                                                            handleToggleDefect(
                                                                item.id,
                                                            )
                                                        }
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.itemRow,
                                                            isDarkHud &&
                                                                styles.darkItemRow,
                                                            isSelected &&
                                                                styles.itemRowSelected,
                                                            isDarkHud &&
                                                                isSelected &&
                                                                styles.darkItemRowSelected,
                                                            pressed &&
                                                                styles.pressed,
                                                        ]}
                                                        testID={`defect-item-${item.id}`}
                                                    >
                                                        {/* Rounded Checkbox */}
                                                        <View
                                                            style={[
                                                                styles.checkbox,
                                                                isDarkHud &&
                                                                    styles.darkCheckbox,
                                                                isSelected &&
                                                                    styles.checkboxSelected,
                                                            ]}
                                                        >
                                                            {isSelected ? (
                                                                <Icon
                                                                    color="#FFFFFF"
                                                                    name="check"
                                                                    size={14}
                                                                />
                                                            ) : null}
                                                        </View>

                                                        <Text
                                                            style={[
                                                                styles.itemLabel,
                                                                isDarkHud &&
                                                                    styles.darkItemLabel,
                                                                isSelected &&
                                                                    (isDarkHud
                                                                        ? styles.darkItemLabelSelected
                                                                        : styles.itemLabelSelected),
                                                            ]}
                                                        >
                                                            {item.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* Bottom Confirmation Bar */}
                <View
                    style={[
                        styles.bottomBar,
                        isDarkHud && styles.darkBottomBar,
                    ]}
                >
                    <Pressable
                        accessibilityLabel="Save vehicle defects"
                        accessibilityRole="button"
                        onPress={handleDone}
                        style={({ pressed }) => [
                            styles.applyButton,
                            pressed && styles.pressed,
                        ]}
                        testID="defects-apply-btn"
                    >
                        <Text style={styles.applyButtonText}>
                            {localSelectedIds.length > 0
                                ? `Confirm ${localSelectedIds.length} Defect${localSelectedIds.length > 1 ? 's' : ''}`
                                : 'No Defects (Certified Safe)'}
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkModalRoot: {
        backgroundColor: '#090D16',
    },
    headerContainer: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        paddingBottom: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    darkHeaderContainer: {
        backgroundColor: '#0F1A2E',
        borderBottomColor: '#1E293B',
    },
    headerTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    closeBtn: {
        alignItems: 'center',
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    darkHeaderTitle: {
        color: '#F8FAFC',
    },
    doneBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    doneBtnText: {
        color: colors.amber,
        fontSize: 15,
        fontWeight: '800',
    },
    darkDoneBtnText: {
        color: '#F59E0B',
    },
    searchBarWrapper: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        height: 42,
        paddingHorizontal: 12,
    },
    darkSearchBarWrapper: {
        backgroundColor: '#131F33',
        borderColor: '#1E3A5F',
    },
    searchInput: {
        color: colors.text,
        flex: 1,
        fontSize: 15,
        height: '100%',
    },
    darkSearchInput: {
        color: '#F8FAFC',
    },
    clearSearchBtn: {
        padding: 4,
    },
    filterPillsContainer: {
        marginTop: 10,
    },
    filterPillsContent: {
        gap: 8,
        paddingHorizontal: 2,
    },
    filterPill: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkFilterPill: {
        backgroundColor: '#131F33',
        borderColor: '#1E293B',
    },
    filterPillActive: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    darkFilterPillActive: {
        backgroundColor: '#B45309',
        borderColor: '#F59E0B',
    },
    filterPillText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    darkFilterPillText: {
        color: '#94A3B8',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    categorySection: {
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
    },
    darkCategorySection: {
        borderBottomColor: '#1E293B',
    },
    categoryHeaderRow: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    darkCategoryHeaderRow: {
        backgroundColor: '#0D172A',
        borderBottomColor: '#1E293B',
    },
    categoryTitleGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    categoryTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    darkCategoryTitle: {
        color: '#CBD5E1',
    },
    groupSelectedBadge: {
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        minWidth: 20,
        paddingHorizontal: 6,
    },
    groupSelectedBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    itemList: {
        backgroundColor: colors.surface,
    },
    darkItemList: {
        backgroundColor: '#0A1120',
    },
    itemRow: {
        alignItems: 'center',
        borderBottomColor: colors.borderSubtle,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 14,
        minHeight: 52,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    darkItemRow: {
        borderBottomColor: '#131F35',
    },
    itemRowSelected: {
        backgroundColor: colors.amberLight,
    },
    darkItemRowSelected: {
        backgroundColor: '#351F05',
    },
    checkbox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 1.5,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    darkCheckbox: {
        backgroundColor: '#1E293B',
        borderColor: '#475569',
    },
    checkboxSelected: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    itemLabel: {
        color: colors.text,
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    darkItemLabel: {
        color: '#E2E8F0',
    },
    itemLabelSelected: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    darkItemLabelSelected: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    noResultsBox: {
        alignItems: 'center',
        padding: 32,
    },
    noResultsText: {
        color: colors.secondary,
        fontSize: 14,
        textAlign: 'center',
    },
    bottomBar: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        padding: 16,
    },
    darkBottomBar: {
        backgroundColor: '#0F1A2E',
        borderTopColor: '#1E293B',
    },
    applyButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 48,
        width: '100%',
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.8,
    },
    assetContextBanner: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkAssetContextBanner: {
        backgroundColor: '#131F35',
        borderColor: '#1E293B',
    },
    assetContextIcon: {
        fontSize: 24,
    },
    assetContextDetails: {
        flex: 1,
    },
    assetContextRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    assetContextCode: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkAssetContextCode: {
        color: '#F1F5F9',
    },
    assetContextName: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    darkAssetContextName: {
        color: '#94A3B8',
    },
    designatedBadge: {
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderColor: 'rgba(217, 119, 6, 0.3)',
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    darkDesignatedBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderColor: 'rgba(251, 191, 36, 0.35)',
    },
    designatedBadgeText: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    darkDesignatedBadgeText: {
        color: '#FBBF24',
    },
});
