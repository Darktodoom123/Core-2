<?php

$root = dirname(__DIR__, 2);
$browserDatabase = $root.DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'framework'.DIRECTORY_SEPARATOR.'testing'.DIRECTORY_SEPARATOR.'browser.sqlite';

putenv('APP_ENV=testing');
putenv('APP_DEBUG=true');
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE='.$browserDatabase);
putenv('CACHE_STORE=array');
putenv('QUEUE_CONNECTION=sync');
putenv('SESSION_DRIVER=file');
putenv('OPENAI_FAKE=true');

if (! is_dir(dirname($browserDatabase))) {
    mkdir(dirname($browserDatabase), 0777, true);
}

chdir($root);

$php = escapeshellarg(PHP_BINARY);

passthru($php.' artisan migrate:fresh --seed --seeder=BrowserAcceptanceSeeder --force', $migrationStatus);

if ($migrationStatus !== 0) {
    exit($migrationStatus);
}

passthru($php.' artisan serve --host=127.0.0.1 --port=4173');
