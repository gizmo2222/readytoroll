<?php
// rtr-sync.php — ReadyToRoll cloud sync backend
// Flat-file storage: one JSON file per sync code
// Deploy to metacrystal.com alongside readytoroll.html

// ── CORS: restrict to the app's own origin ───────────────────────────────────
$allowed_origins = ['https://metacrystal.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} elseif ($origin === '') {
    // Same-origin or non-browser request — allow (no ACAO header needed)
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

// Create data directory and protect it on first run
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0750, true);
    file_put_contents(DATA_DIR . '.htaccess', "Options -Indexes\nDeny from all\n");
}

function respond($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function err($msg, $code = 400) {
    http_response_code($code);
    respond(['ok' => false, 'error' => $msg]);
}

// ── Rate limiting (file-based, per IP) ───────────────────────────────────────
function rateLimit($action, $max, $windowSec = 60) {
    $ip   = md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = sys_get_temp_dir() . '/rtr_rl_' . $ip . '_' . $action;
    $now  = time();
    $data = ['count' => 0, 'start' => $now];
    if (file_exists($file)) {
        $raw = @json_decode(file_get_contents($file), true);
        if ($raw && ($now - $raw['start']) < $windowSec) {
            $data = $raw;
        }
    }
    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
    if ($data['count'] > $max) {
        http_response_code(429);
        respond(['ok' => false, 'error' => 'Too many requests — please wait a moment']);
    }
}

// ── Parse request: all actions now come via POST JSON body ────────────────────
// Legacy GET params still accepted for backwards compatibility during rollout
$body   = file_get_contents('php://input');
$parsed = $body ? @json_decode($body, true) : null;

$action = strtolower(trim($parsed['action'] ?? $_GET['action'] ?? $_POST['action'] ?? ''));
// Sanitise code: uppercase alphanumeric only — prevents any path traversal
$rawCode = $parsed['code'] ?? $_GET['code'] ?? $_POST['code'] ?? '';
$code    = preg_replace('/[^A-Z0-9]/', '', strtoupper($rawCode));

switch ($action) {

    // ── Create a new sync code ───────────────────────────────────────────
    case 'create':
        rateLimit('create', 5, 300); // max 5 creates per IP per 5 min
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
        for ($tries = 0; $tries < 30; $tries++) {
            $candidate = '';
            for ($i = 0; $i < 8; $i++) $candidate .= $chars[random_int(0, strlen($chars) - 1)];
            $path = DATA_DIR . $candidate . '.json';
            if (!file_exists($path)) {
                $init = ['created' => date('c'), 'updatedAt' => date('c'), 'sessions' => []];
                file_put_contents($path, json_encode($init), LOCK_EX);
                respond(['ok' => true, 'code' => $candidate]);
            }
        }
        err('Could not generate a unique code — try again');
        break;

    // ── Check whether a code exists ──────────────────────────────────────
    case 'check':
        rateLimit('check', 15, 60); // max 15 checks per IP per minute
        if (strlen($code) !== 8) err('Invalid code');
        respond(['ok' => true, 'exists' => file_exists(DATA_DIR . $code . '.json')]);
        break;

    // ── Push sessions up to the server ──────────────────────────────────
    case 'push':
        rateLimit('push', 60, 60); // max 60 pushes per IP per minute
        if (strlen($code) !== 8) err('Invalid code');
        $path = DATA_DIR . $code . '.json';
        if (!file_exists($path)) err('Sync code not found', 404);
        // Accept sessions from JSON body (new) or legacy separate body
        $sessions = $parsed['sessions'] ?? null;
        if ($sessions === null) {
            // Legacy path: body is {sessions:[...]}
            $legacy = @json_decode($body, true);
            $sessions = $legacy['sessions'] ?? null;
        }
        if (!is_array($sessions)) err('Invalid payload');
        if (strlen($body) > MAX_FILE_BYTES) err('Data too large (max 2 MB)');
        $existing = json_decode(file_get_contents($path), true) ?: [];
        $existing['sessions']  = $sessions;
        $existing['updatedAt'] = date('c');
        file_put_contents($path, json_encode($existing, JSON_UNESCAPED_UNICODE), LOCK_EX);
        respond(['ok' => true, 'updatedAt' => $existing['updatedAt'], 'count' => count($existing['sessions'])]);
        break;

    // ── Pull sessions from the server ────────────────────────────────────
    case 'pull':
        rateLimit('pull', 60, 60); // max 60 pulls per IP per minute
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

    default:
        err('Unknown action');
}
