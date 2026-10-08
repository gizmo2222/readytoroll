<?php
// rtr-sync.php — ReadyToRoll cloud sync backend
// Flat-file storage: one JSON file per sync code
// Parent tokens stored as {token}.parent files mapping token → sync code

// ── CORS: restrict to the app's own origin ───────────────────────────────────
$allowed_origins = ['https://metacrystal.com', 'https://www.metacrystal.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('DATA_DIR', __DIR__ . '/rtr-sync-data/');
define('MAX_FILE_BYTES', 2 * 1024 * 1024); // 2 MB per sync code

if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0750, true);
    file_put_contents(DATA_DIR . '.htaccess', "Options -Indexes\nDeny from all\n");
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
    if ($data['count'] > $max) {
        http_response_code(429);
        respond(['ok' => false, 'error' => 'Too many requests — please wait a moment']);
    }
}

// ── Input parsing ─────────────────────────────────────────────────────────────
$body   = file_get_contents('php://input');
$parsed = $body ? @json_decode($body, true) : null;

$action = strtolower(trim($parsed['action'] ?? $_GET['action'] ?? $_POST['action'] ?? ''));
// Sanitise sync code: uppercase alphanumeric only — prevents path traversal
$rawCode = $parsed['code'] ?? $_GET['code'] ?? $_POST['code'] ?? '';
$code    = preg_replace('/[^A-Z0-9]/', '', strtoupper($rawCode));
// Sanitise parent token: lowercase hex only — 32 chars
$rawToken   = $parsed['parentToken'] ?? '';
$parentToken = preg_replace('/[^0-9a-f]/', '', strtolower($rawToken));

switch ($action) {

    // ── Create a new sync code ───────────────────────────────────────────
    case 'create':
        rateLimit('create', 5, 300);
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($tries = 0; $tries < 30; $tries++) {
            $candidate = '';
            for ($i = 0; $i < 8; $i++) $candidate .= $chars[random_int(0, strlen($chars) - 1)];
            $path = DATA_DIR . $candidate . '.json';
            if (!file_exists($path)) {
                $init = ['created' => date('c'), 'updatedAt' => date('c'), 'sessions' => [], 'parentToken' => null];
                file_put_contents($path, json_encode($init), LOCK_EX);
                respond(['ok' => true, 'code' => $candidate]);
            }
        }
        err('Could not generate a unique code — try again');
        break;

    // ── Check whether a sync code exists ─────────────────────────────────
    case 'check':
        rateLimit('check', 15, 60);
        if (strlen($code) !== 8) err('Invalid code');
        respond(['ok' => true, 'exists' => file_exists(DATA_DIR . $code . '.json')]);
        break;

    // ── Push sessions up to the server ───────────────────────────────────
    case 'push':
        rateLimit('push', 60, 60);
        if (strlen($code) !== 8) err('Invalid code');
        $path = DATA_DIR . $code . '.json';
        if (!file_exists($path)) err('Sync code not found', 404);
        $sessions = $parsed['sessions'] ?? null;
        if (!is_array($sessions)) err('Invalid payload');
        if (strlen($body) > MAX_FILE_BYTES) err('Data too large (max 2 MB)');
        $existing = json_decode(file_get_contents($path), true) ?: [];
        $existing['sessions']  = $sessions;
        $existing['updatedAt'] = date('c');
        // Never overwrite parentToken via push
        file_put_contents($path, json_encode($existing, JSON_UNESCAPED_UNICODE), LOCK_EX);
        respond(['ok' => true, 'updatedAt' => $existing['updatedAt'], 'count' => count($existing['sessions'])]);
        break;

    // ── Pull sessions from the server (authenticated by sync code) ────────
    case 'pull':
        rateLimit('pull', 60, 60);
        if (strlen($code) !== 8) err('Invalid code');
        $path = DATA_DIR . $code . '.json';
        if (!file_exists($path)) err('Sync code not found', 404);
        $data = json_decode(file_get_contents($path), true);
        respond([
            'ok'        => true,
            'sessions'  => $data['sessions']  ?? [],
            'updatedAt' => $data['updatedAt'] ?? null,
            'count'     => count($data['sessions'] ?? [])
        ]);
        break;

    // ── Create (or rotate) a parent view token ────────────────────────────
    // Requires the sync code. Returns a 32-char hex token that the parent
    // uses instead of the sync code, keeping the two credentials separate.
    case 'create_parent_token':
        rateLimit('create_parent', 10, 300); // 10 per IP per 5 min
        if (strlen($code) !== 8) err('Invalid code');
        $syncPath = DATA_DIR . $code . '.json';
        if (!file_exists($syncPath)) err('Sync code not found', 404);

        $syncData = json_decode(file_get_contents($syncPath), true) ?: [];

        // Delete the old parent token file if one exists
        $oldToken = $syncData['parentToken'] ?? null;
        if ($oldToken && strlen($oldToken) === 32 && ctype_xdigit($oldToken)) {
            $oldFile = DATA_DIR . $oldToken . '.parent';
            if (file_exists($oldFile)) @unlink($oldFile);
        }

        // Generate a new 32-char hex token (128-bit random)
        $newToken = bin2hex(random_bytes(16));
        // Write the reverse-lookup file: token → sync code
        file_put_contents(DATA_DIR . $newToken . '.parent', $code, LOCK_EX);
        // Store token reference in the sync file
        $syncData['parentToken'] = $newToken;
        file_put_contents($syncPath, json_encode($syncData, JSON_UNESCAPED_UNICODE), LOCK_EX);

        respond(['ok' => true, 'parentToken' => $newToken]);
        break;

    // ── Pull sessions using a parent token (read-only, no sync code needed) ─
    case 'parent_pull':
        rateLimit('parent_pull', 60, 60);
        if (strlen($parentToken) !== 32) err('Invalid parent token');
        $lookupFile = DATA_DIR . $parentToken . '.parent';
        if (!file_exists($lookupFile)) err('Parent link not found or revoked', 404);
        $syncCode = trim(file_get_contents($lookupFile));
        $syncCode = preg_replace('/[^A-Z0-9]/', '', strtoupper($syncCode));
        if (strlen($syncCode) !== 8) err('Corrupted parent link', 500);
        $syncPath = DATA_DIR . $syncCode . '.json';
        if (!file_exists($syncPath)) err('Associated data not found', 404);
        $data = json_decode(file_get_contents($syncPath), true);
        respond([
            'ok'        => true,
            'sessions'  => $data['sessions']  ?? [],
            'updatedAt' => $data['updatedAt'] ?? null,
            'count'     => count($data['sessions'] ?? [])
        ]);
        break;

    default:
        err('Unknown action');
}
