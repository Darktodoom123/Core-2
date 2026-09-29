<?php

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Actions\ActivateDispatchJob;
use App\Modules\Dispatch\Actions\ConvertServiceRequestToDispatch;
use App\Modules\Dispatch\Actions\DecideApprovalRequest;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fleet\Models\AssetDocument;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\Development\DefensePresentationSeeder;
use Database\Seeders\Development\LocalDevelopmentSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('private');
    $this->seed([RolePermissionSeeder::class, LocalDevelopmentSeeder::class]);
});

it('releases BJ, clears the fleet, and lets the manager dispatch BJ from a Core 1 request', function (): void {
    $bj = User::query()->where('username', 'operator')->sole();
    expect(DB::table('dispatch_personnel_assignments')->where('user_id', $bj->id)->whereNull('active_until')->exists())->toBeTrue();

    $this->seed(DefensePresentationSeeder::class);

    // BJ starts clean: no open jobs, no open shift, HR profile and documents with files.
    expect(DB::table('dispatch_personnel_assignments')->where('user_id', $bj->id)->whereNull('active_until')->exists())->toBeFalse()
        ->and(DB::table('operator_shifts')->where('user_id', $bj->id)->whereIn('status', [ShiftStatus::ACTIVE->value, ShiftStatus::ON_BREAK->value])->exists())->toBeFalse()
        ->and($bj->refresh()->personnelProfile->availability_status)->toBe('available')
        ->and($bj->personnelCredentials()->whereHas('attachments')->count())->toBe(4);

    // Core 1 queue has three routine requests waiting.
    $waiting = ServiceRequest::query()->where('reference', 'like', DefensePresentationSeeder::SERVICE_REQUEST_PREFIX.'%')->where('status', ServiceRequestStatus::Submitted)->get();
    expect($waiting)->toHaveCount(3);

    // Every mobile crane has a passing inspection and a file for each required permit.
    $crane = OperationalAsset::query()->where('code', 'MOB-CRN-401')->sole();
    expect($crane->inspections()->latest('completed_at')->first()->result)->toBe('passed')
        ->and($crane->documents()->pluck('category')->sort()->values()->all())->toBe(['emission_certs', 'insurance', 'load_test_certs', 'registrations'])
        ->and(AssetDocument::query()->whereDoesntHave('attachments')->exists())->toBeFalse();

    // The live walkthrough: convert, assign BJ + crane, activate.
    Model::reguard();
    $manager = User::query()->where('username', 'manager')->sole();
    $request = $waiting->first();
    $job = app(ConvertServiceRequestToDispatch::class)->handle($request->id, $manager, [
        'reference' => 'DSP-2026-9001',
        'scheduled_start' => $request->scheduled_date->toIso8601String(),
        'scheduled_end' => $request->scheduled_date->copy()->addHours(8)->toIso8601String(),
    ]);
    $job = app(AssignDispatchResources::class)->handle(
        $manager,
        $job,
        [['user_id' => $bj->id, 'assignment_type' => 'crane_operator']],
        [['operational_asset_id' => $crane->id, 'assignment_type' => 'crane']],
        $job->version,
    );
    $approval = ApprovalRequest::query()->where('subject_id', $job->id)->where('status', ApprovalStatus::Pending)->sole();
    // The same Operations Manager approves their own dispatch.
    app(DecideApprovalRequest::class)->handle($manager, $approval, ApprovalStatus::Approved, 'Crew credentials and crane readiness verified.');
    $job = app(ActivateDispatchJob::class)->handle($manager, $job->refresh(), $job->refresh()->version);
    Model::unguard();

    expect($job->status)->toBe(DispatchStatus::Dispatched);
});

it('adds five spare operators with unique emails that reach BJ\'s inbox', function (): void {
    $this->seed(DefensePresentationSeeder::class);

    $bj = User::query()->where('username', 'operator')->sole();
    [$local, $domain] = explode('@', $bj->email);

    foreach (range(1, 5) as $number) {
        $spare = User::query()->where('username', "operator{$number}")->sole();
        expect($spare->hasRole('crane_operator'))->toBeTrue()
            ->and($spare->email)->toBe("{$local}+operator{$number}@{$domain}")
            ->and($spare->personnelCredentials()->where('kind', 'operator_certification')->exists())->toBeTrue();
    }
});

it('can be re-run before each rehearsal without duplicates', function (): void {
    $this->seed(DefensePresentationSeeder::class);
    $counts = [User::query()->count(), AssetDocument::query()->count(), DB::table('attachments')->count()];

    $this->travel(2)->days();
    $this->seed(DefensePresentationSeeder::class);

    $dates = ServiceRequest::query()->where('reference', 'like', DefensePresentationSeeder::SERVICE_REQUEST_PREFIX.'%')->pluck('scheduled_date');
    expect($dates->every(fn ($date): bool => $date->isFuture()))->toBeTrue();

    expect([User::query()->count(), AssetDocument::query()->count(), DB::table('attachments')->count()])->toBe($counts)
        ->and(ServiceRequest::query()->where('reference', 'like', DefensePresentationSeeder::SERVICE_REQUEST_PREFIX.'%')->count())->toBe(3)
        ->and(DispatchJob::query()->where('reference', 'DSP-2026-0891')->sole()->status)->toBe(DispatchStatus::Cancelled);
});

it('stays off on a live server unless DEMO_SEED is set', function (): void {
    $this->app['env'] = 'production';
    config(['auth.defense_demo.enabled' => false]);

    expect(fn () => seedLive($this))->toThrow(LogicException::class, 'DEMO_SEED=true')
        ->and(User::query()->where('username', 'operator1')->exists())->toBeFalse();
});

it('refuses a weak spare-operator password on a live server', function (): void {
    $this->app['env'] = 'production';
    config(['auth.defense_demo.enabled' => true, 'auth.defense_demo.operator_password' => 'password']);

    expect(fn () => seedLive($this))->toThrow(LogicException::class, 'DEMO_OPERATOR_PASSWORD')
        ->and(User::query()->where('username', 'operator1')->exists())->toBeFalse();
});

it('uses the configured password for spare operators on a live server', function (): void {
    $this->app['env'] = 'production';
    config(['auth.defense_demo.enabled' => true, 'auth.defense_demo.operator_password' => 'Defense-Demo-2026!']);

    seedLive($this);

    $spare = User::query()->where('username', 'operator1')->sole();
    expect(Hash::check('Defense-Demo-2026!', $spare->password))->toBeTrue()
        ->and(Hash::check('password', $spare->password))->toBeFalse()
        ->and(ServiceRequest::query()->where('reference', 'like', DefensePresentationSeeder::SERVICE_REQUEST_PREFIX.'%')->count())->toBe(3);
});

it('gives a spare operator its own email when DEMO_OPERATORn_EMAIL is set', function (): void {
    config(['auth.defense_demo.spare_emails' => [1 => 'Carlo.Demo@Example.com']]);

    $this->seed(DefensePresentationSeeder::class);

    $bj = User::query()->where('username', 'operator')->sole();
    [$local, $domain] = explode('@', $bj->email);
    expect(User::query()->where('username', 'operator1')->sole()->email)->toBe('carlo.demo@example.com')
        ->and(User::query()->where('username', 'operator2')->sole()->email)->toBe("{$local}+operator2@{$domain}");
});

it('rejects a spare operator email that another account already uses', function (): void {
    $bj = User::query()->where('username', 'operator')->sole();
    config(['auth.defense_demo.spare_emails' => [1 => $bj->email]]);

    expect(fn () => $this->seed(DefensePresentationSeeder::class))->toThrow(LogicException::class, 'DEMO_OPERATOR1_EMAIL is already used');
});

/** Live servers run the seeder with --force, which skips the production confirmation prompt. */
function seedLive(object $test): void
{
    $test->artisan('db:seed', ['--class' => DefensePresentationSeeder::class, '--force' => true])->run();
}
