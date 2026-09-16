const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(
    'php',
    ['artisan', 'test', 'tests/Feature/MobileLifecycle/MobileLifecycleEndToEndTest.php'],
    {
        cwd: path.resolve(__dirname, '..', 'apps', 'operations'),
        stdio: 'inherit',
    }
);

process.exit(result.status ?? 1);
