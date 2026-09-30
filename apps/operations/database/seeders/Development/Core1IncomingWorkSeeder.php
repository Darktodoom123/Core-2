<?php

namespace Database\Seeders\Development;

use App\Modules\Dispatch\Enums\BusinessLine;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Stand-in for the Core 1 connection while Core 1 is still in development.
 *
 * Seeds job orders (Job Order Registration) and delivery rentals (Rental
 * Management) that have not been dispatched yet, so Incoming work looks like
 * it would once Core 1 sends real handoffs. Safe to run repeatedly: records are
 * keyed by their Core 1 reference.
 */
final class Core1IncomingWorkSeeder extends Seeder
{
    /** @var array<string, array{string, string, string, string, string}> */
    private const array CLIENTS = [
        'megaworld' => ['C1-CL-0101', 'Megaworld Tower Builders Inc.', 'Engr. Carla Santos', '+63 917 555 0101', 'Uptown Bonifacio, Taguig City'],
        'ayala' => ['C1-CL-0102', 'Ayala Land Estates Construction', 'Engr. Miguel Ocampo', '+63 918 555 0102', 'Makati CBD, Makati City'],
        'smdc' => ['C1-CL-0103', 'SMDC Residences Project Office', 'Arch. Bea Lim', '+63 919 555 0103', 'Mall of Asia Complex, Pasay City'],
        'clark' => ['C1-CL-0104', 'Clark Freeport Logistics Corp.', 'Rodel Garcia', '+63 920 555 0104', 'Clark Freeport Zone, Pampanga'],
        'batangas' => ['C1-CL-0105', 'Batangas Port Energy Works', 'Engr. Tess Villanueva', '+63 921 555 0105', 'Batangas International Port, Batangas City'],
    ];

    /**
     * Job orders from Core 1 Job Order Registration. Each asks for one unit
     * from the Alibaton fleet (by asset code) and the operator that runs it.
     *
     * @var list<array{reference: string, client: string, project: string, service: string, site: string, days: int, hour: int, priority: DispatchPriority, equipment: string, notes: string}>
     */
    private const array JOB_ORDERS = [
        ['reference' => 'JO-2026-0201', 'client' => 'megaworld', 'project' => 'Tower 3 precast facade panel lift', 'service' => 'crane_lift', 'site' => '32nd St. cor. 9th Ave., Uptown Bonifacio, Taguig City', 'days' => 1, 'hour' => 6, 'priority' => DispatchPriority::Priority, 'equipment' => 'MOB-CRN-402', 'notes' => 'Lift window 06:00-10:00 only (city truck ban after 10:00). Gate pass at Guard House B.'],
        ['reference' => 'JO-2026-0202', 'client' => 'ayala', 'project' => 'Rooftop chiller unit hoisting', 'service' => 'crane_lift', 'site' => 'Paseo de Roxas cor. Makati Ave., Makati City', 'days' => 2, 'hour' => 22, 'priority' => DispatchPriority::Routine, 'equipment' => 'MOB-CRN-403', 'notes' => 'Night work permit from Makati City required. Road closure 22:00-04:00.'],
        ['reference' => 'JO-2026-0203', 'client' => 'smdc', 'project' => 'Steel beam unloading - Block 4', 'service' => 'crane_lift', 'site' => 'Seaside Blvd., Mall of Asia Complex, Pasay City', 'days' => 3, 'hour' => 7, 'priority' => DispatchPriority::Routine, 'equipment' => 'MOB-CRN-401', 'notes' => 'Unload at the laydown area near Block 4. Site contact on arrival.'],
        ['reference' => 'JO-2026-0204', 'client' => 'clark', 'project' => 'Warehouse yard grading and backfill', 'service' => 'earthworks', 'site' => 'Bldg. 7, Clark Freeport Zone, Mabalacat, Pampanga', 'days' => 5, 'hour' => 8, 'priority' => DispatchPriority::Routine, 'equipment' => 'HEQ-LG-856H', 'notes' => 'PEZA gate clearance needed 24h before arrival.'],
        ['reference' => 'JO-2026-0205', 'client' => 'batangas', 'project' => 'Emergency transformer replacement lift', 'service' => 'crane_lift', 'site' => 'Substation 2, Batangas International Port, Batangas City', 'days' => 0, 'hour' => 14, 'priority' => DispatchPriority::Emergency, 'equipment' => 'MOB-CRN-404', 'notes' => 'Plant is down. Client requests same-day mobilization if possible.'],
        ['reference' => 'JO-2026-0206', 'client' => 'megaworld', 'project' => 'Tower crane foundation excavation', 'service' => 'earthworks', 'site' => '32nd St. cor. 9th Ave., Uptown Bonifacio, Taguig City', 'days' => 8, 'hour' => 5, 'priority' => DispatchPriority::Routine, 'equipment' => 'HEQ-LG-922E', 'notes' => 'Same site as JO-2026-0201. Coordinate with the Tower 3 lift crew.'],
    ];

    /**
     * Delivery rentals from Core 1 Rental Management, one fleet unit each.
     *
     * @var list<array{reference: string, client: string, start: int, days: int, site: string, equipment: string, notes: string}>
     */
    private const array RENTALS = [
        ['reference' => 'RN-2026-0031', 'client' => 'ayala', 'start' => 2, 'days' => 14, 'site' => 'Ayala Triangle Gardens North, Makati City', 'equipment' => 'HEQ-LG-950E', 'notes' => 'Two-week rental. Deliver with fuel topped up.'],
        ['reference' => 'RN-2026-0032', 'client' => 'clark', 'start' => 4, 'days' => 30, 'site' => 'Bldg. 7, Clark Freeport Zone, Mabalacat, Pampanga', 'equipment' => 'HEQ-LG-835H', 'notes' => 'Monthly rental. Weekly inspection required.'],
    ];

    public function run(): void
    {
        $creator = $this->creator();

        if ($creator === null) {
            $this->command->warn('Core 1 incoming work was not seeded: no user exists to own the records.');

            return;
        }

        if (! OperationalAsset::query()->exists()) {
            $this->command->warn('Core 1 incoming work was not seeded: seed the fleet first so orders can name real equipment.');

            return;
        }

        DB::transaction(function () use ($creator): void {
            foreach (self::JOB_ORDERS as $order) {
                $this->seedJobOrder($order, $creator);
            }

            foreach (self::RENTALS as $rental) {
                $this->seedRental($rental, $creator);
            }
        });
    }

    /** @param array{reference: string, client: string, project: string, service: string, site: string, days: int, hour: int, priority: DispatchPriority, equipment: string, notes: string} $order */
    private function seedJobOrder(array $order, User $creator): void
    {
        $client = $this->client($order['client']);
        $asset = $this->asset($order['equipment']);

        ServiceRequest::query()->firstOrCreate(['reference' => $order['reference']], [
            'client_id' => $client->id,
            'created_by' => $creator->id,
            'business_line' => BusinessLine::Service,
            'project_name' => $order['project'],
            'service_type' => $order['service'],
            'location' => $order['site'],
            'site_notes' => sprintf('Site contact: %s (%s). %s', $client->contact_person, $client->phone, $order['notes']),
            'scheduled_date' => Carbon::today()->addDays($order['days'])->setTime($order['hour'], 0),
            'priority' => $order['priority'],
            'status' => ServiceRequestStatus::Submitted,
            'requirements' => [
                "{$asset->code} · {$asset->name}",
                'Operator',
            ],
        ]);
    }

    /** @param array{reference: string, client: string, start: int, days: int, site: string, equipment: string, notes: string} $rental */
    private function seedRental(array $rental, User $creator): void
    {
        $asset = $this->asset($rental['equipment']);
        $start = Carbon::today()->addDays($rental['start']);
        $rateCents = 4_500_000;

        $reservation = RentalReservation::query()->firstOrCreate(['reference' => $rental['reference']], [
            'client_id' => $this->client($rental['client'])->id,
            'created_by' => $creator->id,
            'approved_by' => $creator->id,
            'status' => RentalReservationStatus::Reserved,
            'start_date' => $start,
            'end_date' => $start->copy()->addDays($rental['days']),
            'delivery_location' => $rental['site'],
            'fulfillment_mode' => RentalFulfillmentMode::Delivery,
            'notes' => $rental['notes'],
            'total_cents' => $rateCents,
        ]);

        if (! $reservation->items()->exists()) {
            $reservation->items()->create([
                'operational_asset_id' => $asset->id,
                'quantity' => 1,
                'rate_cents' => $rateCents,
                'line_total_cents' => $rateCents,
            ]);
        }
    }

    /** The named fleet unit, or the first unit when the fleet seeder did not create it. */
    private function asset(string $code): OperationalAsset
    {
        return OperationalAsset::query()->where('code', $code)->first()
            ?? OperationalAsset::query()->orderBy('id')->firstOrFail();
    }

    private function client(string $key): Client
    {
        [$code, $company, $contact, $phone, $address] = self::CLIENTS[$key];

        return Client::query()->firstOrCreate(['code' => $code], [
            'company_name' => $company,
            'contact_person' => $contact,
            'phone' => $phone,
            'email' => Str::slug($contact, '.').'@example.com',
            'address' => $address,
            'status' => 'active',
        ]);
    }

    private function creator(): ?User
    {
        return User::role(RoleName::OperationsManager->value)->orderBy('id')->first()
            ?? User::role(RoleName::SystemAdministrator->value)->orderBy('id')->first();
    }
}
