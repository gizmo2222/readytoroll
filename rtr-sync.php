<?php
// rtr-sync.php — ReadyToRoll cloud sync backend
//
// The server stores sealed blobs it cannot read. The app encrypts everything
// before upload (AES-GCM) and only ever sends a storage ID:
//   • a sync blob's ID is derived from the sync code with a slow hash; the
//     encryption key is derived separately and never leaves the device
//   • a parent blob's ID is a random token; its key lives only in the part of
//     the parent link after "#", which browsers never send to a server
// The server never sees a sync code, a key, or any drive data.
//
// Storage: rtr-sync-data/v2/{id}.blob (the data folder is denied to the web).
//
// Legacy (v1) files — rtr-sync-data/{CODE}.json, plaintext, named by sync
// code — are only read and deleted, by the app's one-time upgrade.

// ── CORS: only the app's own site may call this ──────────────────────────────
// Browsers set Origin themselves, so another website can't pretend to be us.
// Same-host requests (metacrystal.com or www.) are always allowed.
$allowed_origins = ['https://metacrystal.com', 'https://www.metacrystal.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$sameHost = $origin !== '' && strcasecmp((string)parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : ''), $_SERVER['HTTP_HOST'] ?? '') === 0;
if ($sameHost || in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} elseif ($origin === '') {
    // Same-origin or non-browser request — allow
} else {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('DATA_DIR', __DIR__ . '/rtr-sync-data/');
define('BLOB_DIR', DATA_DIR . 'v2/');
define('MAX_BLOB_BYTES', 3 * 1024 * 1024); // 3 MB per blob (encryption adds ~35%)

if (!is_dir(BLOB_DIR)) {
    mkdir(BLOB_DIR, 0750, true);
    if (!file_exists(DATA_DIR . '.htaccess')) {
        file_put_contents(DATA_DIR . '.htaccess', "Options -Indexes\nDeny from all\n");
    }
}

function respond($data) { echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function err($msg, $code = 400) { http_response_code($code); respond(['ok' => false, 'error' => $msg]); }

// ── Rate limiting (file-based, per IP) ───────────────────────────────────────
function rateLimit($action, $max, $windowSec = 60) {
    $ip   = md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = sys_get_temp_dir() . '/rtr_rl_' . $ip . '_' . $action;
    $now  = time();
    $data = ['count' => 0, 'start' => $now];
    if (file_exists($file)) {
        $raw = @json_decode(file_get_contents($file), true);
        if ($raw && ($now - $raw['start']) < $windowSec) $data = $raw;
    }
    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
    if ($data['count'] > $max) err('Too many requests — please wait a moment', 429);
}

// ── Input ─────────────────────────────────────────────────────────────────────
$body = file_get_contents('php://input', false, null, 0, MAX_BLOB_BYTES + 4096);
if (strlen($body) > MAX_BLOB_BYTES + 2048) err('Data too large', 413);
$in = $body ? json_decode($body, true) : null;
if (!is_array($in)) err('Invalid request');
$action = strtolower(trim((string)($in['action'] ?? '')));

// Storage IDs: 32 or 64 lowercase hex characters (random or hash-derived)
function blobPath($in) {
    $id = (string)($in['id'] ?? '');
    if (!preg_match('/^(?:[0-9a-f]{32}|[0-9a-f]{64})$/', $id)) err('Invalid id');
    return BLOB_DIR . $id . '.blob';
}

// Legacy sync codes: 8 characters from the old alphabet
function legacyPath($in) {
    $code = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)($in['code'] ?? '')));
    if (strlen($code) !== 8) err('Invalid code');
    return DATA_DIR . $code . '.json';
}

switch ($action) {

    // ── Fetch a sealed blob ───────────────────────────────────────────────
    case 'get':
        rateLimit('get', 60, 60);
        $path = blobPath($in);
        if (!file_exists($path)) err('Not found', 404);
        respond(['ok' => true, 'blob' => file_get_contents($path), 'updatedAt' => date('c', filemtime($path))]);

    // ── Store (create or replace) a sealed blob ───────────────────────────
    case 'put':
        rateLimit('put', 60, 60);
        $path = blobPath($in);
        $blob = $in['blob'] ?? null;
        if (!is_string($blob) || $blob === '') err('Invalid payload');
        if (strlen($blob) > MAX_BLOB_BYTES) err('Data too large (max 3 MB)', 413);
        // Must look like the app's sealed format: {"v":2,"iv":"…","ct":"…"}
        $sealed = json_decode($blob, true);
        if (!is_array($sealed) || ($sealed['v'] ?? null) !== 2 || !is_string($sealed['iv'] ?? null) || !is_string($sealed['ct'] ?? null)) {
            err('Invalid payload');
        }
        if (!file_exists($path)) rateLimit('create', 10, 300);   // new blobs are rarer
        file_put_contents($path, $blob, LOCK_EX);
        respond(['ok' => true, 'updatedAt' => date('c')]);

    // ── Delete a blob (revoked parent link, disconnected sync) ────────────
    case 'delete':
        rateLimit('delete', 20, 60);
        $path = blobPath($in);
        if (file_exists($path)) @unlink($path);
        respond(['ok' => true]);

    // ── Legacy: read an old plaintext sync file (one-time upgrade) ────────
    case 'legacy_pull':
        rateLimit('legacy', 30, 60);
        $path = legacyPath($in);
        if (!file_exists($path)) err('Sync code not found', 404);
        $data = json_decode(file_get_contents($path), true) ?: [];
        respond(['ok' => true, 'sessions' => $data['sessions'] ?? []]);

    // ── Legacy: delete an old plaintext sync file and its parent link ─────
    case 'legacy_delete':
        rateLimit('legacy', 30, 60);
        $path = legacyPath($in);
        if (file_exists($path)) {
            $data  = json_decode(file_get_contents($path), true) ?: [];
            $token = (string)($data['parentToken'] ?? '');
            if (preg_match('/^[0-9a-f]{32}$/', $token) && file_exists(DATA_DIR . $token . '.parent')) {
                @unlink(DATA_DIR . $token . '.parent');
            }
            @unlink($path);
        }
        respond(['ok' => true]);

    default:
        err('Unknown action');
}
