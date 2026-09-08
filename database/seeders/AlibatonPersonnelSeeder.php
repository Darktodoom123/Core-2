<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

final class AlibatonPersonnelSeeder extends Seeder
{
    /**
     * Seed employees of Alibaton Construction Incorporated with authentic Filipino names,
     * operational roles, profiles, and regulatory certifications (TESDA, DOLE-OSHC, PRC, LTO).
     */
    public function run(): void
    {
        $employees = [
            // =========================================================================
            // 1. OPERATIONS & SAFETY MANAGEMENT
            // =========================================================================
            [
                'name' => 'Engr. Ferdinand "Dante" Macaraeg',
                'email' => 'ferdinand.macaraeg@alibaton-ph.com',
                'phone' => '+63 917 812 3450',
                'role' => RoleName::OperationsManager,
                'employee_number' => 'ALB-2021-0012',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Corazon Macaraeg (Spouse)',
                'emergency_contact_phone' => '+63 917 812 3456',
                'credentials' => [
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'PRC-CE-0084512',
                        'credential_type' => 'PRC Registered Civil Engineer',
                        'issued_at' => Carbon::now()->subYears(8),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'DOLE-BWC-SO4-2023-1120',
                        'credential_type' => 'DOLE-BWC Certified Safety Officer 4',
                        'issued_at' => Carbon::now()->subYears(3),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Engr. Maricris Santos-Villanueva',
                'email' => 'maricris.villanueva@alibaton-ph.com',
                'phone' => '+63 918 923 4560',
                'role' => RoleName::OperationsManager,
                'employee_number' => 'ALB-2022-0045',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Hector Villanueva (Spouse)',
                'emergency_contact_phone' => '+63 918 923 4567',
                'credentials' => [
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'PRC-ME-0091244',
                        'credential_type' => 'PRC Professional Mechanical Engineer (PME)',
                        'issued_at' => Carbon::now()->subYears(6),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'LEEA-AP-2024-0089',
                        'credential_type' => 'LEEA Appointed Person for Lifting Operations',
                        'issued_at' => Carbon::now()->subMonths(10),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                ],
            ],
            [
                'name' => 'Arlene Joy Dizon',
                'email' => 'arlene.dizon@alibaton-ph.com',
                'phone' => '+63 920 445 6780',
                'role' => RoleName::OperationsManager,
                'employee_number' => 'ALB-2023-0102',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Renato Dizon (Father)',
                'emergency_contact_phone' => '+63 920 445 6789',
                'credentials' => [],
            ],

            // =========================================================================
            // 2. TOWER CRANE OPERATORS (High-Rise Stationary Fleet)
            // =========================================================================
            [
                'name' => 'Rodrigo "Digong" Alcantara',
                'email' => 'rodrigo.alcantara@alibaton-ph.com',
                'phone' => '+63 927 334 1120',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2020-0088',
                'availability_status' => 'assigned',
                'emergency_contact_name' => 'Lourdes Alcantara (Spouse)',
                'emergency_contact_phone' => '+63 927 334 1122',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-TWR-2023-0412',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Tower Crane)',
                        'issued_at' => Carbon::now()->subYears(2),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'OSHC-WAH-2024-5512',
                        'credential_type' => 'DOLE-OSHC Certified Working at Heights Competent Person',
                        'issued_at' => Carbon::now()->subMonths(8),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N01-14-883921',
                        'credential_type' => 'LTO Professional Driver License (RC 2, 3, 8)',
                        'issued_at' => Carbon::now()->subYears(3),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                ],
            ],
            [
                'name' => 'Danilo "Danny" Soriano',
                'email' => 'danilo.soriano@alibaton-ph.com',
                'phone' => '+63 917 556 7888',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2021-0145',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Teresa Soriano (Spouse)',
                'emergency_contact_phone' => '+63 917 556 7890',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-TWR-2024-0981',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Tower Crane)',
                        'issued_at' => Carbon::now()->subMonths(14),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N02-16-994120',
                        'credential_type' => 'LTO Professional Driver License (RC 2, 8)',
                        'issued_at' => Carbon::now()->subYears(2),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Renato Bautista',
                'email' => 'renato.bautista@alibaton-ph.com',
                'phone' => '+63 922 889 0120',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2022-0219',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Clarita Bautista (Spouse)',
                'emergency_contact_phone' => '+63 922 889 0123',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-TWR-2024-1144',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Tower Crane)',
                        'issued_at' => Carbon::now()->subMonths(9),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],

            // =========================================================================
            // 3. MOBILE & HEAVY CRANE OPERATORS (Mobile Fleet)
            // =========================================================================
            [
                'name' => 'Noel Macaspac',
                'email' => 'noel.macaspac@alibaton-ph.com',
                'phone' => '+63 919 443 2190',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2021-0177',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Glenda Macaspac (Spouse)',
                'emergency_contact_phone' => '+63 919 443 2198',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-MOB-2023-7721',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Mobile)',
                        'issued_at' => Carbon::now()->subMonths(18),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N03-11-229841',
                        'credential_type' => 'LTO Professional Driver License (RC 8 Heavy)',
                        'issued_at' => Carbon::now()->subYears(4),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                ],
            ],
            [
                'name' => 'Eduardo "Eddie" Manalo',
                'email' => 'eduardo.manalo@alibaton-ph.com',
                'phone' => '+63 928 667 8900',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2019-0054',
                'availability_status' => 'assigned',
                'emergency_contact_name' => 'Marilou Manalo (Spouse)',
                'emergency_contact_phone' => '+63 928 667 8901',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-MOB-2022-4419',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Mobile Crane)',
                        'issued_at' => Carbon::now()->subYears(2),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N01-09-556102',
                        'credential_type' => 'LTO Professional Driver License (RC 2, 3, 8)',
                        'issued_at' => Carbon::now()->subYears(3),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                ],
            ],
            [
                'name' => 'Generoso "Gene" Tolentino',
                'email' => 'generoso.tolentino@alibaton-ph.com',
                'phone' => '+63 916 223 9980',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2022-0298',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Evelyn Tolentino (Spouse)',
                'emergency_contact_phone' => '+63 916 223 9988',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-CRW-2024-3310',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Crawler Crane)',
                        'issued_at' => Carbon::now()->subMonths(11),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N04-18-448102',
                        'credential_type' => 'LTO Professional Driver License (RC 2, 3)',
                        'issued_at' => Carbon::now()->subYears(2),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Mark Anthony Reyes',
                'email' => 'markanthony.reyes@alibaton-ph.com',
                'phone' => '+63 925 771 2340',
                'role' => RoleName::CraneOperator,
                'employee_number' => 'ALB-2023-0341',
                'availability_status' => 'on_leave',
                'emergency_contact_name' => 'Cristina Reyes (Mother)',
                'emergency_contact_phone' => '+63 925 771 2345',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-MOB-2024-9012',
                        'credential_type' => 'TESDA NC-II Heavy Equipment Operator (Mobile Crane)',
                        'issued_at' => Carbon::now()->subMonths(5),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'driver_license',
                        'credential_number' => 'N02-20-771923',
                        'credential_type' => 'LTO Professional Driver License (RC 2, 3)',
                        'issued_at' => Carbon::now()->subYears(1),
                        'expires_at' => Carbon::now()->addYears(4),
                    ],
                ],
            ],

            // =========================================================================
            // 4. RIGGERS & SIGNALPERSONS (Ground & Assembly Crew)
            // =========================================================================
            [
                'name' => 'Arnel Mendoza',
                'email' => 'arnel.mendoza@alibaton-ph.com',
                'phone' => '+63 915 334 8870',
                'role' => RoleName::Rigger,
                'employee_number' => 'ALB-2018-0023',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Jocelyn Mendoza (Spouse)',
                'emergency_contact_phone' => '+63 915 334 8877',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-RIG-2022-1088',
                        'credential_type' => 'TESDA NC-II Rigging and Signal Person (Master Rigger)',
                        'issued_at' => Carbon::now()->subYears(3),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'ASME-B30-2023-049',
                        'credential_type' => 'ASME B30 / DOLE Advanced Rigging & Lifting Supervisor',
                        'issued_at' => Carbon::now()->subMonths(16),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Juanito "Juan" Panganiban',
                'email' => 'juanito.panganiban@alibaton-ph.com',
                'phone' => '+63 926 554 3320',
                'role' => RoleName::Rigger,
                'employee_number' => 'ALB-2021-0189',
                'availability_status' => 'assigned',
                'emergency_contact_name' => 'Remedios Panganiban (Spouse)',
                'emergency_contact_phone' => '+63 926 554 3321',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-RIG-2023-3390',
                        'credential_type' => 'TESDA NC-II Rigging and Signal Person',
                        'issued_at' => Carbon::now()->subMonths(20),
                        'expires_at' => Carbon::now()->addYears(2),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'LEEA-LGI-2024-012',
                        'credential_type' => 'LEEA Lifting Gear Inspection Certification',
                        'issued_at' => Carbon::now()->subMonths(7),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Michael Angelo Ramos',
                'email' => 'michael.ramos@alibaton-ph.com',
                'phone' => '+63 917 998 1230',
                'role' => RoleName::Rigger,
                'employee_number' => 'ALB-2022-0267',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Jennifer Ramos (Spouse)',
                'emergency_contact_phone' => '+63 917 998 1234',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-RIG-2024-5501',
                        'credential_type' => 'TESDA NC-II Rigging and Signal Person',
                        'issued_at' => Carbon::now()->subMonths(8),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Bryan James Flores',
                'email' => 'bryan.flores@alibaton-ph.com',
                'phone' => '+63 920 112 4450',
                'role' => RoleName::Rigger,
                'employee_number' => 'ALB-2023-0312',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Rowena Flores (Mother)',
                'emergency_contact_phone' => '+63 920 112 4455',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-RIG-2024-6623',
                        'credential_type' => 'TESDA NC-II Rigging and Signal Person',
                        'issued_at' => Carbon::now()->subMonths(6),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                    [
                        'kind' => 'qualification',
                        'credential_number' => 'OSHC-WAH-2025-0819',
                        'credential_type' => 'DOLE-OSHC Working at Heights Safety Certification',
                        'issued_at' => Carbon::now()->subMonths(3),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],
            [
                'name' => 'Christian Dave Castro',
                'email' => 'christian.castro@alibaton-ph.com',
                'phone' => '+63 922 443 5560',
                'role' => RoleName::Rigger,
                'employee_number' => 'ALB-2024-0405',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Danilo Castro (Father)',
                'emergency_contact_phone' => '+63 922 443 5566',
                'credentials' => [
                    [
                        'kind' => 'operator_certification',
                        'credential_number' => 'TESDA-RIG-2024-7712',
                        'credential_type' => 'TESDA NC-II Rigging and Signal Person',
                        'issued_at' => Carbon::now()->subMonths(4),
                        'expires_at' => Carbon::now()->addYears(3),
                    ],
                ],
            ],

            // =========================================================================
            // 5. SYSTEMS ADMINISTRATION
            // =========================================================================
            [
                'name' => 'Jose Mari Tecson',
                'email' => 'jm.tecson@alibaton-ph.com',
                'phone' => '+63 917 101 2000',
                'role' => RoleName::SystemAdministrator,
                'employee_number' => 'ALB-2017-0005',
                'availability_status' => 'available',
                'emergency_contact_name' => 'Maria Fe Tecson (Spouse)',
                'emergency_contact_phone' => '+63 917 101 2020',
                'credentials' => [],
            ],
        ];

        foreach ($employees as $data) {
            $user = User::query()->updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'username' => Username::fromEmail($data['email']),
                    'phone' => $data['phone'],
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'email_verified_at' => Carbon::now(),
                ]
            );

            $user->syncRoles([$data['role']->value]);

            PersonnelProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'employee_number' => $data['employee_number'],
                    'availability_status' => $data['availability_status'],
                    'emergency_contact_name' => $data['emergency_contact_name'],
                    'emergency_contact_phone' => $data['emergency_contact_phone'],
                ]
            );

            foreach ($data['credentials'] as $credentialData) {
                PersonnelCredential::query()->updateOrCreate(
                    [
                        'kind' => $credentialData['kind'],
                        'credential_number' => $credentialData['credential_number'],
                    ],
                    [
                        'user_id' => $user->id,
                        'credential_type' => $credentialData['credential_type'],
                        'issued_at' => $credentialData['issued_at'],
                        'expires_at' => $credentialData['expires_at'],
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
