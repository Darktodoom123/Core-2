<?php

if (file_exists(__DIR__.'/../vendor/autoload.php')) {
    return require __DIR__.'/../vendor/autoload.php';
}

$rootVendor = dirname(__DIR__, 3).'/vendor/autoload.php';
$loader = require $rootVendor;
$loader->addPsr4('Tracking\\', __DIR__.'/../app/');
$loader->addPsr4('Tracking\\Tests\\', __DIR__.'/../tests/');
$loader->addPsr4('Tracking\\Database\\Factories\\', __DIR__.'/../database/factories/');
$loader->addPsr4('Tracking\\Database\\Seeders\\', __DIR__.'/../database/seeders/');

return $loader;
