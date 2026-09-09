<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in(__DIR__.'/Tracking');
