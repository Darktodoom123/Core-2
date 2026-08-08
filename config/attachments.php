<?php

return [
    'disk' => 'private',
    'max_bytes' => 15 * 1024 * 1024,
    'max_count_per_owner' => 10,
    'mime_extensions' => [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'image/heic-sequence' => 'heic',
        'image/heif-sequence' => 'heif',
        'application/pdf' => 'pdf',
    ],
];
