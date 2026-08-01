[CmdletBinding()]
param(
    [switch] $SkipNativeBuild,
    [switch] $SmokeOnly,
    [ValidateSet('core2_api_30_phone', 'core2_api_36')]
    [string] $AndroidAvd = 'core2_api_36'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot '..\..\..')
)
$mobileRoot = Join-Path $repositoryRoot 'packages\field-mobile'
$runtimeRoot = Join-Path $repositoryRoot 'storage\framework\testing'
$publicRoot = Join-Path $repositoryRoot 'public'
$runId = (Get-Date).ToString('yyyyMMdd-HHmmss-fff')
$database = Join-Path $runtimeRoot 'session1-native.sqlite'
$evidence = Join-Path $runtimeRoot 'session1-native-evidence.txt'
$nativeBuildMode = if ($SkipNativeBuild) {
    'existing-artifacts-reused'
} else {
    'clean-build-requested'
}
$targetEvidence = Join-Path $runtimeRoot (
    "session1-native-evidence-$AndroidAvd-$nativeBuildMode.txt"
)
$apiOutput = Join-Path $runtimeRoot "session1-$runId-api.stdout.log"
$apiError = Join-Path $runtimeRoot "session1-$runId-api.stderr.log"
$metroOutput = Join-Path $runtimeRoot "session1-$runId-metro.stdout.log"
$metroError = Join-Path $runtimeRoot "session1-$runId-metro.stderr.log"
$emulatorOutput = Join-Path $runtimeRoot "session1-$runId-emulator.stdout.log"
$emulatorError = Join-Path $runtimeRoot "session1-$runId-emulator.stderr.log"
$deviceOutput = Join-Path $runtimeRoot "session1-$runId-device.log"
$deviceError = Join-Path $runtimeRoot "session1-$runId-device.stderr.log"
$apk = Join-Path $mobileRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
$testApk = Join-Path $mobileRoot (
    'android\app\build\outputs\apk\androidTest\debug\' +
    'app-debug-androidTest.apk'
)
$expoCli = Join-Path $repositoryRoot 'node_modules\expo\bin\cli'
$laravelServer = Join-Path $repositoryRoot (
    'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
)
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
$sourceAvdHome = Join-Path $env:USERPROFILE '.android\avd'
$runtimeAvdHome = Join-Path $runtimeRoot 'android-avd'
$apiPort = 18000
$metroPort = 18081
$apiProcess = $null
$metroProcess = $null
$emulatorProcess = $null
$deviceLogProcess = $null
$emulatorSerial = 'emulator-5554'
$startedAt = (Get-Date).ToString('o')
$stage = 'environment validation'
$ndkEvidence = 'not invoked (existing native artifacts reused)'

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string] $FilePath,
        [Parameter(Mandatory)][string[]] $Arguments,
        [Parameter(Mandatory)][string] $FailureMessage
    )

    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "$FailureMessage (exit code $exitCode)."
    }
}

function Wait-LocalPort {
    param(
        [Parameter(Mandatory)][int] $Port,
        [Parameter(Mandatory)][System.Diagnostics.Process] $Process,
        [Parameter(Mandatory)][string] $Name
    )

    $deadline = (Get-Date).AddSeconds(120)

    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) {
            throw "$Name exited before opening port $Port."
        }

        $client = [System.Net.Sockets.TcpClient]::new()

        try {
            $task = $client.ConnectAsync('127.0.0.1', $Port)

            if ($task.Wait(1000) -and $client.Connected) {
                return
            }
        } catch {
            # Continue polling until the deadline.
        } finally {
            $client.Dispose()
        }

        Start-Sleep -Seconds 2
    }

    throw "$Name did not open port $Port within 120 seconds."
}

function Test-LocalPort {
    param(
        [Parameter(Mandatory)][int] $Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()

    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)

        return $task.Wait(1000) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Assert-LocalPortAvailable {
    param(
        [Parameter(Mandatory)][int] $Port,
        [Parameter(Mandatory)][string] $Name
    )

    if (Test-LocalPort -Port $Port) {
        throw "$Name cannot start because port $Port is already in use. Stop the existing listener and rerun."
    }
}

function Initialize-WorkspaceAvd {
    param(
        [Parameter(Mandatory)][string] $SourceHome,
        [Parameter(Mandatory)][string] $RuntimeHome,
        [Parameter(Mandatory)][string] $Name
    )

    $sourceDirectory = Join-Path $SourceHome "$Name.avd"
    $sourceConfig = Join-Path $sourceDirectory 'config.ini'
    $runtimeDirectory = Join-Path $RuntimeHome "$Name.avd"
    $runtimeConfig = Join-Path $runtimeDirectory 'config.ini'
    $runtimeIni = Join-Path $RuntimeHome "$Name.ini"
    $targetApi = if ($Name -match 'api_(\d+)') {
        $Matches[1]
    } else {
        throw "Could not derive the Android API level from AVD $Name."
    }

    if (-not (Test-Path -LiteralPath $sourceConfig -PathType Leaf)) {
        throw "Required source AVD configuration is missing at $sourceConfig."
    }

    New-Item -ItemType Directory -Path $runtimeDirectory -Force |
        Out-Null

    $config = Get-Content -LiteralPath $sourceConfig -Raw
    $config = $config -replace (
        '(?m)^disk\.dataPartition\.size=.*$'
    ), 'disk.dataPartition.size=4G'
    $config = $config -replace (
        '(?m)^fastboot\.forceColdBoot=.*$'
    ), 'fastboot.forceColdBoot=yes'
    $config = $config -replace (
        '(?m)^fastboot\.forceFastBoot=.*$'
    ), 'fastboot.forceFastBoot=no'
    $config = $config -replace (
        '(?m)^hw\.gpu\.mode=.*$'
    ), 'hw.gpu.mode=software'
    $config = $config -replace (
        '(?m)^hw\.initialOrientation=.*$'
    ), 'hw.initialOrientation=portrait'
    $config = $config -replace (
        '(?m)^hw\.lcd\.density=.*$'
    ), 'hw.lcd.density=420'
    $config = $config -replace (
        '(?m)^hw\.lcd\.height=.*$'
    ), 'hw.lcd.height=1920'
    $config = $config -replace (
        '(?m)^hw\.lcd\.width=.*$'
    ), 'hw.lcd.width=1080'
    $config = $config -replace (
        '(?m)^hw\.sdCard=.*$'
    ), 'hw.sdCard=no'
    $config = $config -replace (
        '(?m)^showDeviceFrame=.*$'
    ), 'showDeviceFrame=no'
    Set-Content -LiteralPath $runtimeConfig -Encoding ascii -Value $config

    Set-Content -LiteralPath $runtimeIni -Encoding ascii -Value @(
        'avd.ini.encoding=UTF-8'
        "path=$runtimeDirectory"
        "path.rel=$Name.avd"
        "target=android-$targetApi"
    )
}

function Wait-ExpoMetro {
    param(
        [Parameter(Mandatory)][int] $Port,
        [Parameter(Mandatory)][System.Diagnostics.Process] $Process
    )

    $deadline = (Get-Date).AddSeconds(120)
    $statusUrl = "http://127.0.0.1:$Port/status"

    while ((Get-Date) -lt $deadline) {
        $Process.Refresh()

        if ($Process.HasExited) {
            throw "Expo Metro exited before its status endpoint became ready on port $Port."
        }

        $response = $null
        $reader = $null

        try {
            $request = [System.Net.HttpWebRequest] (
                [System.Net.WebRequest]::Create($statusUrl)
            )
            $request.Proxy = $null
            $request.Timeout = 2000
            $request.ReadWriteTimeout = 2000
            $response = $request.GetResponse()
            $reader = [System.IO.StreamReader]::new(
                $response.GetResponseStream()
            )
            $content = $reader.ReadToEnd()

            if ($content.Trim() -eq 'packager-status:running') {
                return
            }
        } catch {
            # Continue polling until the deadline.
        } finally {
            if ($null -ne $reader) {
                $reader.Dispose()
            }

            if ($null -ne $response) {
                $response.Dispose()
            }
        }

        Start-Sleep -Seconds 2
    }

    throw "Expo Metro did not become ready on port $Port within 120 seconds."
}

function Stop-ProcessTree {
    param(
        [System.Diagnostics.Process] $Process
    )

    if ($null -eq $Process) {
        return
    }

    try {
        $Process.Refresh()
    } catch {
        return
    }

    if ($Process.HasExited) {
        return
    }

    $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'

    try {
        & $taskkill /PID $Process.Id /T /F *> $null
    } catch {
        # Preserve the original run result if a process exits during cleanup.
    }

    Start-Sleep -Milliseconds 500

    try {
        $Process.Refresh()

        if (-not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # Preserve the original run result if a process exits during cleanup.
    }
}

function Wait-AndroidBoot {
    param(
        [Parameter(Mandatory)][string] $AdbPath,
        [Parameter(Mandatory)][string] $Serial,
        [Parameter(Mandatory)][System.Diagnostics.Process] $Process,
        [Parameter(Mandatory)][string[]] $LogPaths
    )

    $deadline = (Get-Date).AddMinutes(8)
    $serialPattern = '^' + [Regex]::Escape($Serial) + '\s+device\b'
    $snapshotLockPattern = 'snapshot\.lock\.lock \(error: 5\)'

    while ((Get-Date) -lt $deadline) {
        $Process.Refresh()

        if ($Process.HasExited) {
            throw 'The software-rendered Android emulator exited before boot completed.'
        }

        foreach ($logPath in $LogPaths) {
            if (
                (Test-Path -LiteralPath $logPath) -and
                ((Get-Item -LiteralPath $logPath).Length -gt 0)
            ) {
                $recentLog = Get-Content -LiteralPath $logPath -Tail 20

                if ($recentLog -match $snapshotLockPattern) {
                    throw (
                        'The Android emulator could not acquire its snapshot lock. ' +
                        'The runner uses read-only, no-snapshot mode to avoid this; ' +
                        'check whether another emulator process still owns the AVD.'
                    )
                }
            }
        }

        $devices = & $AdbPath devices

        if ($LASTEXITCODE -eq 0 -and $devices -match $serialPattern) {
            $bootCompleted = & $AdbPath -s $Serial shell getprop `
                sys.boot_completed
            $bootValue = $bootCompleted | Select-Object -Last 1

            if (
                $LASTEXITCODE -eq 0 -and
                $null -ne $bootValue -and
                $bootValue.Trim() -eq '1'
            ) {
                return
            }
        }

        Start-Sleep -Seconds 3
    }

    throw 'The software-rendered Android emulator did not boot within 8 minutes.'
}

function Wait-AndroidShutdown {
    param(
        [Parameter(Mandatory)][string] $AdbPath,
        [Parameter(Mandatory)][string] $Serial,
        [int] $TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $serialPattern = '^' + [Regex]::Escape($Serial) + '\s+\w+\b'

    while ((Get-Date) -lt $deadline) {
        $devices = & $AdbPath devices 2>$null
        $serialIsListed = (
            $LASTEXITCODE -eq 0 -and
            $devices -match $serialPattern
        )
        $consoleIsOpen = Test-LocalPort -Port 5554
        $bridgeIsOpen = Test-LocalPort -Port 5555

        if (-not $serialIsListed -and -not $consoleIsOpen -and -not $bridgeIsOpen) {
            return $true
        }

        Start-Sleep -Seconds 1
    }

    return $false
}

function Stop-AndroidEmulatorConsole {
    param(
        [int] $Port = 5554
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    $reader = $null
    $writer = $null

    try {
        $client.Connect('127.0.0.1', $Port)
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000
        $reader = [System.IO.StreamReader]::new(
            $stream,
            [System.Text.Encoding]::ASCII
        )
        $writer = [System.IO.StreamWriter]::new(
            $stream,
            [System.Text.Encoding]::ASCII
        )
        $writer.NewLine = "`r`n"
        $writer.AutoFlush = $true
        $tokenPath = $null

        while ($true) {
            $line = $reader.ReadLine()

            if ($null -eq $line) {
                return $false
            }

            if (
                $line -match (
                    "'([^']+\\\.emulator_console_auth_token)'"
                )
            ) {
                $tokenPath = [System.IO.Path]::GetFullPath($Matches[1])
            }

            if ($line -eq 'OK') {
                break
            }
        }

        $usersRoot = [System.IO.Path]::GetFullPath(
            (Join-Path $env:SystemDrive 'Users')
        ) + [System.IO.Path]::DirectorySeparatorChar

        if (
            [string]::IsNullOrWhiteSpace($tokenPath) -or
            [System.IO.Path]::GetFileName($tokenPath) -ne (
                '.emulator_console_auth_token'
            ) -or
            -not $tokenPath.StartsWith(
                $usersRoot,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -or
            -not (Test-Path -LiteralPath $tokenPath -PathType Leaf)
        ) {
            return $false
        }

        $token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()

        if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -gt 256) {
            return $false
        }

        $writer.WriteLine("auth $token")

        while ($true) {
            $line = $reader.ReadLine()

            if ($null -eq $line -or $line -eq 'KO') {
                return $false
            }

            if ($line -eq 'OK') {
                break
            }
        }

        $writer.WriteLine('kill')

        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $reader) {
            $reader.Dispose()
        }

        if ($null -ne $writer) {
            $writer.Dispose()
        }

        $client.Dispose()
    }
}

function Prepare-AndroidDevice {
    param(
        [Parameter(Mandatory)][string] $AdbPath,
        [Parameter(Mandatory)][string] $Serial
    )

    $commands = [System.Collections.Generic.List[System.String[]]]::new()
    $commands.Add(
        [string[]] @('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    )
    $commands.Add([string[]] @('shell', 'wm', 'dismiss-keyguard'))
    $commands.Add(
        [string[]] @('shell', 'svc', 'power', 'stayon', 'true')
    )
    $commands.Add([string[]] @('shell', 'wm', 'size', '1080x1920'))
    $commands.Add([string[]] @('shell', 'wm', 'density', '420'))
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'system',
            'accelerometer_rotation',
            '0'
        )
    )
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'system',
            'user_rotation',
            '0'
        )
    )
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'system',
            'screen_off_timeout',
            '2147483647'
        )
    )
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'global',
            'window_animation_scale',
            '0'
        )
    )
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'global',
            'transition_animation_scale',
            '0'
        )
    )
    $commands.Add(
        [string[]] @(
            'shell',
            'settings',
            'put',
            'global',
            'animator_duration_scale',
            '0'
        )
    )
    $commands.Add([string[]] @('shell', 'input', 'keyevent', 'KEYCODE_HOME'))

    foreach ($arguments in $commands) {
        Invoke-Checked -FilePath $AdbPath `
            -Arguments (@('-s', $Serial) + $arguments) `
            -FailureMessage 'Android device wake and focus preparation failed'
    }
}

function Measure-SecretPatternsInStream {
    param(
        [Parameter(Mandatory)][System.IO.Stream] $Stream,
        [Parameter(Mandatory)][hashtable] $Patterns
    )

    $detected = @{}
    $buffer = New-Object byte[] 1048576
    $encoding = [System.Text.Encoding]::GetEncoding(28591)
    $tail = ''

    while (($bytesRead = $Stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $text = $tail + $encoding.GetString($buffer, 0, $bytesRead)

        foreach ($name in $Patterns.Keys) {
            if (-not $detected.ContainsKey($name) -and $text -match $Patterns[$name]) {
                $detected[$name] = $true
            }
        }

        if ($text.Length -gt 512) {
            $tail = $text.Substring($text.Length - 512)
        } else {
            $tail = $text
        }
    }

    return $detected
}

function Test-SecretLeaks {
    param(
        [Parameter(Mandatory)][string[]] $Paths,
        [Parameter(Mandatory)][string[]] $FixtureSecrets
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $fixturePattern = ($FixtureSecrets | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    } | ForEach-Object { [Regex]::Escape($_) }) -join '|'
    $patterns = @{
        authorization_header = (
            '(?i)\bauthorization\s*[:=]\s*["'']?(?:bearer\s+)?' +
            '[a-z0-9._~+/|=-]{16,}'
        )
        bearer_token = '(?i)\bbearer\s+[a-z0-9._~+/|=-]{24,}'
        password_value = (
            '(?i)\b(?:password|passwd)\s*[:=]\s*["'']?' +
            '[^\s,"''}\]]{8,}'
        )
        sanctum_raw_token = '(?i)(?<![a-z0-9])\d+\|[a-z0-9]{20,}(?![a-z0-9])'
    }

    if (-not [string]::IsNullOrWhiteSpace($fixturePattern)) {
        $patterns.fixture_password = $fixturePattern
    }

    $sourceCounts = @{}

    foreach ($name in $patterns.Keys) {
        $sourceCounts[$name] = 0
    }

    $scannedPaths = 0
    $affectedInputs = [System.Collections.Generic.List[string]]::new()

    foreach ($path in $Paths | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Secret-leak validation input is missing: $path"
        }

        $scannedPaths += 1
        $pathDetections = @{}

        if ([System.IO.Path]::GetExtension($path) -eq '.apk') {
            $archive = [System.IO.Compression.ZipFile]::OpenRead($path)

            try {
                foreach ($entry in $archive.Entries) {
                    if ($entry.Length -eq 0) {
                        continue
                    }

                    $stream = $entry.Open()

                    try {
                        $entryDetections = Measure-SecretPatternsInStream `
                            -Stream $stream -Patterns $patterns

                        foreach ($name in $entryDetections.Keys) {
                            $pathDetections[$name] = $true
                        }
                    } finally {
                        $stream.Dispose()
                    }
                }
            } finally {
                $archive.Dispose()
            }
        } else {
            $stream = [System.IO.File]::Open(
                $path,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::Read,
                [System.IO.FileShare]::ReadWrite
            )

            try {
                $pathDetections = Measure-SecretPatternsInStream `
                    -Stream $stream -Patterns $patterns
            } finally {
                $stream.Dispose()
            }
        }

        foreach ($name in $pathDetections.Keys) {
            $sourceCounts[$name] += 1
        }

        if ($pathDetections.Count -gt 0) {
            $safeName = [System.IO.Path]::GetFileName($path)
            $safeCategories = @($pathDetections.Keys | Sort-Object) -join ','
            $affectedInputs.Add("$safeName[$safeCategories]")
        }
    }

    $totalDetections = 0

    foreach ($count in $sourceCounts.Values) {
        $totalDetections += $count
    }

    if ($totalDetections -gt 0) {
        $categoryCount = @(
            $sourceCounts.GetEnumerator() | Where-Object { $_.Value -gt 0 }
        ).Count
        throw (
            'Secret-leak validation failed. ' +
            "Categories with detections: $categoryCount; " +
            "affected sources: $totalDetections. " +
            'Redacted category counts: ' +
            "fixture_password=$($sourceCounts.fixture_password), " +
            "authorization_header=$($sourceCounts.authorization_header), " +
            "bearer_token=$($sourceCounts.bearer_token), " +
            "password_value=$($sourceCounts.password_value), " +
            "sanctum_raw_token=$($sourceCounts.sanctum_raw_token). " +
            "Affected inputs: $($affectedInputs -join '; ')."
        )
    }

    return [PSCustomObject] @{
        Paths = $scannedPaths
        FixturePassword = $sourceCounts.fixture_password
        AuthorizationHeader = $sourceCounts.authorization_header
        BearerToken = $sourceCounts.bearer_token
        PasswordValue = $sourceCounts.password_value
        SanctumRawToken = $sourceCounts.sanctum_raw_token
    }
}

function Write-SafeEvidenceStatus {
    param(
        [Parameter(Mandatory)][string] $RunStatus,
        [Parameter(Mandatory)][string] $CurrentStage
    )

    $statusEvidence = @(
        'Core 2 Session 1 native evidence'
        "Status: $RunStatus"
        "Stage: $CurrentStage"
        "Android AVD: $AndroidAvd"
        "Native build mode: $nativeBuildMode"
        "Started: $startedAt"
        "Updated: $((Get-Date).ToString('o'))"
        'Raw bearer tokens: not recorded'
    )
    Set-Content -LiteralPath $evidence -Encoding utf8 -Value $statusEvidence
    Set-Content -LiteralPath $targetEvidence -Encoding utf8 `
        -Value $statusEvidence
}

function Set-NativeStage {
    param(
        [Parameter(Mandatory)][string] $Name
    )

    $script:stage = $Name
    Write-SafeEvidenceStatus -RunStatus 'RUNNING' -CurrentStage $stage
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
Set-Location -LiteralPath $repositoryRoot
Write-SafeEvidenceStatus -RunStatus 'RUNNING' -CurrentStage $stage

try {
    $env:NVM_HOME = Join-Path $env:LOCALAPPDATA 'nvm'
    $env:NVM_SYMLINK = 'C:\nvm4w\nodejs'
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $androidSdk
    $env:ANDROID_SDK_ROOT = $androidSdk
    $env:ANDROID_AVD_HOME = $sourceAvdHome
    $env:Path = @(
        $env:NVM_SYMLINK
        $env:NVM_HOME
        (Join-Path $javaHome 'bin')
        (Join-Path $androidSdk 'platform-tools')
        (Join-Path $androidSdk 'emulator')
        $env:Path
    ) -join [System.IO.Path]::PathSeparator

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $php = (Get-Command php.exe -ErrorAction Stop).Source
    $java = Join-Path $javaHome 'bin\java.exe'
    $clang = Join-Path $androidSdk (
        'ndk\27.1.12297006\toolchains\llvm\prebuilt\windows-x86_64\bin\clang.exe'
    )
    $adb = Join-Path $androidSdk 'platform-tools\adb.exe'
    $emulator = Join-Path $androidSdk 'emulator\emulator.exe'

    if ((& $node --version).Trim() -ne 'v22.13.0') {
        throw 'Node v22.13.0 is required. Run nvm use 22.13.0 first.'
    }

    Invoke-Checked -FilePath $java -Arguments @('-version') `
        -FailureMessage 'Android Studio JBR validation failed'

    if (-not $SkipNativeBuild) {
        Invoke-Checked -FilePath $clang -Arguments @('--version') `
            -FailureMessage 'External NDK Clang execution failed'
        $ndkEvidence = '27.1.12297006 (direct execution passed)'
    }

    Set-NativeStage -Name 'Android virtual-device validation'
    $requiredAvds = @('core2_api_30_phone', 'core2_api_36')
    $installedAvds = & (Join-Path $androidSdk 'emulator\emulator.exe') -list-avds

    foreach ($avd in $requiredAvds) {
        if ($avd -notin $installedAvds) {
            throw "Required AVD $avd is not installed."
        }
    }

    Initialize-WorkspaceAvd -SourceHome $sourceAvdHome `
        -RuntimeHome $runtimeAvdHome -Name $AndroidAvd
    $env:ANDROID_AVD_HOME = $runtimeAvdHome

    Assert-LocalPortAvailable -Port $apiPort -Name 'Laravel API'
    Assert-LocalPortAvailable -Port $metroPort -Name 'Expo Metro'
    Assert-LocalPortAvailable -Port 5554 -Name 'Android emulator console'
    Assert-LocalPortAvailable -Port 5555 -Name 'Android emulator bridge'

    Set-NativeStage -Name 'software-rendered Android emulator startup'
    & $adb kill-server
    Invoke-Checked -FilePath $adb -Arguments @('start-server') `
        -FailureMessage 'Android Debug Bridge startup failed'
    $emulatorProcess = Start-Process -FilePath $emulator -ArgumentList @(
        "@$AndroidAvd",
        '-port',
        '5554',
        '-no-snapshot',
        '-no-audio',
        '-no-boot-anim',
        '-no-window',
        '-gpu',
        'software'
    ) -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $emulatorOutput `
        -RedirectStandardError $emulatorError
    Wait-AndroidBoot -AdbPath $adb -Serial $emulatorSerial `
        -Process $emulatorProcess -LogPaths @($emulatorOutput, $emulatorError)
    $androidApiLevel = (& $adb -s $emulatorSerial shell getprop `
        ro.build.version.sdk | Select-Object -Last 1).Trim()
    $expectedApiLevel = if ($AndroidAvd -eq 'core2_api_30_phone') {
        '30'
    } else {
        '36'
    }

    if ($androidApiLevel -ne $expectedApiLevel) {
        throw (
            "AVD $AndroidAvd booted API $androidApiLevel; " +
            "expected API $expectedApiLevel."
        )
    }
    Prepare-AndroidDevice -AdbPath $adb -Serial $emulatorSerial
    Invoke-Checked -FilePath $adb -Arguments @(
        '-s',
        $emulatorSerial,
        'logcat',
        '-c'
    ) -FailureMessage 'Android device log reset failed'
    $deviceLogProcess = Start-Process -FilePath $adb -ArgumentList @(
        '-s',
        $emulatorSerial,
        'logcat',
        '-v',
        'time',
        'ReactNativeJS:V',
        'AndroidRuntime:E',
        'Expo:V',
        'ExpoModulesCore:V',
        'SoLoader:W',
        'OkHttp:V',
        'System.err:W',
        'ActivityManager:I',
        'ActivityTaskManager:I',
        '*:S'
    ) -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $deviceOutput `
        -RedirectStandardError $deviceError

    if (Test-Path -LiteralPath $database) {
        Remove-Item -LiteralPath $database -Force
    }

    New-Item -ItemType File -Path $database | Out-Null

    $env:APP_ENV = 'local'
    $env:APP_DEBUG = 'false'
    $env:APP_URL = "http://127.0.0.1:$apiPort"
    $env:DB_CONNECTION = 'sqlite'
    $env:DB_DATABASE = $database
    $env:CACHE_STORE = 'array'
    $env:SESSION_DRIVER = 'array'
    $env:QUEUE_CONNECTION = 'sync'
    $env:EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:$apiPort"
    $env:EXPO_DEV_CLIENT_METRO_URL = "http://127.0.0.1:$metroPort"
    $env:RUN_NATIVE_ACCEPTANCE = '1'
    $env:FIELD_TEST_EMAIL = 'driver@example.com'
    $fixturePasswordBytes = New-Object byte[] 32
    $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomNumberGenerator.GetBytes($fixturePasswordBytes)
    $randomNumberGenerator.Dispose()
    $env:FIELD_TEST_PASSWORD = [Convert]::ToBase64String($fixturePasswordBytes)
    $env:SESSION1_NATIVE_PASSWORD = $env:FIELD_TEST_PASSWORD
    $env:FORBIDDEN_JOB_REFERENCE = 'SESSION1-FORBIDDEN-002'
    $env:ASSIGNED_JOB_REFERENCE = 'SESSION1-DRIVER-001'
    $env:NON_FIELD_TEST_EMAIL = 'dispatcher@example.com'
    $env:SECOND_FIELD_TEST_EMAIL = 'technician@example.com'
    $env:CI = '1'

    if ($SmokeOnly) {
        $env:DETOX_TEST_PATH = 'e2e/session1-smoke.e2e.test.js'
        $env:RUN_NATIVE_ACCEPTANCE = '0'
    } else {
        Remove-Item Env:DETOX_TEST_PATH -ErrorAction SilentlyContinue
    }

    Set-NativeStage -Name 'isolated fixture preparation'
    Invoke-Checked -FilePath $php -Arguments @(
        'artisan',
        'migrate:fresh',
        '--force',
        '--no-interaction'
    ) -FailureMessage 'Isolated Session 1 database migration failed'
    Invoke-Checked -FilePath $php -Arguments @(
        'artisan',
        'db:seed',
        '--class=Database\Seeders\Session1NativeAcceptanceSeeder',
        '--force',
        '--no-interaction'
    ) -FailureMessage 'Session 1 fixture seeding failed'

    Set-NativeStage -Name 'local API and Metro startup'
    $apiProcess = Start-Process -FilePath $php -ArgumentList @(
        '-S',
        "127.0.0.1:$apiPort",
        '-t',
        '.',
        $laravelServer
    ) -WorkingDirectory $publicRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $apiOutput -RedirectStandardError $apiError
    Wait-LocalPort -Port $apiPort -Process $apiProcess -Name 'Laravel API'

    $metroProcess = Start-Process -FilePath $node -ArgumentList @(
        $expoCli,
        'start',
        '--dev-client',
        '--port',
        "$metroPort"
    ) -WorkingDirectory $mobileRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $metroOutput -RedirectStandardError $metroError
    Wait-ExpoMetro -Port $metroPort -Process $metroProcess

    if (-not $SkipNativeBuild) {
        Set-NativeStage -Name 'Detox Android instrumentation build'
        Invoke-Checked -FilePath $npm -Arguments @(
            'run',
            'mobile:e2e:build:android'
        ) -FailureMessage 'Detox Android build failed'
    }

    if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) {
        throw "Expected debug APK was not produced at $apk."
    }

    if (-not (Test-Path -LiteralPath $testApk -PathType Leaf)) {
        throw "Expected instrumentation APK was not produced at $testApk."
    }

    if ($SmokeOnly) {
        Set-NativeStage -Name 'Detox native sign-in smoke'
    } else {
        Set-NativeStage -Name 'Detox authenticated native acceptance'
    }
    Prepare-AndroidDevice -AdbPath $adb -Serial $emulatorSerial
    Invoke-Checked -FilePath $npm -Arguments @(
        'run',
        'mobile:e2e:test:android'
    ) -FailureMessage 'Detox native acceptance failed'

    Set-NativeStage -Name 'redacted secret-leak validation'
    Stop-ProcessTree -Process $deviceLogProcess
    $deviceLogProcess = $null
    $secretScan = Test-SecretLeaks -Paths @(
        $apiOutput,
        $apiError,
        $metroOutput,
        $metroError,
        $emulatorOutput,
        $emulatorError,
        $deviceOutput,
        $deviceError,
        $apk,
        $testApk
    ) -FixtureSecrets @($env:FIELD_TEST_PASSWORD)

    $apkItem = Get-Item -LiteralPath $apk
    $apkHash = Get-FileHash -LiteralPath $apk -Algorithm SHA256

    $passedEvidence = @(
        'Core 2 Session 1 native evidence'
        'Status: PASSED'
        'Stage: completed'
        "Android AVD: $AndroidAvd"
        "Android API level: $androidApiLevel"
        "Native build mode: $nativeBuildMode"
        "Started: $startedAt"
        "Completed: $((Get-Date).ToString('o'))"
        'Node: v22.13.0'
        "Java home: $javaHome"
        "Android SDK: $androidSdk"
        "NDK: $ndkEvidence"
        "APK: $($apkItem.FullName)"
        "APK bytes: $($apkItem.Length)"
        "APK SHA-256: $($apkHash.Hash)"
        if ($SmokeOnly) {
            'Detox native sign-in smoke: passed'
        } else {
            'Detox authenticated acceptance: passed'
        }
        'Android emulator graphics: software'
        "Android AVD runtime: $runtimeAvdHome"
        'Fixture database: isolated local SQLite'
        'Secret-leak validation: passed'
        "Secret-leak sources scanned: $($secretScan.Paths)"
        "Fixture-password detections: $($secretScan.FixturePassword)"
        "Authorization-header detections: $($secretScan.AuthorizationHeader)"
        "Bearer-token detections: $($secretScan.BearerToken)"
        "Password-value detections: $($secretScan.PasswordValue)"
        "Sanctum-raw-token detections: $($secretScan.SanctumRawToken)"
        'Raw bearer tokens: not recorded'
    )
    Set-Content -LiteralPath $evidence -Encoding utf8 -Value $passedEvidence
    Set-Content -LiteralPath $targetEvidence -Encoding utf8 `
        -Value $passedEvidence

    if ($SmokeOnly) {
        Write-Host "Session 1 emulator smoke passed." -ForegroundColor Green
    } else {
        Write-Host "Session 1 emulator acceptance passed." `
            -ForegroundColor Green
    }
    Write-Host "Evidence: $evidence"
} catch {
    Write-SafeEvidenceStatus -RunStatus 'FAILED' -CurrentStage $stage
    Write-Error $_
    Write-Host "API log: $apiError"
    Write-Host "Metro log: $metroError"
    Write-Host "Emulator log: $emulatorError"
    Write-Host "Device log: $deviceOutput"
    exit 1
} finally {
    Stop-ProcessTree -Process $deviceLogProcess

    if ($null -ne $emulatorProcess) {
        $emulatorStopped = $false

        try {
            & $adb -s $emulatorSerial emu kill *> $null
            $emulatorStopped = Wait-AndroidShutdown -AdbPath $adb `
                -Serial $emulatorSerial -TimeoutSeconds 8
        } catch {
            # Fall back to stopping the tracked process below.
        }

        if (
            -not $emulatorStopped -and
            (Stop-AndroidEmulatorConsole -Port 5554)
        ) {
            $emulatorStopped = Wait-AndroidShutdown -AdbPath $adb `
                -Serial $emulatorSerial
        }

        if (-not $emulatorStopped) {
            Stop-ProcessTree -Process $emulatorProcess
            Wait-AndroidShutdown -AdbPath $adb -Serial $emulatorSerial `
                -TimeoutSeconds 15 | Out-Null
        }
    }

    Stop-ProcessTree -Process $emulatorProcess
    Stop-ProcessTree -Process $metroProcess
    Stop-ProcessTree -Process $apiProcess

    Remove-Item Env:FIELD_TEST_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SESSION1_NATIVE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DETOX_TEST_PATH -ErrorAction SilentlyContinue
}
