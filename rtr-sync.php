<?php
// rtr-sync.php — ReadyToRoll cloud sync backend
// Flat-file storage: one JSON file per sync code
// Deploy to metacrystal.com alongside readytoroll.html

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
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

$action = strtolower(trim($_GET['action'] ?? $_POST['action'] ?? ''));
$code   = preg_replace('/[^A-Z0-9]/', '', strtoupper($_GET['code'] ?? $_POST['code'] ?? ''));

switch ($action) {

    // ── Create a new sync code ───────────────────────────────────────────
    case 'create':
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
        if (strlen($code) !== 8) err('Invalid code');
        respond(['ok' => true, 'exists' => file_exists(DATA_DIR . $code . '.json')]);
        break;

    // ── Push sessions up to the server ──────────────────────────────────
    case 'push':
        if (strlen($code) !== 8) err('Invalid code');
        $path = DATA_DIR . $code . '.json';
        if (!file_exists($path)) err('Sync code not found', 404);
        $body = file_get_contents('php://input');
        if (!$body) err('Empty body');
        if (strlen($body) > MAX_FILE_BYTES) err('Data too large (max 2 MB)');
        $payload = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE || !isset($payload['sessions']) || !is_array($payload['sessions'])) {
            err('Invalid JSON payload');
        }
        $existing = json_decode(file_get_contents($path), true) ?: [];
        $existing['sessions']  = $payload['sessions'];
        $existing['updatedAt'] = date('c');
        file_put_contents($path, json_encode($existing, JSON_UNESCAPED_UNICODE), LOCK_EX);
        respond(['ok' => true, 'updatedAt' => $existing['updatedAt'], 'count' => count($existing['sessions'])]);
        break;

    // ── Pull sessions from the server ────────────────────────────────────
    case 'pull':
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
