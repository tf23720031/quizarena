from flask import Flask, send_from_directory, request, jsonify
import os, sqlite3, json, hashlib, random, time, threading
from contextlib import closing

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = BASE_DIR
USERS_DB_PATH = os.path.join(BASE_DIR, 'quizarena.db')
ROOMS_DB_PATH = os.path.join(BASE_DIR, 'rooms.db')
QUIZ_BANKS_PATH = os.path.join(BASE_DIR, 'quiz_banks.json')

app = Flask(__name__, static_folder=PROJECT_DIR, static_url_path='')

DEFAULT_FACE = 'images/face/face.png'
DEFAULT_HAIR = 'images/hair/hair01.png'
DEFAULT_EYES = 'images/face/eyes01.png'

_quiz_lock = threading.Lock()


def log_startup_diagnostics():
    try:
        files = sorted(os.listdir(PROJECT_DIR))
    except Exception as exc:
        files = [f'<listdir failed: {exc}>']
    print('[QuizArena] BASE_DIR =', BASE_DIR, flush=True)
    print('[QuizArena] PROJECT_DIR =', PROJECT_DIR, flush=True)
    print('[QuizArena] index.html exists =', os.path.exists(os.path.join(PROJECT_DIR, 'index.html')), flush=True)
    print('[QuizArena] app.py exists =', os.path.exists(os.path.join(PROJECT_DIR, 'app.py')), flush=True)
    print('[QuizArena] project files =', files, flush=True)


def now_ts():
    return int(time.time())


def host_alive_cutoff(seconds=80):
    return now_ts() - seconds


def uid(prefix='id'):
    return f"{prefix}_{now_ts()}_{random.randint(1000,9999)}"


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def dict_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def get_conn(path=ROOMS_DB_PATH):
    conn = sqlite3.connect(path)
    conn.row_factory = dict_factory
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn


def ensure_file(path, default_obj):
    if not os.path.exists(path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(default_obj, f, ensure_ascii=False, indent=2)


def load_quiz_store():
    ensure_file(QUIZ_BANKS_PATH, {'users': {}})
    with open(QUIZ_BANKS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, dict) or not isinstance(data.get('users'), dict):
        data = {'users': {}}
    return data


def save_quiz_store(data):
    with open(QUIZ_BANKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_quiz_banks_for_user(username):
    with _quiz_lock:
        return load_quiz_store()['users'].get(username, [])


def save_quiz_banks_for_user(username, banks):
    with _quiz_lock:
        data = load_quiz_store()
        data['users'][username] = banks
        save_quiz_store(data)


def validate_pin(pin):
    return bool(pin and len(pin) == 6 and pin.isdigit())


def room_exists(pin):
    with closing(get_conn()) as conn:
        return conn.execute('SELECT 1 FROM rooms WHERE pin = ?', (pin,)).fetchone() is not None

