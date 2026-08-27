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

$_ENV['APP_ENV'] = 'testing';
$_ENV['APP_DEBUG'] = 'true';
$_ENV['DB_CONNECTION'] = 'sqlite';
$_ENV['DB_DATABASE'] = $browserDatabase;
$_ENV['CACHE_STORE'] = 'array';
$_ENV['QUEUE_CONNECTION'] = 'sync';
$_ENV['SESSION_DRIVER'] = 'file';
$_ENV['OPENAI_FAKE'] = 'true';

$_SERVER['APP_ENV'] = 'testing';
$_SERVER['APP_DEBUG'] = 'true';
$_SERVER['DB_CONNECTION'] = 'sqlite';
$_SERVER['DB_DATABASE'] = $browserDatabase;
$_SERVER['CACHE_STORE'] = 'array';
$_SERVER['QUEUE_CONNECTION'] = 'sync';
$_SERVER['SESSION_DRIVER'] = 'file';
$_SERVER['OPENAI_FAKE'] = 'true';

if (! is_dir(dirname($browserDatabase))) {
    mkdir(dirname($browserDatabase), 0777, true);
}
if (! file_exists($browserDatabase)) {
    touch($browserDatabase);
}

chdir($root);

$php = escapeshellarg(PHP_BINARY);

passthru($php.' artisan migrate:fresh --seed --seeder=BrowserAcceptanceSeeder --force', $migrationStatus);

if ($migrationStatus !== 0) {
    fwrite(STDERR, "Database migration and seeding failed with status {$migrationStatus}\n");
    exit($migrationStatus);
}

passthru($php.' artisan serve --host=127.0.0.1 --port=4173');
