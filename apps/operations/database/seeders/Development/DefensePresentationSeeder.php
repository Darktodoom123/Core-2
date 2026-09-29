<?php

namespace Database\Seeders\Development;

use App\Modules\Dispatch\Actions\CancelDispatchJob;
use App\Modules\Dispatch\Enums\BusinessLine;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fleet\Enums\AssetDocumentCategory;
use App\Modules\Fleet\Models\AssetDocument;
use App\Modules\HoursOfService\Actions\CertifyAndCompleteShiftAction;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Pdf\PdfDocumentRenderer;
use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use LogicException;
use RuntimeException;

/**
 * Opt-in presentation data for the capstone defense. Never called by DatabaseSeeder.
 *
 * Prepares one live walkthrough: the Operations Manager converts a Core 1 service request,
 * assigns BJ (username "operator") and a crane, activates, and BJ completes the job on the
 * field app. It also fills in Core 3 equipment clearance, Core 4 fleet and operator documents,
 * and five spare operators ("operator1" to "operator5").
 *
 * Safe to re-run before each rehearsal: it cancels jobs still open for the demo operators,
 * ends their open shifts, and tops up the Core 1 queue. Outside local it runs only with
 * DEMO_SEED=true and a DEMO_OPERATOR_PASSWORD. See Docs/product/defense-presentation.md.
 */
final class DefensePresentationSeeder extends Seeder
{
    public const string SERVICE_REQUEST_PREFIX = 'SR-C1-2026-1';

    public const int SPARE_OPERATORS = 5;

    private const string RESET_REASON = 'Reset before defense rehearsal: demo operator released for a new walkthrough.';

    private const int MIN_LIVE_PASSWORD_LENGTH = 12;

    private const string ASSET_DOCUMENT_NOTE = 'Core 4 document register: original kept at the Alibaton main office.';

    private const string CREDENTIAL_NOTE = 'Verified against the original during onboarding.';

    /** A mobile crane from the Alibaton reference fleet; its absence means the fleet was never seeded. */
    private const string FLEET_MARKER_CODE = 'MOB-CRN-401';

    private User $manager;

    private string $sparePassword;

    public function run(): void
    {
        $isLocal = app()->environment(['local', 'testing']);
        if (! $isLocal && ! config('auth.defense_demo.enabled')) {
            throw new LogicException('Defense presentation data is off outside local. Set DEMO_SEED=true to seed it on purpose.');
        }
        $this->sparePassword = $isLocal ? 'password' : $this->livePassword();

        $hint = $isLocal
            ? 'Run the local seed first'
            : 'Set MANAGER_* and OPERATOR_* and run "php artisan db:seed --force" first';
        $this->manager = User::query()->where('username', 'manager')->first()
            ?? throw new LogicException("{$hint}: the \"manager\" account is missing.");
        $bj = User::query()->where('username', 'operator')->first()
            ?? throw new LogicException("{$hint}: the \"operator\" (BJ) account is missing.");

        if (! OperationalAsset::query()->where('code', self::FLEET_MARKER_CODE)->exists()) {
            $this->call(AlibatonCraneFleetSeeder::class);
        }

        // Seeders run unguarded; the domain actions are written for guarded (HTTP) models.
        Model::reguard();
        request()->headers->set('X-Request-ID', (string) Str::uuid());

        try {
            $operators = DB::transaction(function () use ($bj): array {
                $operators = [$bj, ...$this->spareOperators($bj)];
                foreach ($operators as $index => $operator) {
                    $this->releaseOperator($operator);
                    $this->personnelRecords($operator, $index);
                }
                $this->clearFleet();
                $this->topUpCore1Queue();

                return $operators;
            });
        } finally {
            Model::unguard();
        }

        // File writes happen after the transaction commits.
        $files = $this->attachMissingFiles($operators);

        $this->command->info('Defense presentation ready.');
        $this->command->table(['Account', 'Name', 'Role'], [
            ['manager', $this->manager->name, 'Operations Manager (web): converts, links, approves, activates'],
            ...array_map(static fn (User $user): array => [$user->username, $user->name, 'Operator (field app)'], $operators),
        ]);
        $this->command->line(sprintf('Documents with files: %d new. Core 1 requests waiting: %d.', $files, $this->waitingRequests()->count()));
    }

    // ---------------------------------------------------------------------
    // Operators (BJ + spares)
    // ---------------------------------------------------------------------

    private function livePassword(): string
    {
        $password = config('auth.defense_demo.operator_password');
        if (! is_string($password) || strlen(trim($password)) < self::MIN_LIVE_PASSWORD_LENGTH) {
            throw new LogicException('DEMO_OPERATOR_PASSWORD must contain at least '.self::MIN_LIVE_PASSWORD_LENGTH.' characters outside local.');
        }

        return trim($password);
    }

    /** DEMO_OPERATORn_EMAIL when set; otherwise a plus-address that still reaches BJ's inbox. */
    private function spareEmail(User $bj, int $number): string
    {
        $configured = config("auth.defense_demo.spare_emails.{$number}");
        if (! is_string($configured) || trim($configured) === '') {
            return $this->plusAddress((string) $bj->email, "operator{$number}");
        }

        $email = strtolower(trim($configured));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new LogicException("DEMO_OPERATOR{$number}_EMAIL must be a valid email address.");
        }
        if (User::query()->where('email', $email)->where('username', '!=', "operator{$number}")->exists()) {
            throw new LogicException("DEMO_OPERATOR{$number}_EMAIL is already used by another account.");
        }

        return $email;
    }

    /** Plus-addressing keeps each email unique while mail still reaches the original inbox. */
    private function plusAddress(string $email, string $tag): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, 'example.com');

        return Str::before($local, '+')."+{$tag}@{$domain}";
    }

    /** @return list<User> */
    private function spareOperators(User $bj): array
    {
        $names = ['Carlo Mendoza', 'Arnel Pascual', 'Rey Dimaculangan', 'Jun Cabrera', 'Mark Villareal'];

        $spares = [];
        for ($number = 1; $number <= self::SPARE_OPERATORS; $number++) {
            $user = User::query()->updateOrCreate(
                ['username' => "operator{$number}"],
                [
                    'name' => $names[$number - 1],
                    'email' => $this->spareEmail($bj, $number),
                    'password' => Hash::make($this->sparePassword),
                    'email_verified_at' => now(),
                    'is_active' => true,
                    'suspended_at' => null,
                ],
            );
            $user->syncRoles([RoleName::CraneOperator->value]);
            $spares[] = $user;
        }

        return $spares;
    }

    /** Cancels jobs still open for this operator and ends any open shift, so the phone starts clean. */
    private function releaseOperator(User $operator): void
    {
        $jobIds = DB::table('dispatch_personnel_assignments')
            ->where('user_id', $operator->id)
            ->whereNull('active_until')
            ->pluck('dispatch_job_id');

        DispatchJob::query()
            ->whereIn('id', $jobIds)
            ->whereNotIn('status', [DispatchStatus::Completed, DispatchStatus::Cancelled])
            ->get()
            ->each(fn (DispatchJob $job): DispatchJob => app(CancelDispatchJob::class)->handle($this->manager, $job, self::RESET_REASON, $job->version));

        // Assignments left open on already-finished jobs.
        DB::table('dispatch_personnel_assignments')
            ->where('user_id', $operator->id)
            ->whereNull('active_until')
            ->update(['active_until' => now()]);

        app(CertifyAndCompleteShiftAction::class)->execute($operator, 'I certify that my duty log for this shift is true and correct.', 'Shift closed before defense rehearsal.');
    }

    /** Core HR employee record and Core 4 personal documents (shown in the field app Documents tile). */
    private function personnelRecords(User $operator, int $index): void
    {
        $employeeNumber = sprintf('ALB-EMP-2026-%03d', 101 + $index);
        $operator->personnelProfile()->updateOrCreate([], [
            'employee_number' => $employeeNumber,
            'availability_status' => 'available',
            'emergency_contact_name' => 'Family contact on file (Core HR)',
            'emergency_contact_phone' => sprintf('+63 917 555 %04d', 2101 + $index),
        ]);

        $documents = [
            ['operator_certification', 'TESDA NC II Mobile Crane Operation', 'Technical Education and Skills Development Authority (TESDA)', 'TESDA-MCO', 36],
            ['driver_license', 'LTO Professional Driver License (Code C, CE)', 'Land Transportation Office (LTO)', 'LTO-PDL', 48],
            ['qualification', 'DOLE-OSHC Basic Occupational Safety and Health', 'DOLE Occupational Safety and Health Center', 'BOSH', 24],
            ['qualification', 'Annual Medical Fitness Certificate', 'Accredited occupational health clinic', 'MED', 10],
        ];

        foreach ($documents as $i => [$kind, $type, $issuer, $prefix, $months]) {
            PersonnelCredential::query()->firstOrCreate(
                ['kind' => $kind, 'credential_number' => sprintf('%s-2026-%05d', $prefix, 20100 + $index * 10 + $i)],
                [
                    'user_id' => $operator->id,
                    'credential_type' => $type,
                    'issuing_authority' => $issuer,
                    'issued_at' => now()->subMonths(8)->startOfDay(),
                    'expires_at' => now()->addMonths($months)->startOfDay(),
                    'status' => 'active',
                    'verified_by' => $this->manager->id,
                    'verified_at' => now()->subMonths(7),
                    'notes' => self::CREDENTIAL_NOTE,
                ],
            );
        }
    }

    // ---------------------------------------------------------------------
    // Core 3 equipment clearance + Core 4 fleet documents
    // ---------------------------------------------------------------------

    private function clearFleet(): void
    {
        OperationalAsset::query()->orderBy('id')->each(function (OperationalAsset $asset): void {
            $latest = $asset->inspections()->whereNotNull('completed_at')->latest('completed_at')->first();
            if ($latest === null || $latest->result !== 'passed') {
                $asset->inspections()->create([
                    'technician_id' => $this->manager->id,
                    'type' => 'safety',
                    'result' => 'passed',
                    'checklist' => ['load_test_certificate' => true, 'wire_rope' => true, 'outriggers' => true, 'lmi_system' => true, 'brakes_and_lights' => true, 'hydraulics' => true],
                    'findings' => 'Core 3 equipment inspection: all items passed. Cleared for dispatch.',
                    'completed_at' => now()->subDay()->setTime(16, 0),
                ]);
            }

            foreach (config('fleet.required_permits.'.strtolower((string) $asset->kind), []) as $category) {
                $this->permit($asset, (string) $category);
            }
        });
    }

    private function permit(OperationalAsset $asset, string $category): void
    {
        $validThrough = now()->addMonths(3)->toDateString();
        $hasValid = $asset->documents()
            ->where('category', $category)
            ->where('status', 'active')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>=', $validThrough))
            ->exists();
        if ($hasValid) {
            return;
        }

        [$type, $issuer, $prefix, $months] = match ($category) {
            'registrations' => ['LTO Certificate of Registration', 'Land Transportation Office (LTO)', 'CR', 12],
            'insurance' => ['Comprehensive General Liability and CTPL Policy', 'Accredited non-life insurer', 'POL', 11],
            'emission_certs' => ['Smoke Emission Compliance Certificate', 'LTO-accredited Private Emission Testing Center', 'PETC', 6],
            'load_test_certs' => ['Crane Load Test and Inspection Certificate', 'DOLE-accredited third-party crane inspector', 'LTC', 10],
            default => [AssetDocumentCategory::tryFrom($category)?->label() ?? 'Permit', 'Issuing authority', 'DOC', 12],
        };

        AssetDocument::query()->create([
            'operational_asset_id' => $asset->id,
            'category' => $category,
            'document_type' => $category,
            'title' => $type,
            'document_number' => sprintf('%s-%s-2026', $prefix, $asset->code),
            'issuing_authority' => $issuer,
            'issued_at' => now()->subMonths(2)->startOfDay(),
            'expires_at' => now()->addMonths($months)->startOfDay(),
            'status' => 'active',
            'notes' => self::ASSET_DOCUMENT_NOTE,
            'created_by' => $this->manager->id,
            'updated_by' => $this->manager->id,
        ]);
    }

    // ---------------------------------------------------------------------
    // Core 1 incoming service requests
    // ---------------------------------------------------------------------

    private function topUpCore1Queue(): void
    {
        $orders = [
            ['C1-CL-0101', 'Pasig Riverside Residences Corp.', 'Engr. Maricel Santos', '+63 917 555 0101', 'Precast balcony slab lifting – Tower 2, L5 to L9', 'Pasig Riverside Residences, C. Raymundo Ave., Pasig City', [14.5764, 121.0851]],
            ['C1-CL-0102', 'Cavite Harbor Logistics Inc.', 'Capt. Ramon Villanueva', '+63 918 555 0102', 'Container crane spare parts unloading – Berth 3', 'Cavite Harbor Terminal, Rosario, Cavite', [14.4167, 120.8583]],
            ['C1-CL-0103', 'Batangas Agro-Processing Co.', 'Ms. Liza Dimaano', '+63 919 555 0103', 'Boiler drum placement – processing plant expansion', 'Batangas Agro-Processing Plant, Lipa City, Batangas', [13.9411, 121.1631]],
        ];

        // 08:00 Manila time on the next working morning, stored in the app timezone.
        $manila = now('Asia/Manila');
        $start = ($manila->hour < 6 ? $manila->setTime(8, 0) : $manila->addDay()->setTime(8, 0))->setTimezone(config('app.timezone'));
        // Keep requests left from an earlier run dated for the next working morning.
        $this->waitingRequests()->update(['scheduled_date' => $start]);
        $missing = max(0, count($orders) - $this->waitingRequests()->count());

        foreach (array_slice($orders, 0, $missing) as [$code, $company, $contact, $phone, $project, $site, [$lat, $lng]]) {
            $client = Client::query()->firstOrCreate(['code' => $code], [
                'company_name' => $company,
                'contact_person' => $contact,
                'phone' => $phone,
                'email' => Str::slug($contact, '.').'@example.com',
                'address' => $site,
                'status' => 'active',
            ]);

            ServiceRequest::query()->create([
                'reference' => $this->nextReference(),
                'client_id' => $client->id,
                'created_by' => $this->manager->id,
                'business_line' => BusinessLine::Service,
                'project_name' => $project,
                'service_type' => 'crane_lift',
                'location' => $site,
                'site_notes' => sprintf('Site contact: %s (%s). GPS %.4f, %.4f. Gate pass required; PPE and toolbox talk before lift.', $contact, $phone, $lat, $lng),
                'scheduled_date' => $start,
                'priority' => DispatchPriority::Routine,
                'status' => ServiceRequestStatus::Submitted,
                'requirements' => ['Mobile crane with valid load test certificate', 'TESDA NC II certified crane operator'],
            ]);
        }
    }

    /** @return Builder<ServiceRequest> */
    private function waitingRequests(): Builder
    {
        return ServiceRequest::query()
            ->where('reference', 'like', self::SERVICE_REQUEST_PREFIX.'%')
            ->where('status', ServiceRequestStatus::Submitted);
    }

    private function nextReference(): string
    {
        $last = ServiceRequest::withTrashed()
            ->where('reference', 'like', self::SERVICE_REQUEST_PREFIX.'%')
            ->orderByDesc('reference')
            ->value('reference');
        $number = $last === null ? 1001 : ((int) Str::afterLast((string) $last, '-')) + 1;

        return sprintf('SR-C1-2026-%04d', $number);
    }

    // ---------------------------------------------------------------------
    // Printable PDF files for every document that has none
    // ---------------------------------------------------------------------

    /**
     * Only documents this seeder created get a sample file, so real records never do.
     *
     * @param  list<User>  $operators
     */
    private function attachMissingFiles(array $operators): int
    {
        $renderer = app(PdfDocumentRenderer::class);
        $disk = $this->storageDisk();
        $count = 0;

        $documents = [
            ...AssetDocument::query()->with('operationalAsset')->where('status', 'active')->where('notes', self::ASSET_DOCUMENT_NOTE)->whereDoesntHave('attachments')->get()->all(),
            ...PersonnelCredential::query()->with('user')->where('status', 'active')->where('notes', self::CREDENTIAL_NOTE)
                ->whereIn('user_id', array_map(static fn (User $user): int => $user->id, $operators))
                ->whereDoesntHave('attachments')->get()->all(),
        ];

        foreach ($documents as $document) {
            $isAsset = $document instanceof AssetDocument;
            $holder = $isAsset ? $document->operationalAsset->code.' – '.$document->operationalAsset->name : $document->user->name;
            $title = $isAsset ? $document->title : $document->credential_type;
            $number = $isAsset ? $document->document_number : $document->credential_number;

            $bytes = $renderer->render($this->certificateHtml($title, $number, (string) $document->issuing_authority, $holder, $document->issued_at, $document->expires_at), $title);
            $path = sprintf('attachments/demo/%s.pdf', Str::uuid());
            if (! Storage::disk($disk)->put($path, $bytes)) {
                throw new RuntimeException("Could not store the sample document on the \"{$disk}\" disk.");
            }

            Attachment::query()->create([
                'owner_type' => $document->getMorphClass(),
                'owner_id' => $document->getKey(),
                'uploaded_by' => $this->manager->id,
                'kind' => 'document',
                'disk' => $disk,
                'path' => $path,
                'original_filename' => Str::slug($title.' '.$number).'.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => strlen($bytes),
                'checksum_sha256' => hash('sha256', $bytes),
                'retention_until' => now()->addYears(5),
            ]);
            $count++;
        }

        return $count;
    }

    /** Local keeps files on the container disk; elsewhere they go to the configured protected storage (R2). */
    private function storageDisk(): string
    {
        return app()->environment(['local', 'testing'])
            ? 'private'
            : app(StorageFallbackServiceInterface::class)->resolveProtectedDisk((string) config('attachments.disk'));
    }

    private function certificateHtml(string $title, string $number, string $issuer, string $holder, ?CarbonInterface $issued, ?CarbonInterface $expires): string
    {
        $e = static fn (string $value): string => e($value);

        return '<div style="border:3px double #1d232c;padding:28px;font-family:dejavusanscondensed">'
            .'<p style="font-size:10pt;color:#5a6677;margin:0">'.$e($issuer).'</p>'
            .'<h1 style="font-size:20pt;margin:8px 0 18px">'.$e($title).'</h1>'
            .'<table style="font-size:11pt;width:100%" cellpadding="6">'
            .'<tr><td style="width:35%;color:#5a6677">Document no.</td><td><b>'.$e($number).'</b></td></tr>'
            .'<tr><td style="color:#5a6677">Issued to</td><td>'.$e($holder).'</td></tr>'
            .'<tr><td style="color:#5a6677">Date issued</td><td>'.$e($issued?->toFormattedDateString() ?? 'Not recorded').'</td></tr>'
            .'<tr><td style="color:#5a6677">Valid until</td><td>'.$e($expires?->toFormattedDateString() ?? 'No expiry').'</td></tr>'
            .'</table>'
            .'<p style="margin-top:28px;font-size:9pt;color:#b3261e">SAMPLE DOCUMENT FOR CAPSTONE DEMONSTRATION ONLY. NOT A VALID PERMIT.</p>'
            .'</div>';
    }
}
