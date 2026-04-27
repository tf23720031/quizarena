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


def fetch_room(pin):
    with closing(get_conn()) as conn:
        return conn.execute('SELECT * FROM rooms WHERE pin = ?', (pin,)).fetchone()


def generate_unique_pin(length=6):
    while True:
        pin = str(random.randint(10 ** (length - 1), (10 ** length) - 1))
        if not room_exists(pin):
            return pin


def serialize_room(room):
    if not room:
        return None
    room = dict(room)
    for key in ['is_private', 'team_mode', 'allow_lobby_join']:
        room[key] = bool(room.get(key, 0))
    room['room_key_plain'] = room.get('room_key_plain') or ''
    return room


def delete_room_fully(conn, pin):
    conn.execute('DELETE FROM room_results WHERE room_pin = ?', (pin,))
    conn.execute('DELETE FROM room_questions WHERE room_pin = ?', (pin,))
    conn.execute('DELETE FROM room_messages WHERE room_pin = ?', (pin,))
    conn.execute('DELETE FROM room_players WHERE room_pin = ?', (pin,))
    conn.execute('DELETE FROM room_teams WHERE room_pin = ?', (pin,))
    conn.execute('DELETE FROM rooms WHERE pin = ?', (pin,))


def get_player_payload(raw_player):
    p = raw_player or {}
    return {
        'name': str(p.get('name', '')).strip(),
        'face': str(p.get('face', DEFAULT_FACE)).strip() or DEFAULT_FACE,
        'hair': str(p.get('hair', DEFAULT_HAIR)).strip() or DEFAULT_HAIR,
        'eyes': str(p.get('eyes', DEFAULT_EYES)).strip() or DEFAULT_EYES,
        'eyes_offset_y': int(p.get('eyesOffsetY', 0) or 0),
        'is_host': 1 if bool(p.get('isHost', False)) else 0,
    }


def calc_kahoot_score(base_score, time_limit_sec, remain_sec, answer_order):
    if base_score <= 0:
        return 0
    time_ratio = max(0.5, remain_sec / max(time_limit_sec, 1))
    order_ratio = max(0.6, 1.0 - (answer_order - 1) * 0.05)
    raw = base_score * time_ratio * order_ratio
    return int(round(raw / 10) * 10)


def init_users_db():
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
        ''')
        conn.commit()


def init_rooms_db():
    with closing(sqlite3.connect(ROOMS_DB_PATH)) as conn:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pin TEXT UNIQUE NOT NULL,
                room_name TEXT, bank_id TEXT, bank_title TEXT, created_by TEXT,
                is_private INTEGER DEFAULT 0, room_key_hash TEXT,
                status TEXT DEFAULT 'waiting',
                max_players INTEGER DEFAULT 8,
                team_mode INTEGER DEFAULT 0,
                team_count INTEGER DEFAULT 2,
                team_size INTEGER DEFAULT 4,
                allow_lobby_join INTEGER DEFAULT 1,
                current_question_index INTEGER DEFAULT 0,
                game_start_ts INTEGER DEFAULT 0,
                created_at INTEGER
            )
        ''')
        c.execute('PRAGMA table_info(rooms)')
        existing = {row[1] for row in c.fetchall()}
        needed = {
            'room_name': 'TEXT', 'bank_id': 'TEXT', 'bank_title': 'TEXT', 'created_by': 'TEXT',
            'is_private': 'INTEGER DEFAULT 0', 'room_key_hash': 'TEXT',
            'room_key_plain': 'TEXT DEFAULT ""',
            'status': "TEXT DEFAULT 'waiting'", 'max_players': 'INTEGER DEFAULT 8',
            'team_mode': 'INTEGER DEFAULT 0', 'team_count': 'INTEGER DEFAULT 2',
            'team_size': 'INTEGER DEFAULT 4', 'allow_lobby_join': 'INTEGER DEFAULT 1',
            'current_question_index': 'INTEGER DEFAULT 0',
            'phase': "TEXT DEFAULT 'question'",
            'game_start_ts': 'INTEGER DEFAULT 0', 'created_at': 'INTEGER'
        }
        for col, typ in needed.items():
            if col not in existing:
                c.execute(f'ALTER TABLE rooms ADD COLUMN {col} {typ}')

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT NOT NULL, team_id INTEGER NOT NULL, team_name TEXT,
                UNIQUE(room_pin, team_id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT NOT NULL, player_name TEXT NOT NULL,
                face TEXT, hair TEXT, eyes TEXT, eyes_offset_y INTEGER DEFAULT 0,
                is_host INTEGER DEFAULT 0, team_id INTEGER DEFAULT 0,
                joined_at INTEGER, last_seen INTEGER,
                UNIQUE(room_pin, player_name)
            )
        ''')
        c.execute('PRAGMA table_info(room_players)')
        pcols = {row[1] for row in c.fetchall()}
        for col, typ in [('last_seen', 'INTEGER'), ('team_id', 'INTEGER DEFAULT 0'), ('is_eliminated', 'INTEGER DEFAULT 0')]:
            if col not in pcols:
                c.execute(f'ALTER TABLE room_players ADD COLUMN {col} {typ}')

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT NOT NULL, sender_name TEXT NOT NULL, message TEXT NOT NULL,
                face TEXT, hair TEXT, eyes TEXT, eyes_offset_y INTEGER DEFAULT 0,
                team_id INTEGER DEFAULT -1, created_at INTEGER
            )
        ''')
        c.execute('PRAGMA table_info(room_messages)')
        mcols = {row[1] for row in c.fetchall()}
        if 'team_id' not in mcols:
            c.execute('ALTER TABLE room_messages ADD COLUMN team_id INTEGER DEFAULT -1')

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT NOT NULL, question_id TEXT NOT NULL, seq INTEGER NOT NULL,
                title TEXT, content TEXT, type TEXT, options_json TEXT, answer_json TEXT,
                explanation TEXT, time_label TEXT, score INTEGER DEFAULT 1000,
                fake_answer INTEGER DEFAULT 0, mode TEXT, image TEXT,
                origin_bank_id TEXT, origin_question_id TEXT,
                UNIQUE(room_pin, question_id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT NOT NULL, player_name TEXT NOT NULL, question_id TEXT NOT NULL,
                selected_json TEXT, is_correct INTEGER DEFAULT 0,
                points_earned INTEGER DEFAULT 0, answer_order INTEGER DEFAULT 0,
                remain_sec INTEGER DEFAULT 0, answered_at INTEGER,
                UNIQUE(room_pin, player_name, question_id)
            )
        ''')
        c.execute('PRAGMA table_info(room_results)')
        rcols = {row[1] for row in c.fetchall()}
        for col, typ in [('answer_order', 'INTEGER DEFAULT 0'), ('remain_sec', 'INTEGER DEFAULT 0')]:
            if col not in rcols:
                c.execute(f'ALTER TABLE room_results ADD COLUMN {col} {typ}')

        conn.commit()


init_users_db()
init_rooms_db()
ensure_file(QUIZ_BANKS_PATH, {'users': {}})
log_startup_diagnostics()


@app.route('/')
def home():
    return send_from_directory(PROJECT_DIR, 'index.html')


@app.route('/__debug_routes')
def debug_routes():
    return jsonify(
        success=True,
        base_dir=BASE_DIR,
        project_dir=PROJECT_DIR,
        index_exists=os.path.exists(os.path.join(PROJECT_DIR, 'index.html')),
        files=sorted(os.listdir(PROJECT_DIR)),
        routes=sorted(str(rule) for rule in app.url_map.iter_rules())
    )


for page in ['create_home.html', 'player_join.html', 'waiting_room.html',
             'house_waiting_room.html', 'quiz_game.html']:
    app.add_url_rule('/' + page, page,
                     lambda page=page: send_from_directory(PROJECT_DIR, page))


@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip()
        password = str(data.get('password', '')).strip()
        if len(username) < 3:
            return jsonify(success=False, message='帳號至少需要 3 個字元'), 400
        if '@' not in email or '.' not in email.split('@')[-1]:
            return jsonify(success=False, message='Email 格式不正確'), 400
        if len(password) < 6:
            return jsonify(success=False, message='密碼至少需要 6 個字元'), 400
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                         (username, email, hash_text(password)))
            conn.commit()
        return jsonify(success=True, message='註冊成功')
    except sqlite3.IntegrityError as e:
        text = str(e).lower()
        msg = '帳號已存在' if 'username' in text else ('Email 已存在' if 'email' in text else '帳號或 Email 已存在')
        return jsonify(success=False, message=msg), 400
    except Exception as e:
        return jsonify(success=False, message=f'伺服器錯誤：{e}'), 500


@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        password = str(data.get('password', '')).strip()
        with closing(get_conn(USERS_DB_PATH)) as conn:
            user = conn.execute(
                'SELECT username, email FROM users WHERE username = ? AND password = ?',
                (username, hash_text(password))
            ).fetchone()
        if not user:
            return jsonify(success=False, message='帳號或密碼錯誤'), 401
        return jsonify(success=True, username=user['username'], email=user['email'], message='登入成功')
    except Exception as e:
        return jsonify(success=False, message=f'伺服器錯誤：{e}'), 500


@app.route('/load_quiz_banks')
def load_quiz_banks_api():
    username = request.args.get('username', '').strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(success=True, quizBanks=load_quiz_banks_for_user(username))


@app.route('/save_quiz_banks', methods=['POST'])
def save_quiz_banks_api():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        banks = data.get('quizBanks', [])
        if not username or not isinstance(banks, list):
            return jsonify(success=False, message='題庫格式錯誤'), 400
        save_quiz_banks_for_user(username, banks)
        return jsonify(success=True, message='題庫已儲存')
    except Exception as e:
        return jsonify(success=False, message=f'儲存失敗：{e}'), 500


@app.route('/copy_quiz_bank', methods=['POST'])
def copy_quiz_bank():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        bank_id = str(data.get('bankId', '')).strip()
        new_title = str(data.get('newTitle', '')).strip()
        banks = load_quiz_banks_for_user(username)
        target = next((b for b in banks if str(b.get('id')) == bank_id), None)
        if not target:
            return jsonify(success=False, message='找不到題庫'), 404
        copied = json.loads(json.dumps(target))
        copied['id'] = uid('bank')
        copied['title'] = new_title or f"{target.get('title', '未命名題庫')}（副本）"
        copied['updatedAt'] = now_ts()
        banks.insert(0, copied)
        save_quiz_banks_for_user(username, banks)
        return jsonify(success=True, quizBanks=banks, message='題庫已複製')
    except Exception as e:
        return jsonify(success=False, message=f'複製失敗：{e}'), 500


@app.route('/rename_quiz_bank', methods=['POST'])
def rename_quiz_bank():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        bank_id = str(data.get('bankId', '')).strip()
        new_title = str(data.get('newTitle', '')).strip()
        banks = load_quiz_banks_for_user(username)
        for bank in banks:
            if str(bank.get('id')) == bank_id:
                bank['title'] = new_title
                bank['updatedAt'] = now_ts()
                save_quiz_banks_for_user(username, banks)
                return jsonify(success=True, quizBanks=banks, message='題庫已重新命名')
        return jsonify(success=False, message='找不到題庫'), 404
    except Exception as e:
        return jsonify(success=False, message=f'重新命名失敗：{e}'), 500


@app.route('/delete_quiz_bank', methods=['POST'])
def delete_quiz_bank():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        bank_id = str(data.get('bankId', '')).strip()
        banks = load_quiz_banks_for_user(username)
        new_banks = [b for b in banks if str(b.get('id')) != bank_id]
        if len(new_banks) == len(banks):
            return jsonify(success=False, message='找不到題庫'), 404
        save_quiz_banks_for_user(username, new_banks)
        return jsonify(success=True, quizBanks=new_banks, message='題庫已刪除')
    except Exception as e:
        return jsonify(success=False, message=f'刪除失敗：{e}'), 500


@app.route('/lobby_rooms')
def lobby_rooms():
    try:
        with closing(get_conn()) as conn:
            stale = conn.execute('''
                SELECT DISTINCT r.pin FROM rooms r
                LEFT JOIN room_players hp ON hp.room_pin=r.pin AND hp.is_host=1
                WHERE hp.id IS NULL OR COALESCE(hp.last_seen,hp.joined_at,0) < ?
            ''', (host_alive_cutoff(),)).fetchall()
            for s in stale:
                delete_room_fully(conn, s['pin'])
            if stale:
                conn.commit()
            rows = conn.execute('''
                SELECT r.*,
                       COUNT(CASE WHEN NOT (p.player_name LIKE '__host_%__' AND p.is_host=1)
                                  THEN p.id END) AS player_count,
                       GROUP_CONCAT(CASE WHEN NOT (p.player_name LIKE '__host_%__' AND p.is_host=1)
                                         THEN p.player_name END, '||') AS player_names
                FROM rooms r LEFT JOIN room_players p ON p.room_pin=r.pin
                WHERE r.status!='closed' AND (r.allow_lobby_join=1 OR r.is_private=1)
                  AND EXISTS(SELECT 1 FROM room_players hp WHERE hp.room_pin=r.pin
                             AND hp.is_host=1 AND COALESCE(hp.last_seen,hp.joined_at,0)>=?)
                GROUP BY r.pin ORDER BY r.created_at DESC,r.id DESC
            ''', (host_alive_cutoff(),)).fetchall()
        result = []
        for row in rows:
            room = serialize_room(row)
            room['player_count'] = int(room.get('player_count', 0) or 0)
            room['player_names'] = [n for n in str(room.get('player_names') or '').split('||')
                                     if n and not (n.startswith('__host_') and n.endswith('__'))]
            room['joinable'] = (room['status'] == 'waiting'
                                and room['player_count'] < int(room.get('max_players', 8) or 8))
            room['display_name'] = room.get('room_name') or room.get('bank_title') or f"房間 {room['pin']}"
            result.append(room)
        return jsonify(success=True, rooms=result)
    except Exception as e:
        return jsonify(success=False, message=f'讀取大廳失敗：{e}'), 500


@app.route('/check_pin', methods=['POST'])
def check_pin():
    data = request.get_json() or {}
    pin = str(data.get('pin', '')).strip()
    if not validate_pin(pin):
        return jsonify(success=False, message='PIN 必須是 6 位數字'), 400
    room = fetch_room(pin)
    if not room:
        return jsonify(success=False, message='房間不存在'), 404
    with closing(get_conn()) as conn:
        host_exists = conn.execute(
            'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
            (pin, host_alive_cutoff())
        ).fetchone()
        if not host_exists:
            delete_room_fully(conn, pin)
            conn.commit()
            return jsonify(success=False, message='房間不存在'), 404
    room = serialize_room(room)
    return jsonify(success=True, room=room, requiresKey=room['is_private'])


@app.route('/verify_room_key', methods=['POST'])
def verify_room_key():
    data = request.get_json() or {}
    pin = str(data.get('pin', '')).strip()
    room_key = str(data.get('roomKey', '')).strip()
    room = serialize_room(fetch_room(pin))
    if not room:
        return jsonify(success=False, message='房間不存在'), 404
    with closing(get_conn()) as conn:
        host_exists = conn.execute(
            'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
            (pin, host_alive_cutoff())
        ).fetchone()
        if not host_exists:
            delete_room_fully(conn, pin)
            conn.commit()
            return jsonify(success=False, message='房間不存在'), 404
    if not room['is_private']:
        return jsonify(success=True, message='公開房間')
    if not room_key:
        return jsonify(success=False, message='請輸入房間密鑰'), 400
    if hash_text(room_key) != (room.get('room_key_hash') or ''):
        return jsonify(success=False, message='密鑰錯誤'), 401
    return jsonify(success=True, message='密鑰正確')


@app.route('/create_room', methods=['POST'])
def create_room():
    try:
        data = request.get_json() or {}
        bank_id = str(data.get('bankId', '')).strip()
        bank_title = str(data.get('bankTitle', '')).strip()
        created_by = str(data.get('createdBy', '')).strip()
        room_name = str(data.get('roomName', '')).strip() or bank_title or 'QuizArena Room'
        is_private = 1 if bool(data.get('isPrivate', False)) else 0
        room_key = str(data.get('roomKey', '')).strip()
        allow_lobby_join = 1 if (is_private or bool(data.get('allowLobbyJoin', True))) else 0
        team_mode = 1 if bool(data.get('teamMode', False)) else 0
        team_count = max(2, int(data.get('teamCount', 2) or 2))
        team_size = max(1, int(data.get('teamSize', 4) or 4))
        max_players = int(data.get('maxPlayers', 8) or 8)
        room_questions = data.get('roomQuestions', [])

        if not created_by:
            return jsonify(success=False, message='請先登入再建立房間'), 400
        if not bank_id:
            return jsonify(success=False, message='請先選擇題庫'), 400
        if is_private and not room_key:
            return jsonify(success=False, message='私人房必須設定密鑰'), 400
        if not isinstance(room_questions, list) or not room_questions:
            return jsonify(success=False, message='建立房間前請先選擇至少一題'), 400

        pin = generate_unique_pin()

        with closing(get_conn()) as conn:
            old_rooms = conn.execute('SELECT pin FROM rooms WHERE created_by=?', (created_by,)).fetchall()
            for old in old_rooms:
                delete_room_fully(conn, old['pin'])

            conn.execute('''
                INSERT INTO rooms
                (pin,room_name,bank_id,bank_title,created_by,is_private,room_key_hash,room_key_plain,
                 status,max_players,team_mode,team_count,team_size,allow_lobby_join,
                 current_question_index,game_start_ts,created_at)
                VALUES (?,?,?,?,?,?,?,?,'waiting',?,?,?,?,?,0,0,?)
            ''', (pin, room_name, bank_id, bank_title, created_by, is_private,
                  hash_text(room_key) if is_private else '',
                  room_key if is_private else '', max_players,
                  team_mode, team_count, team_size, allow_lobby_join, now_ts()))

            if team_mode:
                team_names = data.get('teamNames', [])
                for i in range(team_count):
                    name = (team_names[i] if i < len(team_names) else None) or f'隊伍 {i+1}'
                    conn.execute(
                        'INSERT OR IGNORE INTO room_teams (room_pin,team_id,team_name) VALUES (?,?,?)',
                        (pin, i+1, name))

            for idx, q in enumerate(room_questions):
                options = q.get('options', [])
                answer_indexes = sorted([i for i, opt in enumerate(options) if opt.get('correct')])
                conn.execute('''
                    INSERT INTO room_questions
                    (room_pin,question_id,seq,title,content,type,options_json,answer_json,
                     explanation,time_label,score,fake_answer,mode,image,origin_bank_id,origin_question_id)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ''', (pin, str(q.get('roomQuestionId') or uid('rq')), idx,
                      q.get('title',''), q.get('content',''), q.get('type','single'),
                      json.dumps(options, ensure_ascii=False),
                      json.dumps(answer_indexes, ensure_ascii=False),
                      q.get('explanation',''), q.get('time','20 秒'),
                      int(q.get('score',1000) or 1000), 1 if q.get('fakeAnswer') else 0,
                      q.get('mode','個人賽'), q.get('image',''), bank_id, str(q.get('id',''))))

            # 建房時插入佔位房主（用 created_by 帳號名稱當 key）
            # player_join 完成後 join_room ON CONFLICT DO UPDATE 會覆蓋成真正的玩家資料
            conn.execute('''
                INSERT OR IGNORE INTO room_players
                (room_pin, player_name, face, hair, eyes, eyes_offset_y, is_host, team_id, joined_at, last_seen)
                VALUES (?, ?, 'images/face/face.png', 'images/hair/hair01.png', 'images/face/eyes01.png', 0, 1, 0, ?, ?)
            ''', (pin, f'__host_{created_by}__', now_ts(), now_ts()))
            conn.commit()

        return jsonify(success=True, message='房間建立成功', room=serialize_room(fetch_room(pin)))
    except Exception as e:
        return jsonify(success=False, message=f'建立房間失敗：{e}'), 500


@app.route('/join_room', methods=['POST'])
def join_room():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        room_key = str(data.get('roomKey', '')).strip()
        player = get_player_payload(data.get('player', {}))
        team_id = int(data.get('teamId', 0) or 0)

        if not validate_pin(pin):
            return jsonify(success=False, message='PIN 格式錯誤'), 400
        if not player['name']:
            return jsonify(success=False, message='請輸入玩家名稱'), 400

        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            room = serialize_room(room)

            if room['status'] not in ['waiting', 'playing']:
                return jsonify(success=False, message='房間目前不可加入'), 400

            count = conn.execute(
                "SELECT COUNT(*) AS total FROM room_players WHERE room_pin=?"
                " AND NOT (player_name LIKE '__host_%__' AND is_host=1)", (pin,)
            ).fetchone()['total']
            if count >= int(room.get('max_players', 8) or 8):
                return jsonify(success=False, message='房間已滿'), 400

            if room['is_private'] and hash_text(room_key) != (room.get('room_key_hash') or ''):
                return jsonify(success=False, message='密鑰錯誤'), 401

            host_exists = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
                (pin, host_alive_cutoff())
            ).fetchone()
            if not host_exists and not player['is_host']:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=False, message='房間不存在'), 404

            conn.execute('''
                INSERT INTO room_players
                (room_pin,player_name,face,hair,eyes,eyes_offset_y,is_host,team_id,joined_at,last_seen)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(room_pin,player_name) DO UPDATE SET
                    face=excluded.face,hair=excluded.hair,eyes=excluded.eyes,
                    eyes_offset_y=excluded.eyes_offset_y,is_host=excluded.is_host,
                    team_id=excluded.team_id,joined_at=excluded.joined_at,last_seen=excluded.last_seen
            ''', (pin, player['name'], player['face'], player['hair'], player['eyes'],
                  player['eyes_offset_y'], player['is_host'], team_id, now_ts(), now_ts()))
            conn.commit()

        return jsonify(success=True, message='加入房間成功', room=serialize_room(fetch_room(pin)))
    except Exception as e:
        return jsonify(success=False, message=f'加入房間失敗：{e}'), 500


@app.route('/choose_team', methods=['POST'])
def choose_team():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        team_id = int(data.get('teamId', 0) or 0)
        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            if room.get('status') != 'waiting':
                return jsonify(success=False, message='遊戲已開始，無法換隊'), 400
            team_size = int(room.get('team_size') or 4)
            cur_count = conn.execute(
                'SELECT COUNT(*) AS c FROM room_players WHERE room_pin=? AND team_id=? AND player_name!=?',
                (pin, team_id, player_name)
            ).fetchone()['c']
            if cur_count >= team_size:
                return jsonify(success=False, message='這隊已滿，請選其他隊'), 400
            conn.execute('UPDATE room_players SET team_id=? WHERE room_pin=? AND player_name=?',
                         (team_id, pin, player_name))
            conn.commit()
        return jsonify(success=True, message='選隊成功')
    except Exception as e:
        return jsonify(success=False, message=f'選隊失敗：{e}'), 500


@app.route('/shuffle_teams', methods=['POST'])
def shuffle_teams():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        with closing(get_conn()) as conn:
            host = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1',
                (pin, player_name)
            ).fetchone()
            if not host:
                return jsonify(success=False, message='只有房主可以隨機分組'), 403
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            team_count = int(room.get('team_count') or 2)
            players = conn.execute(
                'SELECT player_name FROM room_players WHERE room_pin=? AND is_host=0', (pin,)
            ).fetchall()
            names = [p['player_name'] for p in players]
            random.shuffle(names)
            for i, name in enumerate(names):
                conn.execute('UPDATE room_players SET team_id=? WHERE room_pin=? AND player_name=?',
                             ((i % team_count) + 1, pin, name))
            conn.commit()
        return jsonify(success=True, message='隨機分組完成')
    except Exception as e:
        return jsonify(success=False, message=f'隨機分組失敗：{e}'), 500


@app.route('/leave_room', methods=['POST'])
def leave_room():
    try:
        data = request.get_json(silent=True) or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        if not pin or not player_name:
            return jsonify(success=False, message='缺少必要資料'), 400
        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=True, message='房間已不存在')
            leaving = conn.execute(
                'SELECT * FROM room_players WHERE room_pin=? AND player_name=?', (pin, player_name)
            ).fetchone()
            if not leaving:
                return jsonify(success=True, message='玩家已不在房間內')
            if int(leaving.get('is_host', 0) or 0) == 1:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=True, message='房主已離開，房間已刪除', roomDeleted=True)
            conn.execute('DELETE FROM room_players WHERE room_pin=? AND player_name=?', (pin, player_name))
            host_exists = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
                (pin, host_alive_cutoff())
            ).fetchone()
            if not host_exists:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=True, message='房間已無房主，房間已刪除', roomDeleted=True)
            remaining = conn.execute(
                "SELECT COUNT(*) AS total FROM room_players WHERE room_pin=?"
                " AND NOT (player_name LIKE '__host_%__' AND is_host=1)", (pin,)
            ).fetchone()['total']
            if remaining == 0:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=True, message='房間已無玩家，房間已刪除', roomDeleted=True)
            conn.commit()
        return jsonify(success=True, message='已離開房間', roomDeleted=False)
    except Exception as e:
        return jsonify(success=False, message=f'離開房間失敗：{e}'), 500


@app.route('/room_state/<pin>')
def room_state(pin):
    try:
        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            host_exists = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
                (pin, host_alive_cutoff())
            ).fetchone()
            if not host_exists:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=False, message='房間不存在'), 404
            conn.execute(
                'UPDATE room_players SET last_seen=? WHERE room_pin=? AND player_name=?',
                (now_ts(), pin, request.args.get('playerName', '').strip() or '__unknown__')
            )
            players = conn.execute('''
                SELECT room_pin,player_name,face,hair,eyes,eyes_offset_y,is_host,team_id,joined_at
                FROM room_players
                WHERE room_pin=?
                  AND NOT (player_name LIKE '__host_%__' AND is_host=1)
                ORDER BY is_host DESC,joined_at ASC,id ASC
            ''', (pin,)).fetchall()
            teams = conn.execute(
                'SELECT team_id,team_name FROM room_teams WHERE room_pin=? ORDER BY team_id', (pin,)
            ).fetchall()
            messages = conn.execute(
                'SELECT * FROM room_messages WHERE room_pin=? AND team_id=-1 ORDER BY id ASC', (pin,)
            ).fetchall()
            question_total = conn.execute(
                'SELECT COUNT(*) AS total FROM room_questions WHERE room_pin=?', (pin,)
            ).fetchone()['total']
            conn.commit()
        return jsonify(success=True, room=serialize_room(room), players=players,
                       teams=teams, messages=messages, questionTotal=question_total)
    except Exception as e:
        return jsonify(success=False, message=f'讀取房間狀態失敗：{e}'), 500


@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    try:
        data = request.get_json(silent=True) or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        if not pin or not player_name:
            return jsonify(success=False, message='缺少必要資料'), 400
        with closing(get_conn()) as conn:
            if not conn.execute('SELECT 1 FROM rooms WHERE pin=?', (pin,)).fetchone():
                return jsonify(success=False, message='房間不存在'), 404
            # 一般玩家/房主的心跳
            conn.execute('UPDATE room_players SET last_seen=? WHERE room_pin=? AND player_name=?',
                         (now_ts(), pin, player_name))
            # 若傳入的是佔位房主名稱，同時刷新所有 is_host=1 的 last_seen
            if player_name.startswith('__host_') and player_name.endswith('__'):
                conn.execute('UPDATE room_players SET last_seen=? WHERE room_pin=? AND is_host=1',
                             (now_ts(), pin))
            conn.commit()
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, message=f'心跳更新失敗：{e}'), 500


@app.route('/send_message', methods=['POST'])
def send_message():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        sender_name = str(data.get('senderName', '')).strip()
        message = str(data.get('message', '')).strip()
        team_id = int(data.get('teamId', -1) or -1)
        avatar = get_player_payload({
            'name': sender_name,
            'face': data.get('face', DEFAULT_FACE),
            'hair': data.get('hair', DEFAULT_HAIR),
            'eyes': data.get('eyes', DEFAULT_EYES),
            'eyesOffsetY': data.get('eyesOffsetY', 0)
        })
        if not room_exists(pin):
            return jsonify(success=False, message='房間不存在'), 404
        if not sender_name or not message:
            return jsonify(success=False, message='訊息不可空白'), 400
        with closing(sqlite3.connect(ROOMS_DB_PATH)) as conn:
            conn.execute('''
                INSERT INTO room_messages
                (room_pin,sender_name,message,face,hair,eyes,eyes_offset_y,team_id,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
            ''', (pin, sender_name, message, avatar['face'], avatar['hair'],
                  avatar['eyes'], avatar['eyes_offset_y'], team_id, now_ts()))
            conn.commit()
        return jsonify(success=True, message='訊息已送出')
    except Exception as e:
        return jsonify(success=False, message=f'發送訊息失敗：{e}'), 500


@app.route('/team_messages')
def team_messages():
    try:
        pin = request.args.get('pin', '').strip()
        team_id = int(request.args.get('teamId', 0) or 0)
        with closing(get_conn()) as conn:
            msgs = conn.execute(
                'SELECT * FROM room_messages WHERE room_pin=? AND team_id=? ORDER BY id ASC',
                (pin, team_id)
            ).fetchall()
        return jsonify(success=True, messages=msgs)
    except Exception as e:
        return jsonify(success=False, message=f'讀取訊息失敗：{e}'), 500


@app.route('/start_game', methods=['POST'])
def start_game():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        with closing(get_conn()) as conn:
            host = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=?',
                (pin, player_name, host_alive_cutoff())
            ).fetchone()
            if not host:
                return jsonify(success=False, message='只有房主可以開始遊戲'), 403
            total = conn.execute(
                'SELECT COUNT(*) AS total FROM room_questions WHERE room_pin=?', (pin,)
            ).fetchone()['total']
            if total == 0:
                return jsonify(success=False, message='這個房間沒有題目'), 400
            conn.execute(
                "UPDATE rooms SET status='playing',current_question_index=0,phase='question',game_start_ts=? WHERE pin=?",
                (now_ts(), pin)
            )
            conn.commit()
        return jsonify(success=True, message='遊戲已開始')
    except Exception as e:
        return jsonify(success=False, message=f'開始遊戲失敗：{e}'), 500


@app.route('/player_game_state')
def player_game_state():
    try:
        pin = request.args.get('pin', '').strip()
        player_name = request.args.get('playerName', '').strip()
        if not pin or not player_name:
            return jsonify(success=False, message='缺少必要資料'), 400

        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404

            # 遊戲進行中：只要房間 status=playing 且任何 is_host=1 存在就繼續
            # 等待室：需要 last_seen 在存活範圍內
            room_status = (room.get('status') or 'waiting')
            if room_status == 'playing':
                host_exists = conn.execute(
                    'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 LIMIT 1',
                    (pin,)
                ).fetchone()
            else:
                host_exists = conn.execute(
                    'SELECT 1 FROM room_players WHERE room_pin=? AND is_host=1 AND COALESCE(last_seen,joined_at,0)>=? LIMIT 1',
                    (pin, host_alive_cutoff())
                ).fetchone()

            if not host_exists:
                delete_room_fully(conn, pin)
                conn.commit()
                return jsonify(success=False, message='房間不存在'), 404

            room = serialize_room(room)
            conn.execute('UPDATE room_players SET last_seen=? WHERE room_pin=? AND player_name=?',
                         (now_ts(), pin, player_name))

            is_team_mode = bool(room.get('team_mode'))
            me = conn.execute(
                'SELECT team_id, is_eliminated FROM room_players WHERE room_pin=? AND player_name=?',
                (pin, player_name)
            ).fetchone()
            my_team_id    = int((me or {}).get('team_id') or 0)
            is_eliminated = bool((me or {}).get('is_eliminated') or 0)

            questions = conn.execute(
                'SELECT * FROM room_questions WHERE room_pin=? ORDER BY seq ASC,id ASC', (pin,)
            ).fetchall()
            current_index = int(room.get('current_question_index') or 0)
            total_questions = len(questions)
            phase = room.get('phase') or 'question'

            current_q = None
            finished = False
            if is_team_mode:
                current_q = questions[current_index] if 0 <= current_index < total_questions else None
                finished = (room.get('status') == 'closed') or current_index >= total_questions
            else:
                current_q = questions[current_index] if 0 <= current_index < total_questions else None
                finished = current_q is None

            # 被淘汰玩家進入「觀戰模式」（finished 設 True，前端用 isEliminated 區分）
            if is_eliminated and not finished:
                finished = False  # 不算真結束，讓前端用 isEliminated 判斷顯示觀戰畫面

            total_score = conn.execute(
                'SELECT COALESCE(SUM(points_earned),0) AS total FROM room_results WHERE room_pin=? AND player_name=?',
                (pin, player_name)
            ).fetchone()['total']

            all_rank = conn.execute('''
                SELECT player_name, COALESCE(SUM(points_earned),0) AS total_score
                FROM room_results WHERE room_pin=?
                GROUP BY player_name ORDER BY total_score DESC,player_name ASC
            ''', (pin,)).fetchall()
            my_rank = next((i+1 for i,r in enumerate(all_rank) if r['player_name']==player_name), None)
            leaderboard = all_rank[:10]

            team_scores = []
            if is_team_mode:
                teams = conn.execute(
                    'SELECT team_id,team_name FROM room_teams WHERE room_pin=? ORDER BY team_id', (pin,)
                ).fetchall()
                for t in teams:
                    tid = t['team_id']
                    score = conn.execute('''
                        SELECT COALESCE(SUM(rr.points_earned),0) AS total
                        FROM room_results rr
                        JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                        WHERE rr.room_pin=? AND rp.team_id=?
                    ''', (pin, tid)).fetchone()['total']
                    team_scores.append({'team_id': tid, 'team_name': t['team_name'], 'total_score': score})

            my_result = None
            answer_status = []
            answer_breakdown = []
            my_answered = False
            correct_answer_text = ''
            explanation_text = ''

            if not is_team_mode and current_q:
                my_result = conn.execute(
                    'SELECT * FROM room_results WHERE room_pin=? AND player_name=? AND question_id=?',
                    (pin, player_name, current_q['question_id'])
                ).fetchone()
                my_answered = my_result is not None
                answer_status = conn.execute('''
                    SELECT rp.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y,
                           rp.is_host, rp.is_eliminated,
                           CASE WHEN rr.id IS NULL THEN 0 ELSE 1 END AS answered,
                           rr.selected_json, rr.is_correct, rr.points_earned
                    FROM room_players rp
                    LEFT JOIN room_results rr
                      ON rr.room_pin=rp.room_pin AND rr.player_name=rp.player_name AND rr.question_id=?
                    WHERE rp.room_pin=?
                      AND NOT (rp.player_name LIKE '__host_%__' AND rp.is_host=1)
                    ORDER BY rp.is_host DESC, rp.is_eliminated ASC, rp.player_name ASC
                ''', (current_q['question_id'], pin)).fetchall()
                options = json.loads(current_q['options_json'] or '[]')
                all_res = conn.execute(
                    'SELECT selected_json FROM room_results WHERE room_pin=? AND question_id=?',
                    (pin, current_q['question_id'])
                ).fetchall()
                counts = [0] * len(options)
                for r in all_res:
                    try:
                        for idx in json.loads(r['selected_json'] or '[]'):
                            if 0 <= idx < len(options):
                                counts[idx] += 1
                    except Exception:
                        pass
                answer_breakdown = [
                    {'index': i, 'label': chr(65+i), 'text': opt.get('text',''), 'count': counts[i]}
                    for i, opt in enumerate(options)
                ]
                ai = sorted(json.loads(current_q['answer_json'] or '[]'))
                correct_answer_text = '、'.join(chr(65+i) for i in ai) or '無'
                explanation_text = current_q.get('explanation') or ''

            team_question_status = []
            if is_team_mode:
                for q in questions:
                    sub = conn.execute('''
                        SELECT rr.player_name,rr.is_correct,rr.points_earned
                        FROM room_results rr
                        JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                        WHERE rr.room_pin=? AND rr.question_id=? AND rp.team_id=? LIMIT 1
                    ''', (pin, q['question_id'], my_team_id)).fetchone()
                    team_question_status.append({
                        'question_id': q['question_id'],
                        'seq': q['seq'],
                        'title': q['title'],
                        'submitted': sub is not None,
                        'submitter': sub['player_name'] if sub else None,
                        'is_correct': bool(sub['is_correct']) if sub else None,
                        'points_earned': sub['points_earned'] if sub else 0
                    })

            # 判斷請求者是否為房主（用於決定是否帶正解）
            _host_row = conn.execute(
                "SELECT player_name FROM room_players WHERE room_pin=? AND is_host=1"
                " AND NOT (player_name LIKE '__host_%__') LIMIT 1", (pin,)
            ).fetchone()
            is_host_player = bool(_host_row and _host_row.get('player_name') == player_name)

            conn.commit()

        def pub_q(q, include_answers=False):
            if not q:
                return None
            opts = json.loads(q['options_json'] or '[]')
            ans  = sorted(json.loads(q['answer_json'] or '[]'))
            result = {
                'question_id': q['question_id'], 'seq': q['seq'],
                'title': q['title'], 'content': q['content'], 'type': q['type'],
                'options': opts,
                'time': q['time_label'], 'score': q['score'],
                'fake_answer': bool(q.get('fake_answer') or 0),
                'explanation': q.get('explanation') or '', 'image': q.get('image') or ''
            }
            if include_answers:
                # 房主可以看到正解 index
                result['correct_indexes'] = ans
            return result

        return jsonify(
            success=True, room=room,
            totalQuestions=total_questions, answeredCount=current_index,
            totalScore=total_score,
            isEliminated=is_eliminated,
            nextQuestion=pub_q(current_q, include_answers=is_host_player),
            allQuestions=[pub_q(q) for q in questions] if is_team_mode else [],
            finished=finished, leaderboard=leaderboard,
            teamScores=team_scores, teamQuestionStatus=team_question_status,
            myTeamId=my_team_id, phase=phase,
            myAnswered=my_answered, myResult=my_result,
            answerStatus=answer_status, answerBreakdown=answer_breakdown,
            myRank=my_rank, showExactRank=bool(my_rank and my_rank <= 5),
            correctAnswerText=correct_answer_text, explanation=explanation_text,
            gameStartTs=int(room.get('game_start_ts') or 0),
            isTeamMode=is_team_mode
        )
    except Exception as e:
        return jsonify(success=False, message=f'讀取遊戲狀態失敗：{e}'), 500


@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        question_id = str(data.get('questionId', '')).strip()
        selected = data.get('selected', [])
        remain_sec = int(data.get('remainSeconds', 0) or 0)
        if not isinstance(selected, list):
            selected = []
        selected = sorted([int(x) for x in selected])

        with closing(get_conn()) as conn:
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            is_team_mode = bool(room.get('team_mode'))
            if not is_team_mode and (room.get('phase') or 'question') != 'question':
                return jsonify(success=False, message='本題已結束作答'), 400

            q = conn.execute(
                'SELECT * FROM room_questions WHERE room_pin=? AND question_id=?', (pin, question_id)
            ).fetchone()
            if not q:
                return jsonify(success=False, message='找不到題目'), 404

            if is_team_mode:
                me = conn.execute(
                    'SELECT team_id FROM room_players WHERE room_pin=? AND player_name=?',
                    (pin, player_name)
                ).fetchone()
                my_team_id = int((me or {}).get('team_id') or 0)
                already = conn.execute('''
                    SELECT rr.player_name FROM room_results rr
                    JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                    WHERE rr.room_pin=? AND rr.question_id=? AND rp.team_id=? LIMIT 1
                ''', (pin, question_id, my_team_id)).fetchone()
                if already:
                    return jsonify(success=False,
                                   message=f'{already["player_name"]} 已代表本組作答此題'), 400

            existing = conn.execute(
                'SELECT * FROM room_results WHERE room_pin=? AND player_name=? AND question_id=?',
                (pin, player_name, question_id)
            ).fetchone()

            answer_indexes = sorted(json.loads(q['answer_json'] or '[]'))
            option_labels = [chr(65+i) for i in answer_indexes]

            if existing:
                total_score = conn.execute(
                    'SELECT COALESCE(SUM(points_earned),0) AS total FROM room_results WHERE room_pin=? AND player_name=?',
                    (pin, player_name)
                ).fetchone()['total']
                return jsonify(success=True, alreadyAnswered=True,
                               isCorrect=bool(existing['is_correct']),
                               pointsEarned=int(existing['points_earned'] or 0),
                               correctIndexes=answer_indexes, correctLabels=option_labels,
                               explanation=q.get('explanation') or '',
                               answerText='、'.join(option_labels) or '無',
                               totalScore=total_score)

            is_correct = 1 if selected == answer_indexes else 0
            answer_order = 0
            if is_correct:
                answered_before = conn.execute(
                    'SELECT COUNT(*) AS c FROM room_results WHERE room_pin=? AND question_id=?',
                    (pin, question_id)
                ).fetchone()['c']
                answer_order = answered_before + 1
                time_limit = int(''.join(filter(str.isdigit, q.get('time_label') or '20')) or 20)
                points = calc_kahoot_score(int(q.get('score') or 1000), time_limit, remain_sec, answer_order)
            else:
                points = 0

            conn.execute('''
                INSERT INTO room_results
                (room_pin,player_name,question_id,selected_json,is_correct,points_earned,answer_order,remain_sec,answered_at)
                VALUES (?,?,?,?,?,?,?,?,?)
            ''', (pin, player_name, question_id, json.dumps(selected, ensure_ascii=False),
                  is_correct, points, answer_order, remain_sec, now_ts()))

            # ── 淘汰模式處理 ────────────────────────────
            # fake_answer=1 且答錯 → 把玩家標記為淘汰，積分歸零
            is_fake_mode = bool(q.get('fake_answer') or 0)
            newly_eliminated = False
            if is_fake_mode and not is_correct:
                conn.execute(
                    'UPDATE room_players SET is_eliminated=1 WHERE room_pin=? AND player_name=?',
                    (pin, player_name)
                )
                # 所有舊的積分清零（INSERT OR REPLACE 把 points_earned 全設 0）
                conn.execute(
                    'UPDATE room_results SET points_earned=0 WHERE room_pin=? AND player_name=?',
                    (pin, player_name)
                )
                newly_eliminated = True
            # ────────────────────────────────────────────

            total_score = conn.execute(
                'SELECT COALESCE(SUM(points_earned),0) AS total FROM room_results WHERE room_pin=? AND player_name=?',
                (pin, player_name)
            ).fetchone()['total']
            top5 = conn.execute('''
                SELECT player_name,COALESCE(SUM(points_earned),0) AS total_score
                FROM room_results rr
                JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=? AND rp.is_eliminated=0
                GROUP BY rr.player_name ORDER BY total_score DESC,rr.player_name ASC LIMIT 5
            ''', (pin,)).fetchall()
            all_rank = conn.execute('''
                SELECT rr.player_name,COALESCE(SUM(rr.points_earned),0) AS total_score
                FROM room_results rr
                JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=? AND rp.is_eliminated=0
                GROUP BY rr.player_name ORDER BY total_score DESC,rr.player_name ASC
            ''', (pin,)).fetchall()
            my_rank = next((i+1 for i,r in enumerate(all_rank) if r['player_name']==player_name), None)
            conn.commit()

            return jsonify(success=True, isCorrect=bool(is_correct), pointsEarned=points,
                           answerOrder=answer_order,
                           correctIndexes=answer_indexes, correctLabels=option_labels,
                           explanation=q.get('explanation') or '',
                           answerText='、'.join(option_labels) or '無',
                           totalScore=total_score, top5=top5, myRank=my_rank,
                           showExactRank=bool(my_rank and my_rank <= 5),
                           eliminated=newly_eliminated,
                           isFakeMode=is_fake_mode)
    except Exception as e:
        return jsonify(success=False, message=f'提交答案失敗：{e}'), 500


@app.route('/host_finish_question', methods=['POST'])
def host_finish_question():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        with closing(get_conn()) as conn:
            if not conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1',
                (pin, player_name)
            ).fetchone():
                return jsonify(success=False, message='只有房主可以操作'), 403
            conn.execute("UPDATE rooms SET phase='explanation' WHERE pin=?", (pin,))
            conn.commit()
        return jsonify(success=True, message='已進入解析階段')
    except Exception as e:
        return jsonify(success=False, message=f'切換解析階段失敗：{e}'), 500


@app.route('/host_skip_explanation', methods=['POST'])
def host_skip_explanation():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        with closing(get_conn()) as conn:
            if not conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1',
                (pin, player_name)
            ).fetchone():
                return jsonify(success=False, message='只有房主可以操作'), 403
            room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
            if not room:
                return jsonify(success=False, message='房間不存在'), 404
            total = conn.execute(
                'SELECT COUNT(*) AS total FROM room_questions WHERE room_pin=?', (pin,)
            ).fetchone()['total']
            next_index = int(room.get('current_question_index') or 0) + 1
            conn.execute(
                "UPDATE rooms SET current_question_index=?,phase='question' WHERE pin=?",
                (next_index, pin)
            )
            conn.commit()
        return jsonify(success=True, message='已進入下一題', finished=next_index >= total)
    except Exception as e:
        return jsonify(success=False, message=f'切換下一題失敗：{e}'), 500


@app.route('/host_end_team_game', methods=['POST'])
def host_end_team_game():
    try:
        data = request.get_json() or {}
        pin = str(data.get('pin', '')).strip()
        player_name = str(data.get('playerName', '')).strip()
        with closing(get_conn()) as conn:
            if not conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1',
                (pin, player_name)
            ).fetchone():
                return jsonify(success=False, message='只有房主可以操作'), 403
            total = conn.execute(
                'SELECT COUNT(*) AS t FROM room_questions WHERE room_pin=?', (pin,)
            ).fetchone()['t']
            conn.execute(
                "UPDATE rooms SET current_question_index=?,phase='question',status='closed' WHERE pin=?",
                (total, pin)
            )
            conn.commit()
        return jsonify(success=True, message='遊戲已結束')
    except Exception as e:
        return jsonify(success=False, message=f'結束遊戲失敗：{e}'), 500


@app.route('/host_all_results')
def host_all_results():
    try:
        pin = request.args.get('pin', '').strip()
        if not pin:
            return jsonify(success=False, message='缺少 PIN'), 400
        with closing(get_conn()) as conn:
            questions = conn.execute(
                'SELECT question_id,seq,title FROM room_questions WHERE room_pin=? ORDER BY seq ASC', (pin,)
            ).fetchall()
            results = conn.execute(
                'SELECT rr.*,rp.team_id FROM room_results rr JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name WHERE rr.room_pin=? ORDER BY rp.team_id ASC,rr.player_name ASC',
                (pin,)
            ).fetchall()
        q_order = {q['question_id']: q['seq'] for q in questions}
        q_titles = {q['question_id']: q['title'] for q in questions}
        enriched = [{
            'player_name': r['player_name'], 'team_id': r['team_id'],
            'question_id': r['question_id'],
            'seq': q_order.get(r['question_id'], 0),
            'title': q_titles.get(r['question_id'], ''),
            'selected_json': r['selected_json'],
            'is_correct': bool(r['is_correct']),
            'points_earned': int(r['points_earned'] or 0),
            'answer_order': int(r['answer_order'] or 0),
        } for r in results]
        return jsonify(success=True, results=enriched)
    except Exception as e:
        return jsonify(success=False, message=f'讀取明細失敗：{e}'), 500


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(PROJECT_DIR, filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
