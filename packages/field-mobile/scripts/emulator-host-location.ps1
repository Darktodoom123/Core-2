<#
.SYNOPSIS
    Feeds this PC's real location to an Android emulator's GPS.

.DESCRIPTION
    An emulator has no GPS radio; left alone it reports a fixed default
    (Google's Mountain View office). This reads the host's position from
    Windows Location Services and sends it through the emulator console
    (`adb emu geo fix`), so the GPS and fused providers report where this
    machine actually is, as a real (not mock) fix.

    It also removes any Android test ("mock") GPS provider left behind by
    earlier runs, since that would override the emulated GPS.

    Windows Location Services must be on (Settings > Privacy & security >
    Location). A PC without GPS locates itself by Wi-Fi, typically to
    within a few hundred metres.

.EXAMPLE
    ./emulator-host-location.ps1
    Sends the host location once to the only connected emulator.

.EXAMPLE
    ./emulator-host-location.ps1 -Watch -IntervalSeconds 30
    Keeps the emulator's location in step with the host until stopped.
#>
param(
    [string] $EmulatorSerial = '',
    [string] $EmulatorAdbPath = '',
    [switch] $Watch,
    [int] $IntervalSeconds = 30
)

Set-StrictMode -Version Latest

function Get-HostLocation {
    param([int] $TimeoutSeconds = 20)

    Add-Type -AssemblyName System.Device

    $watcher = New-Object System.Device.Location.GeoCoordinateWatcher(
        [System.Device.Location.GeoPositionAccuracy]::High
    )

    try {
        $null = $watcher.TryStart(
            $false,
            [TimeSpan]::FromSeconds($TimeoutSeconds)
        )
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

        while (
            $watcher.Status -ne 'Ready' -and
            $watcher.Permission -ne 'Denied' -and
            (Get-Date) -lt $deadline
        ) {
            Start-Sleep -Milliseconds 300
        }

        if ($watcher.Permission -eq 'Denied') {
            throw (
                'Windows denied location access. Turn on Settings > Privacy ' +
                '& security > Location, including "Let desktop apps access ' +
                'your location".'
            )
        }

        $coordinate = $watcher.Position.Location

        if ($null -eq $coordinate -or $coordinate.IsUnknown) {
            throw 'Windows Location Services returned no position for this PC.'
        }

        return [pscustomobject] @{
            Latitude = $coordinate.Latitude
            Longitude = $coordinate.Longitude
            AccuracyMetres = $coordinate.HorizontalAccuracy
            Altitude = if ([double]::IsNaN($coordinate.Altitude)) {
                0
            } else {
                $coordinate.Altitude
            }
        }
    } finally {
        $watcher.Stop()
        $watcher.Dispose()
    }
}

function Resolve-AdbPath {
    param([string] $AdbPath)

    if ($AdbPath) {
        return $AdbPath
    }

    $command = Get-Command adb -ErrorAction SilentlyContinue

    if ($command) {
        return $command.Source
    }

    foreach ($root in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")) {
        if ($root -and (Test-Path (Join-Path $root 'platform-tools\adb.exe'))) {
            return Join-Path $root 'platform-tools\adb.exe'
        }
    }

    throw 'adb was not found. Install Android platform-tools or pass -EmulatorAdbPath.'
}

function Resolve-EmulatorSerial {
    param([string] $AdbPath, [string] $Serial)

    if ($Serial) {
        return $Serial
    }

    $emulators = @(
        & $AdbPath devices |
            Where-Object { $_ -match '^(emulator-\d+)\s+device$' } |
            ForEach-Object { $Matches[1] }
    )

    if ($emulators.Count -eq 0) {
        throw 'No running Android emulator was found.'
    }

    if ($emulators.Count -gt 1) {
        throw "Several emulators are running ($($emulators -join ', ')); pass -EmulatorSerial."
    }

    return $emulators[0]
}

function Set-EmulatorHostLocation {
    param(
        [Parameter(Mandatory)][string] $AdbPath,
        [Parameter(Mandatory)][string] $Serial
    )

    # A test provider replaces the emulated GPS and flags every fix as
    # mock; the app rejects mock fixes, so clear any left from old runs.
    # Best effort: both fail harmlessly when nothing is left to clear, and
    # Windows PowerShell treats their stderr as terminating under Stop.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        & $AdbPath -s $Serial shell cmd location providers `
            remove-test-provider gps 2>&1 | Out-Null
        & $AdbPath -s $Serial shell appops set --uid 2000 `
            android:mock_location default 2>&1 | Out-Null
    } finally {
        $ErrorActionPreference = $previousPreference
    }

    $location = Get-HostLocation
    $invariant = [System.Globalization.CultureInfo]::InvariantCulture

    # The console takes longitude before latitude.
    $reply = & $AdbPath -s $Serial emu geo fix `
        $location.Longitude.ToString($invariant) `
        $location.Latitude.ToString($invariant) `
        $location.Altitude.ToString($invariant)

    if ($LASTEXITCODE -ne 0 -or ($reply -join ' ') -match '(?i)KO|error') {
        throw "The emulator console rejected the location fix: $reply"
    }

    return $location
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    $adb = Resolve-AdbPath -AdbPath $EmulatorAdbPath

    if (-not $Watch) {
        $target = Resolve-EmulatorSerial -AdbPath $adb -Serial $EmulatorSerial
        $sent = Set-EmulatorHostLocation -AdbPath $adb -Serial $target
        Write-Host (
            "Sent this PC's location to $target " +
            "(accuracy about $([math]::Round($sent.AccuracyMetres)) m)."
        )

        return
    }

    # Watch mode outlives emulator restarts: while no emulator is up it
    # waits, and a restarted emulator gets the host location again at once
    # instead of its Mountain View default.
    $lastProblem = $null

    while ($true) {
        try {
            $target = Resolve-EmulatorSerial -AdbPath $adb -Serial $EmulatorSerial
            $sent = Set-EmulatorHostLocation -AdbPath $adb -Serial $target
            $lastProblem = $null
            Write-Host (
                "$(Get-Date -Format HH:mm:ss) Sent this PC's location to " +
                "$target (accuracy about $([math]::Round($sent.AccuracyMetres)) m)."
            )
            $delay = $IntervalSeconds
        } catch {
            $problem = $_.Exception.Message

            if ($problem -ne $lastProblem) {
                Write-Host "$(Get-Date -Format HH:mm:ss) Waiting: $problem"
                $lastProblem = $problem
            }

            $delay = 5
        }

        Start-Sleep -Seconds $delay
    }
}
