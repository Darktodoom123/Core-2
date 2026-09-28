<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | X-Forwarded-* headers are honoured only from these addresses, so HTTPS
    | URLs are generated behind the hosting platform's TLS terminator while
    | clients cannot spoof their IP. Defaults to private network ranges.
    |
    */

    'proxies' => env('TRUSTED_PROXIES', '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1,::1'),

];
