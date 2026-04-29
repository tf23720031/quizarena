from flask import Flask, send_from_directory, request, jsonify
import os, sqlite3, json, hashlib, random, time, threading, shutil, html
import urllib.parse, urllib.request
from contextlib import closing

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = BASE_DIR
LEGACY_USERS_DB_PATH = os.path.join(BASE_DIR, 'quizarena.db')
LEGACY_ROOMS_DB_PATH = os.path.join(BASE_DIR, 'rooms.db')
LEGACY_QUIZ_BANKS_PATH = os.path.join(BASE_DIR, 'quiz_banks.json')

app = Flask(__name__, static_folder=PROJECT_DIR, static_url_path='')

DEFAULT_FACE = 'images/face/face.png'
DEFAULT_HAIR = 'images/hair/hair01.png'
DEFAULT_EYES = 'images/face/eyes01.png'

_quiz_lock = threading.Lock()


def resolve_data_dir():
    env_dir = os.environ.get('QUIZARENA_DATA_DIR', '').strip()
    if env_dir:
        return os.path.abspath(env_dir)

    if os.name == 'nt':
        local_appdata = os.environ.get('LOCALAPPDATA', '').strip()
        if local_appdata:
            return os.path.join(local_appdata, 'QuizArena')

    return os.path.join(os.path.expanduser('~'), '.quizarena')


DATA_DIR = resolve_data_dir()
USERS_DB_PATH = os.path.join(DATA_DIR, 'quizarena.db')
ROOMS_DB_PATH = os.path.join(DATA_DIR, 'rooms.db')
QUIZ_BANKS_PATH = os.path.join(DATA_DIR, 'quiz_banks.json')
DEFAULT_BANKS_PATH = os.path.join(BASE_DIR, 'default_quiz_banks.json')

DEFAULT_CATEGORY = '綜合'
DEFAULT_DIFFICULTY = 'medium'
VALID_DIFFICULTIES = {'easy', 'medium', 'hard'}
VALID_QUESTION_TYPES = {'single', 'multiple', 'tf', 'fill'}
OPENAI_API_URL = 'https://api.openai.com/v1/responses'
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-5')


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


def parse_json_value(raw_value, fallback):
    try:
        parsed = json.loads(raw_value or '')
    except Exception:
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def get_conn(path=ROOMS_DB_PATH):
    conn = sqlite3.connect(path)
    conn.row_factory = dict_factory
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn


def ensure_file(path, default_obj):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(default_obj, f, ensure_ascii=False, indent=2)


def migrate_legacy_file(legacy_path, target_path, default_obj=None):
    if os.path.exists(target_path):
        return
    if os.path.exists(legacy_path):
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        shutil.copy2(legacy_path, target_path)
        return
    if default_obj is not None:
        ensure_file(target_path, default_obj)


def ensure_data_store():
    os.makedirs(DATA_DIR, exist_ok=True)
    migrate_legacy_file(LEGACY_USERS_DB_PATH, USERS_DB_PATH)
    migrate_legacy_file(LEGACY_ROOMS_DB_PATH, ROOMS_DB_PATH)
    migrate_legacy_file(LEGACY_QUIZ_BANKS_PATH, QUIZ_BANKS_PATH, {'users': {}})


def normalize_difficulty(value):
    difficulty = str(value or DEFAULT_DIFFICULTY).strip().lower()
    return difficulty if difficulty in VALID_DIFFICULTIES else DEFAULT_DIFFICULTY


def normalize_category(value):
    return str(value or DEFAULT_CATEGORY).strip() or DEFAULT_CATEGORY


def normalize_options(question_type, options):
    if not isinstance(options, list):
        options = []
    normalized = []
    for idx, opt in enumerate(options):
        if isinstance(opt, dict):
            text = str(opt.get('text', '')).strip()
            correct = bool(opt.get('correct'))
        else:
            text = str(opt).strip()
            correct = False
        if not text and question_type not in {'tf', 'fill'}:
            continue
        normalized.append({'text': text or ('是' if idx == 0 else '否'), 'correct': correct})

    if question_type == 'tf' and len(normalized) < 2:
        normalized = [
            {'text': '是', 'correct': True},
            {'text': '否', 'correct': False},
        ]
    elif question_type == 'fill':
        answer = ''
        if normalized:
            answer = normalized[0].get('text', '').strip()
        normalized = [{'text': answer, 'correct': True}]
    return normalized


def normalize_question(raw_question):
    q = raw_question if isinstance(raw_question, dict) else {}
    question_type = str(q.get('type', 'single')).strip().lower()
    if question_type not in VALID_QUESTION_TYPES:
        question_type = 'single'
    options = normalize_options(question_type, q.get('options', []))
    answer_indexes = [i for i, opt in enumerate(options) if opt.get('correct')]
    if question_type in {'single', 'tf'} and len(answer_indexes) > 1:
        first = answer_indexes[0]
        for idx, opt in enumerate(options):
            opt['correct'] = idx == first

    return {
        'id': str(q.get('id') or uid('question')).strip() or uid('question'),
        'title': str(q.get('title', '')).strip() or '未命名題目',
        'content': str(q.get('content', '')).strip(),
        'type': question_type,
        'options': options,
        'time': str(q.get('time', '20 秒')).strip() or '20 秒',
        'score': int(q.get('score', 1000) or 1000),
        'fakeAnswer': bool(q.get('fakeAnswer', False)),
        'image': str(q.get('image', '')).strip(),
        'explanation': str(q.get('explanation', '')).strip(),
        'difficulty': normalize_difficulty(q.get('difficulty')),
        'category': normalize_category(q.get('category')),
    }


def normalize_bank(raw_bank):
    bank = raw_bank if isinstance(raw_bank, dict) else {}
    questions = bank.get('questions', [])
    if not isinstance(questions, list):
        questions = []
    return {
        'id': str(bank.get('id') or uid('bank')).strip() or uid('bank'),
        'title': str(bank.get('title', '')).strip() or '未命名題庫',
        'gameMode': 'team' if str(bank.get('gameMode', 'individual')).strip() == 'team' else 'individual',
        'questions': [normalize_question(q) for q in questions],
        'updatedAt': int(bank.get('updatedAt', now_ts()) or now_ts()),
    }


def load_default_quiz_banks():
    if not os.path.exists(DEFAULT_BANKS_PATH):
        return []
    with open(DEFAULT_BANKS_PATH, 'r', encoding='utf-8') as f:
        raw = json.load(f)
    banks = raw.get('banks', []) if isinstance(raw, dict) else []
    normalized = []
    for bank in banks:
        item = normalize_bank(bank)
        item['isSystem'] = True
        item['readonly'] = True
        normalized.append(item)
    return normalized


def get_wrong_book_owner(username, fallback_player_name=''):
    username = str(username or '').strip()
    if username:
        return username
    return str(fallback_player_name or '').strip()


def build_wrong_book_for_user(username):
    owner = str(username or '').strip()
    if not owner:
        return None
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute('''
            SELECT source_bank_id, source_bank_title, question_id, title, content, type,
                   options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at
            FROM wrong_question_book
            WHERE username=?
            ORDER BY wrong_count DESC, last_wrong_at DESC, id DESC
        ''', (owner,)).fetchall()
    if not rows:
        return None

    questions = []
    for row in rows:
        try:
            options = json.loads(row.get('options_json') or '[]')
        except Exception:
            options = []
        questions.append(normalize_question({
            'id': f"wrong_{row.get('source_bank_id')}_{row.get('question_id')}",
            'title': row.get('title') or '未命名題目',
            'content': row.get('content') or '',
            'type': row.get('type') or 'single',
            'options': options,
            'time': '20 秒',
            'score': 1000,
            'image': row.get('image') or '',
            'explanation': row.get('explanation') or '',
            'difficulty': row.get('difficulty') or DEFAULT_DIFFICULTY,
            'category': row.get('category') or DEFAULT_CATEGORY,
        }))
        questions[-1]['sourceBankTitle'] = row.get('source_bank_title') or '未命名題庫'
        questions[-1]['wrongCount'] = int(row.get('wrong_count') or 0)

    return {
        'id': 'wrong_book',
        'title': '我的錯題本',
        'gameMode': 'individual',
        'questions': questions,
        'updatedAt': int(rows[0].get('last_wrong_at') or now_ts()),
        'isWrongBook': True,
        'readonly': True,
    }


def save_wrong_question(owner, source_bank_id, source_bank_title, question_row):
    if not owner or not question_row:
        return
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.execute('''
            INSERT INTO wrong_question_book
            (username, source_bank_id, source_bank_title, question_id, title, content, type,
             options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(username, source_bank_id, question_id)
            DO UPDATE SET
                source_bank_title=excluded.source_bank_title,
                title=excluded.title,
                content=excluded.content,
                type=excluded.type,
                options_json=excluded.options_json,
                explanation=excluded.explanation,
                image=excluded.image,
                category=excluded.category,
                difficulty=excluded.difficulty,
                wrong_count=wrong_question_book.wrong_count + 1,
                last_wrong_at=excluded.last_wrong_at
        ''', (
            owner,
            str(source_bank_id or '').strip(),
            str(source_bank_title or '').strip(),
            str(question_row.get('question_id') or question_row.get('id') or '').strip(),
            str(question_row.get('title') or '').strip(),
            str(question_row.get('content') or '').strip(),
            str(question_row.get('type') or 'single').strip(),
            question_row.get('options_json') or '[]',
            str(question_row.get('explanation') or '').strip(),
            str(question_row.get('image') or '').strip(),
            normalize_category(question_row.get('category')),
            normalize_difficulty(question_row.get('difficulty')),
            now_ts(),
            now_ts(),
        ))
        conn.commit()


def extract_response_text(response_json):
    pieces = []
    for item in response_json.get('output', []):
        if item.get('type') != 'message':
            continue
        for content in item.get('content', []):
            if content.get('type') == 'output_text':
                pieces.append(content.get('text', ''))
    return ''.join(pieces).strip()


def fetch_wikipedia_summary(topic):
    topic = str(topic or '').strip()
    if not topic:
        return ''
    encoded = urllib.parse.quote(topic.replace(' ', '_'))
    urls = [
        f'https://zh.wikipedia.org/api/rest_v1/page/summary/{encoded}',
        f'https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}',
    ]
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'QuizArena/1.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            extract = str(data.get('extract', '')).strip()
            if extract:
                return extract
        except Exception:
            continue
    return ''


def generate_ai_quiz_bank(topic, category, difficulty, count, source_mode='ai', api_key_override=''):
    api_key = str(api_key_override or '').strip() or os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('尚未設定 OPENAI_API_KEY，暫時無法使用 AI 生成。')

    web_context = ''
    if source_mode == 'web_ai':
        web_context = fetch_wikipedia_summary(topic)

    schema = {
        'type': 'object',
        'properties': {
            'title': {'type': 'string'},
            'questions': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'title': {'type': 'string'},
                        'content': {'type': 'string'},
                        'type': {'type': 'string', 'enum': ['single', 'multiple', 'tf', 'fill']},
                        'difficulty': {'type': 'string', 'enum': ['easy', 'medium', 'hard']},
                        'category': {'type': 'string'},
                        'time': {'type': 'string'},
                        'score': {'type': 'integer'},
                        'explanation': {'type': 'string'},
                        'options': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'text': {'type': 'string'},
                                    'correct': {'type': 'boolean'}
                                },
                                'required': ['text', 'correct'],
                                'additionalProperties': False
                            }
                        }
                    },
                    'required': ['title', 'content', 'type', 'difficulty', 'category', 'time', 'score', 'explanation', 'options'],
                    'additionalProperties': False
                }
            }
        },
        'required': ['title', 'questions'],
        'additionalProperties': False
    }

    user_prompt = (
        f'請用 JSON 產生 {count} 題題目。'
        f'主題：{topic or "綜合學習"}。'
        f'類別：{normalize_category(category)}。'
        f'難度：{normalize_difficulty(difficulty)}。'
        '每題都要有清楚解析、合理選項、唯一正解或明確多選正解。'
        '題目語言請使用繁體中文。'
    )
    if web_context:
        user_prompt += f' 你可以參考這段網路資料摘要來出題：{web_context}'

    payload = {
        'model': OPENAI_MODEL,
        'input': [
            {
                'role': 'developer',
                'content': (
                    '你是 QuizArena 的出題助手。請為學習型測驗產生高品質題目，'
                    '題目要兼顧趣味性與教學性，解析要簡潔且正確。'
                )
            },
            {
                'role': 'user',
                'content': user_prompt
            }
        ],
        'text': {
            'format': {
                'type': 'json_schema',
                'name': 'quiz_bank',
                'strict': True,
                'schema': schema
            }
        }
    }

    req = urllib.request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        response_json = json.loads(resp.read().decode('utf-8'))

    refusal = response_json.get('refusal')
    if refusal:
        raise RuntimeError('AI 這次拒絕了請求，請改成更明確的學習主題再試一次。')

    text = extract_response_text(response_json)
    if not text:
        raise RuntimeError('AI 沒有回傳可解析的題庫內容。')

    generated = json.loads(text)
    bank = normalize_bank({
        'id': uid('bank'),
        'title': generated.get('title') or (topic or 'AI 題庫'),
        'gameMode': 'individual',
        'questions': generated.get('questions', []),
        'updatedAt': now_ts(),
    })
    return bank


def get_user_exists(username):
    if not username:
        return False
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        row = conn.execute('SELECT 1 FROM users WHERE username=?', (username,)).fetchone()
    return row is not None


def get_friend_usernames(username):
    if not username:
        return []
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute('''
            SELECT CASE
                WHEN requester = ? THEN addressee
                ELSE requester
            END AS friend_name
            FROM user_friendships
            WHERE (requester = ? OR addressee = ?) AND status = 'accepted'
            ORDER BY friend_name COLLATE NOCASE ASC
        ''', (username, username, username)).fetchall()
    return [row['friend_name'] for row in rows]


def get_user_wins_map(usernames):
    names = [str(name).strip() for name in usernames if str(name).strip()]
    if not names:
        return {}
    placeholders = ','.join('?' for _ in names)
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute(f'''
            SELECT username, wins
            FROM user_stats
            WHERE username IN ({placeholders})
        ''', names).fetchall()
    result = {name: 0 for name in names}
    for row in rows:
        result[row['username']] = int(row.get('wins') or 0)
    return result


def get_user_profiles_map(usernames):
    names = [str(name).strip() for name in usernames if str(name).strip()]
    if not names:
        return {}
    placeholders = ','.join('?' for _ in names)
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute(f'''
            SELECT username, avatar_image, selected_title, face, hair, eyes, eyes_offset_y
            FROM user_profiles
            WHERE username IN ({placeholders})
        ''', names).fetchall()
    result = {}
    for row in rows:
        username = str(row.get('username') or '').strip()
        if not username:
            continue
        result[username] = {
            'avatarImage': row.get('avatar_image') or '',
            'selectedTitle': row.get('selected_title') or '',
            'face': row.get('face') or DEFAULT_FACE,
            'hair': row.get('hair') or DEFAULT_HAIR,
            'eyes': row.get('eyes') or DEFAULT_EYES,
            'eyesOffsetY': int(row.get('eyes_offset_y') or 0),
        }
    return result


def build_friends_overview(username):
    if not username:
        return {'currentUser': '', 'friends': [], 'records': []}
    friend_names = get_friend_usernames(username)
    names = [username] + [name for name in friend_names if name != username]
    wins_map = get_user_wins_map(names)
    profiles_map = get_user_profiles_map(names)
    records = []
    for name in names:
        profile = profiles_map.get(name, {})
        records.append({
            'username': name,
            'wins': wins_map.get(name, 0),
            'avatarImage': profile.get('avatarImage') or '',
            'selectedTitle': profile.get('selectedTitle') or '',
            'isCurrentUser': name == username,
        })
    records.sort(key=lambda item: (-item['wins'], item['username'].lower()))
    return {
        'currentUser': username,
        'friends': friend_names,
        'records': records,
        'hasWins': any(item['wins'] > 0 for item in records),
    }


def describe_client_device(user_agent):
    ua = str(user_agent or '').lower()
    if 'iphone' in ua:
        return 'iPhone'
    if 'ipad' in ua:
        return 'iPad'
    if 'android' in ua and 'mobile' in ua:
        return 'Android 手機'
    if 'android' in ua:
        return 'Android 平板'
    if 'windows' in ua:
        return 'Windows 電腦'
    if 'macintosh' in ua or 'mac os' in ua:
        return 'Mac 電腦'
    if 'linux' in ua:
        return 'Linux 裝置'
    return '未知裝置'


def get_pending_friend_requests(username):
    if not username:
        return []
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute('''
            SELECT id, requester, addressee, requester_device, created_at, status
            FROM user_friend_requests
            WHERE addressee=? AND status='pending'
            ORDER BY created_at DESC, id DESC
        ''', (username,)).fetchall()
    return rows


def get_pending_friend_request_between(user_a, user_b):
    if not user_a or not user_b:
        return None
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        return conn.execute('''
            SELECT id, requester, addressee, requester_device, created_at, status
            FROM user_friend_requests
            WHERE status='pending'
              AND (
                (requester=? AND addressee=?)
                OR
                (requester=? AND addressee=?)
              )
            ORDER BY id DESC
            LIMIT 1
        ''', (user_a, user_b, user_b, user_a)).fetchone()


def serialize_friend_requests(rows):
    serialized = []
    for row in rows or []:
        serialized.append({
            'id': int(row.get('id') or 0),
            'requester': str(row.get('requester') or '').strip(),
            'addressee': str(row.get('addressee') or '').strip(),
            'device': str(row.get('requester_device') or '未知裝置').strip() or '未知裝置',
            'createdAt': int(row.get('created_at') or 0),
            'createdAtText': time.strftime('%Y-%m-%d %H:%M', time.localtime(int(row.get('created_at') or now_ts()))),
            'status': str(row.get('status') or 'pending').strip() or 'pending',
        })
    return serialized


def build_friend_request_summary(username):
    rows = get_pending_friend_requests(username)
    requests = serialize_friend_requests(rows)
    return {
        'currentUser': username,
        'pendingCount': len(requests),
        'requests': requests,
    }


def get_user_profile(username):
    if not username:
        return {}
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        row = conn.execute('''
            SELECT username, avatar_image, avatar_gallery, selected_title, face, hair, eyes, eyes_offset_y, updated_at
            FROM user_profiles
            WHERE username=?
            LIMIT 1
        ''', (username,)).fetchone()
    if not row:
        return {}
    return {
        'username': row.get('username') or username,
        'avatarImage': row.get('avatar_image') or '',
        'avatarGallery': parse_json_value(row.get('avatar_gallery'), []),
        'selectedTitle': row.get('selected_title') or '',
        'face': row.get('face') or DEFAULT_FACE,
        'hair': row.get('hair') or DEFAULT_HAIR,
        'eyes': row.get('eyes') or DEFAULT_EYES,
        'eyesOffsetY': int(row.get('eyes_offset_y') or 0),
        'updatedAt': int(row.get('updated_at') or 0),
    }


def get_wrong_book_stats(username):
    if not username:
        return []
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        rows = conn.execute('''
            SELECT source_bank_title, title, wrong_count, category, difficulty, last_wrong_at
            FROM wrong_question_book
            WHERE username=?
            ORDER BY wrong_count DESC, last_wrong_at DESC, id DESC
            LIMIT 8
        ''', (username,)).fetchall()
    return [{
        'bankTitle': row.get('source_bank_title') or '未命名題庫',
        'questionTitle': row.get('title') or '未命名題目',
        'wrongCount': int(row.get('wrong_count') or 0),
        'category': row.get('category') or DEFAULT_CATEGORY,
        'difficulty': row.get('difficulty') or DEFAULT_DIFFICULTY,
        'lastWrongAt': int(row.get('last_wrong_at') or 0),
    } for row in rows]


def build_available_titles(username):
    wins = get_user_wins_map([username]).get(username, 0)
    wrong_count = len(get_wrong_book_stats(username))
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        match_row = conn.execute('SELECT COUNT(*) AS c FROM user_match_history WHERE winner_username=?', (username,)).fetchone()
    win_history = int((match_row or {}).get('c') or 0)
    titles = [{'id': 'rookie', 'name': '新手學員'}]
    if wins >= 1:
        titles.append({'id': 'first_win', 'name': '首勝新星'})
    if wins >= 3:
        titles.append({'id': 'quiz_knight', 'name': '答題騎士'})
    if wins >= 8:
        titles.append({'id': 'arena_star', 'name': '競技明星'})
    if wins >= 15:
        titles.append({'id': 'quiz_king', 'name': '題場王者'})
    if wrong_count >= 5:
        titles.append({'id': 'retry_master', 'name': '重練達人'})
    if win_history >= 10:
        titles.append({'id': 'seasoned_host', 'name': '老練挑戰者'})
    unique = []
    seen = set()
    for item in titles:
        if item['id'] in seen:
            continue
        seen.add(item['id'])
        unique.append(item)
    return unique


def build_profile_summary(username):
    profile = get_user_profile(username)
    titles = build_available_titles(username)
    selected_title = profile.get('selectedTitle') or (titles[0]['name'] if titles else '')
    if selected_title and all(item['name'] != selected_title for item in titles):
        selected_title = titles[0]['name'] if titles else selected_title
    wins = get_user_wins_map([username]).get(username, 0)
    wrong_stats = get_wrong_book_stats(username)
    return {
        'username': username,
        'wins': wins,
        'selectedTitle': selected_title,
        'titles': titles,
        'achievements': titles,
        'avatarImage': profile.get('avatarImage') or '',
        'avatarGallery': profile.get('avatarGallery') or [],
        'face': profile.get('face') or DEFAULT_FACE,
        'hair': profile.get('hair') or DEFAULT_HAIR,
        'eyes': profile.get('eyes') or DEFAULT_EYES,
        'eyesOffsetY': int(profile.get('eyesOffsetY') or 0),
        'wrongStats': wrong_stats,
    }


def save_user_profile(username, payload):
    if not username:
        return
    current_profile = get_user_profile(username)
    avatar_image = str(payload.get('avatarImage', current_profile.get('avatarImage', '')) or '').strip()
    avatar_gallery = payload.get('avatarGallery', current_profile.get('avatarGallery', []))
    if not isinstance(avatar_gallery, list):
        avatar_gallery = current_profile.get('avatarGallery', [])
    normalized_gallery = []
    seen_gallery = set()
    for item in avatar_gallery:
        value = str(item or '').strip()
        if not value or value in seen_gallery:
            continue
        seen_gallery.add(value)
        normalized_gallery.append(value)
    if avatar_image and avatar_image not in seen_gallery:
        normalized_gallery.insert(0, avatar_image)
    selected_title = str(payload.get('selectedTitle', current_profile.get('selectedTitle', '')) or '').strip()
    face = str(payload.get('face', DEFAULT_FACE) or DEFAULT_FACE).strip() or DEFAULT_FACE
    hair = str(payload.get('hair', DEFAULT_HAIR) or DEFAULT_HAIR).strip() or DEFAULT_HAIR
    eyes = str(payload.get('eyes', DEFAULT_EYES) or DEFAULT_EYES).strip() or DEFAULT_EYES
    eyes_offset_y = int(payload.get('eyesOffsetY', 0) or 0)
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.execute('''
            INSERT INTO user_profiles
            (username, avatar_image, avatar_gallery, selected_title, face, hair, eyes, eyes_offset_y, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                avatar_image=excluded.avatar_image,
                avatar_gallery=excluded.avatar_gallery,
                selected_title=excluded.selected_title,
                face=excluded.face,
                hair=excluded.hair,
                eyes=excluded.eyes,
                eyes_offset_y=excluded.eyes_offset_y,
                updated_at=excluded.updated_at
        ''', (
            username,
            avatar_image,
            json.dumps(normalized_gallery, ensure_ascii=False),
            selected_title,
            face,
            hair,
            eyes,
            eyes_offset_y,
            now_ts()
        ))
        conn.commit()


def record_room_winner(conn, pin):
    room = conn.execute('SELECT pin, room_name, bank_id, bank_title FROM rooms WHERE pin=?', (pin,)).fetchone()
    if not room:
        return
    rankings = conn.execute('''
        SELECT rr.player_name, COALESCE(SUM(rr.points_earned), 0) AS total_score
        FROM room_results rr
        JOIN room_players rp ON rp.room_pin = rr.room_pin AND rp.player_name = rr.player_name
        WHERE rr.room_pin = ?
          AND NOT (rp.player_name LIKE '__host_%__' AND rp.is_host=1)
        GROUP BY rr.player_name
        ORDER BY total_score DESC, rr.player_name ASC
    ''', (pin,)).fetchall()
    if not rankings:
        return
    winner = rankings[0]
    winner_name = str(winner.get('player_name') or '').strip()
    if not get_user_exists(winner_name):
        return

    already = conn.execute('SELECT 1 FROM user_match_history WHERE room_pin=? LIMIT 1', (pin,)).fetchone()
    if already:
        return

    conn.execute('''
        INSERT INTO user_match_history
        (room_pin, room_name, bank_id, bank_title, winner_username, winner_score, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        pin,
        room.get('room_name') or '',
        room.get('bank_id') or '',
        room.get('bank_title') or '',
        winner_name,
        int(winner.get('total_score') or 0),
        now_ts(),
    ))
    conn.execute('''
        INSERT INTO user_stats (username, wins, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(username) DO UPDATE SET
            wins = user_stats.wins + 1,
            updated_at = excluded.updated_at
    ''', (winner_name, now_ts()))


def build_room_history_archive(conn, pin):
    room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
    if not room:
        return None
    questions = conn.execute('''
        SELECT question_id, seq, title, content, type, answer_json, explanation, difficulty, category
        FROM room_questions
        WHERE room_pin=?
        ORDER BY seq ASC
    ''', (pin,)).fetchall()
    results = conn.execute('''
        SELECT rr.*, rp.team_id, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
        FROM room_results rr
        JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
        WHERE rr.room_pin=?
        ORDER BY rr.answer_order ASC, rr.answered_at ASC, rr.player_name ASC
    ''', (pin,)).fetchall()
    players = conn.execute('''
        SELECT player_name, face, hair, eyes, eyes_offset_y, is_host, is_eliminated, team_id, joined_at
        FROM room_players
        WHERE room_pin=?
          AND NOT (player_name LIKE '__host_%__' AND is_host=1)
        ORDER BY is_host DESC, player_name ASC
    ''', (pin,)).fetchall()
    if not questions and not results:
        return None

    leaderboard_rows = conn.execute('''
        SELECT rp.player_name,
               rp.team_id,
               rp.face,
               rp.hair,
               rp.eyes,
               rp.eyes_offset_y,
               rp.is_eliminated,
               COALESCE(SUM(rr.points_earned), 0) AS total_score,
               COALESCE(SUM(CASE WHEN rr.is_correct=1 THEN 1 ELSE 0 END), 0) AS correct_count,
               COUNT(rr.question_id) AS answered_count
        FROM room_players rp
        LEFT JOIN room_results rr ON rr.room_pin=rp.room_pin AND rr.player_name=rp.player_name
        WHERE rp.room_pin=?
          AND NOT (rp.player_name LIKE '__host_%__' AND rp.is_host=1)
        GROUP BY rp.player_name, rp.team_id, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y, rp.is_eliminated
        ORDER BY total_score DESC, correct_count DESC, rp.player_name ASC
    ''', (pin,)).fetchall()
    leaderboard = [{
        'playerName': row.get('player_name') or '',
        'teamId': int(row.get('team_id') or 0),
        'totalScore': int(row.get('total_score') or 0),
        'correctCount': int(row.get('correct_count') or 0),
        'answeredCount': int(row.get('answered_count') or 0),
        'isEliminated': bool(row.get('is_eliminated') or 0),
        'avatar': {
            'face': row.get('face') or DEFAULT_FACE,
            'hair': row.get('hair') or DEFAULT_HAIR,
            'eyes': row.get('eyes') or DEFAULT_EYES,
            'eyesOffsetY': int(row.get('eyes_offset_y') or 0),
        },
    } for row in leaderboard_rows]

    question_meta = {row.get('question_id'): row for row in questions}
    correct_total = 0
    wrong_total = 0
    question_breakdown = []
    for row in questions:
        question_id = row.get('question_id')
        q_results = [item for item in results if item.get('question_id') == question_id]
        total_attempts = len(q_results)
        wrong_attempts = sum(1 for item in q_results if not bool(item.get('is_correct')))
        correct_attempts = total_attempts - wrong_attempts
        correct_total += correct_attempts
        wrong_total += wrong_attempts
        wrong_answers = {}
        for item in q_results:
            if bool(item.get('is_correct')):
                continue
            key = item.get('selected_json') or '[]'
            wrong_answers[key] = wrong_answers.get(key, 0) + 1
        question_breakdown.append({
            'questionId': question_id,
            'seq': int(row.get('seq') or 0),
            'title': row.get('title') or '',
            'category': row.get('category') or DEFAULT_CATEGORY,
            'difficulty': row.get('difficulty') or DEFAULT_DIFFICULTY,
            'attempts': total_attempts,
            'wrongCount': wrong_attempts,
            'correctRate': round((correct_attempts / total_attempts) * 100, 1) if total_attempts else 0,
            'topWrongAnswers': [
                {'answer': answer, 'count': count}
                for answer, count in sorted(wrong_answers.items(), key=lambda pair: (-pair[1], pair[0]))[:3]
            ],
        })

    detail = {
        'room': {
            'pin': room.get('pin') or '',
            'roomName': room.get('room_name') or '',
            'bankId': room.get('bank_id') or '',
            'bankTitle': room.get('bank_title') or '',
            'createdBy': room.get('created_by') or '',
            'teamMode': bool(room.get('team_mode') or 0),
            'closedAt': now_ts(),
        },
        'players': [{
            'playerName': row.get('player_name') or '',
            'teamId': int(row.get('team_id') or 0),
            'isHost': bool(row.get('is_host') or 0),
            'isEliminated': bool(row.get('is_eliminated') or 0),
            'joinedAt': int(row.get('joined_at') or 0),
            'avatar': {
                'face': row.get('face') or DEFAULT_FACE,
                'hair': row.get('hair') or DEFAULT_HAIR,
                'eyes': row.get('eyes') or DEFAULT_EYES,
                'eyesOffsetY': int(row.get('eyes_offset_y') or 0),
            },
        } for row in players],
        'questions': [{
            'questionId': row.get('question_id') or '',
            'seq': int(row.get('seq') or 0),
            'title': row.get('title') or '',
            'content': row.get('content') or '',
            'type': row.get('type') or 'single',
            'answers': parse_json_value(row.get('answer_json'), []),
            'explanation': row.get('explanation') or '',
            'difficulty': row.get('difficulty') or DEFAULT_DIFFICULTY,
            'category': row.get('category') or DEFAULT_CATEGORY,
        } for row in questions],
        'results': [{
            'playerName': row.get('player_name') or '',
            'questionId': row.get('question_id') or '',
            'questionTitle': (question_meta.get(row.get('question_id')) or {}).get('title') or '',
            'seq': int((question_meta.get(row.get('question_id')) or {}).get('seq') or 0),
            'selectedJson': row.get('selected_json') or '[]',
            'isCorrect': bool(row.get('is_correct') or 0),
            'pointsEarned': int(row.get('points_earned') or 0),
            'answerOrder': int(row.get('answer_order') or 0),
            'answeredAt': int(row.get('answered_at') or 0),
            'teamId': int(row.get('team_id') or 0),
        } for row in results],
        'leaderboard': leaderboard,
        'questionBreakdown': question_breakdown,
        'chartStats': {'correctTotal': correct_total, 'wrongTotal': wrong_total},
    }
    return {
        'roomPin': room.get('pin') or '',
        'createdBy': room.get('created_by') or '',
        'roomName': room.get('room_name') or '',
        'bankId': room.get('bank_id') or '',
        'bankTitle': room.get('bank_title') or '',
        'gameMode': 'team' if bool(room.get('team_mode') or 0) else 'individual',
        'playerNamesText': ' | '.join([row.get('player_name') or '' for row in players]),
        'questionCount': len(questions),
        'playerCount': len(players),
        'closedAt': now_ts(),
        'summaryJson': json.dumps({
            'leaderboard': leaderboard[:10],
            'questionBreakdown': question_breakdown[:10],
            'chartStats': detail['chartStats'],
        }, ensure_ascii=False),
        'detailJson': json.dumps(detail, ensure_ascii=False),
    }


def archive_room_history(conn, pin):
    archive = build_room_history_archive(conn, pin)
    if not archive:
        return
    conn.execute('''
        INSERT INTO room_history_archive
        (room_pin, created_by, room_name, bank_id, bank_title, game_mode, player_names_text,
         question_count, player_count, closed_at, summary_json, detail_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_pin) DO UPDATE SET
            created_by=excluded.created_by,
            room_name=excluded.room_name,
            bank_id=excluded.bank_id,
            bank_title=excluded.bank_title,
            game_mode=excluded.game_mode,
            player_names_text=excluded.player_names_text,
            question_count=excluded.question_count,
            player_count=excluded.player_count,
            closed_at=excluded.closed_at,
            summary_json=excluded.summary_json,
            detail_json=excluded.detail_json
    ''', (
        archive['roomPin'], archive['createdBy'], archive['roomName'], archive['bankId'],
        archive['bankTitle'], archive['gameMode'], archive['playerNamesText'],
        archive['questionCount'], archive['playerCount'], archive['closedAt'],
        archive['summaryJson'], archive['detailJson']
    ))


def load_quiz_store():
    ensure_file(QUIZ_BANKS_PATH, {'users': {}})
    with open(QUIZ_BANKS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, dict) or not isinstance(data.get('users'), dict):
        data = {'users': {}}
    normalized_users = {}
    for username, banks in data.get('users', {}).items():
        if isinstance(banks, list):
            normalized_users[str(username)] = [normalize_bank(bank) for bank in banks]
    data['users'] = normalized_users
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
        mutable_banks = []
        for bank in banks if isinstance(banks, list) else []:
            if isinstance(bank, dict) and (bank.get('readonly') or bank.get('isSystem') or bank.get('isWrongBook')):
                continue
            mutable_banks.append(normalize_bank(bank))
        data['users'][username] = mutable_banks
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
    archive_room_history(conn, pin)
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
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
        ''')
        c.execute('PRAGMA table_info(users)')
        existing = {row[1] for row in c.fetchall()}
        if 'created_at' not in existing:
            c.execute('ALTER TABLE users ADD COLUMN created_at INTEGER')
            c.execute("UPDATE users SET created_at = strftime('%s','now') WHERE created_at IS NULL")
        c.execute('''
            CREATE TABLE IF NOT EXISTS wrong_question_book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                source_bank_id TEXT NOT NULL,
                source_bank_title TEXT,
                question_id TEXT NOT NULL,
                title TEXT,
                content TEXT,
                type TEXT,
                options_json TEXT,
                explanation TEXT,
                image TEXT,
                category TEXT DEFAULT '綜合',
                difficulty TEXT DEFAULT 'medium',
                wrong_count INTEGER DEFAULT 1,
                last_wrong_at INTEGER,
                created_at INTEGER,
                UNIQUE(username, source_bank_id, question_id)
            )
        ''')
        c.execute('PRAGMA table_info(wrong_question_book)')
        wrong_cols = {row[1] for row in c.fetchall()}
        for col, typ in [
            ('source_bank_title', 'TEXT'),
            ('image', 'TEXT'),
            ('category', "TEXT DEFAULT '綜合'"),
            ('difficulty', "TEXT DEFAULT 'medium'"),
            ('wrong_count', 'INTEGER DEFAULT 1'),
            ('last_wrong_at', 'INTEGER'),
            ('created_at', 'INTEGER'),
        ]:
            if col not in wrong_cols:
                c.execute(f'ALTER TABLE wrong_question_book ADD COLUMN {col} {typ}')
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester TEXT NOT NULL,
                addressee TEXT NOT NULL,
                status TEXT DEFAULT 'accepted',
                created_at INTEGER,
                UNIQUE(requester, addressee)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester TEXT NOT NULL,
                addressee TEXT NOT NULL,
                requester_device TEXT,
                status TEXT DEFAULT 'pending',
                created_at INTEGER,
                responded_at INTEGER
            )
        ''')
        c.execute('PRAGMA table_info(user_friend_requests)')
        req_cols = {row[1] for row in c.fetchall()}
        for col, typ in [
            ('requester_device', 'TEXT'),
            ('status', "TEXT DEFAULT 'pending'"),
            ('created_at', 'INTEGER'),
            ('responded_at', 'INTEGER'),
        ]:
            if col not in req_cols:
                c.execute(f'ALTER TABLE user_friend_requests ADD COLUMN {col} {typ}')
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_stats (
                username TEXT PRIMARY KEY,
                wins INTEGER DEFAULT 0,
                updated_at INTEGER
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_profiles (
                username TEXT PRIMARY KEY,
                avatar_image TEXT,
                avatar_gallery TEXT,
                selected_title TEXT,
                face TEXT DEFAULT 'images/face/face.png',
                hair TEXT DEFAULT 'images/hair/hair01.png',
                eyes TEXT DEFAULT 'images/face/eyes01.png',
                eyes_offset_y INTEGER DEFAULT 0,
                updated_at INTEGER
            )
        ''')
        c.execute('PRAGMA table_info(user_profiles)')
        profile_cols = {row[1] for row in c.fetchall()}
        for col, typ in [
            ('avatar_image', 'TEXT'),
            ('avatar_gallery', 'TEXT'),
            ('selected_title', 'TEXT'),
            ('face', f"TEXT DEFAULT '{DEFAULT_FACE}'"),
            ('hair', f"TEXT DEFAULT '{DEFAULT_HAIR}'"),
            ('eyes', f"TEXT DEFAULT '{DEFAULT_EYES}'"),
            ('eyes_offset_y', 'INTEGER DEFAULT 0'),
            ('updated_at', 'INTEGER'),
        ]:
            if col not in profile_cols:
                c.execute(f'ALTER TABLE user_profiles ADD COLUMN {col} {typ}')
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_match_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT UNIQUE,
                room_name TEXT,
                bank_id TEXT,
                bank_title TEXT,
                winner_username TEXT,
                winner_score INTEGER DEFAULT 0,
                recorded_at INTEGER
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
                difficulty TEXT DEFAULT 'medium', category TEXT DEFAULT '綜合',
                origin_bank_id TEXT, origin_question_id TEXT,
                UNIQUE(room_pin, question_id)
            )
        ''')
        c.execute('PRAGMA table_info(room_questions)')
        qcols = {row[1] for row in c.fetchall()}
        for col, typ in [
            ('difficulty', "TEXT DEFAULT 'medium'"),
            ('category', "TEXT DEFAULT '綜合'")
        ]:
            if col not in qcols:
                c.execute(f'ALTER TABLE room_questions ADD COLUMN {col} {typ}')

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

        c.execute('''
            CREATE TABLE IF NOT EXISTS room_history_archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_pin TEXT UNIQUE,
                created_by TEXT,
                room_name TEXT,
                bank_id TEXT,
                bank_title TEXT,
                game_mode TEXT,
                player_names_text TEXT,
                question_count INTEGER DEFAULT 0,
                player_count INTEGER DEFAULT 0,
                closed_at INTEGER,
                summary_json TEXT,
                detail_json TEXT
            )
        ''')
        c.execute('PRAGMA table_info(room_history_archive)')
        hcols = {row[1] for row in c.fetchall()}
        for col, typ in [
            ('room_pin', 'TEXT UNIQUE'),
            ('created_by', 'TEXT'),
            ('room_name', 'TEXT'),
            ('bank_id', 'TEXT'),
            ('bank_title', 'TEXT'),
            ('game_mode', 'TEXT'),
            ('player_names_text', 'TEXT'),
            ('question_count', 'INTEGER DEFAULT 0'),
            ('player_count', 'INTEGER DEFAULT 0'),
            ('closed_at', 'INTEGER'),
            ('summary_json', 'TEXT'),
            ('detail_json', 'TEXT'),
        ]:
            if col not in hcols:
                c.execute(f'ALTER TABLE room_history_archive ADD COLUMN {col} {typ}')

        conn.commit()


ensure_data_store()
init_users_db()
init_rooms_db()
ensure_file(QUIZ_BANKS_PATH, {'users': {}})


@app.route('/')
def home():
    return send_from_directory(PROJECT_DIR, 'index.html')


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
            conn.execute('''
                INSERT OR IGNORE INTO user_profiles
                (username, avatar_image, selected_title, face, hair, eyes, eyes_offset_y, updated_at)
                VALUES (?, '', '', ?, ?, ?, 0, ?)
            ''', (username, DEFAULT_FACE, DEFAULT_HAIR, DEFAULT_EYES, now_ts()))
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
        return jsonify(
            success=True,
            username=user['username'],
            email=user['email'],
            message='登入成功',
            profile=build_profile_summary(user['username'])
        )
    except Exception as e:
        return jsonify(success=False, message=f'伺服器錯誤：{e}'), 500


@app.route('/load_quiz_banks')
def load_quiz_banks_api():
    username = request.args.get('username', '').strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(
        success=True,
        quizBanks=load_quiz_banks_for_user(username),
        systemQuizBanks=load_default_quiz_banks(),
        wrongBook=build_wrong_book_for_user(username)
    )


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


@app.route('/generate_quiz_bank', methods=['POST'])
def generate_quiz_bank_api():
    try:
        data = request.get_json() or {}
        topic = str(data.get('topic', '')).strip()
        category = str(data.get('category', '')).strip()
        difficulty = normalize_difficulty(data.get('difficulty'))
        requested_count = int(data.get('count', 5) or 5)
        count = requested_count if requested_count in {1, 3, 5, 7} else 5
        source_mode = str(data.get('sourceMode', 'ai')).strip()
        api_key = str(data.get('apiKey', '')).strip()
        bank = generate_ai_quiz_bank(topic, category, difficulty, count, source_mode=source_mode, api_key_override=api_key)
        return jsonify(success=True, quizBank=bank)
    except Exception as e:
        return jsonify(success=False, message=f'AI 題庫生成失敗：{e}'), 500


@app.route('/friends_overview')
def friends_overview_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    overview = build_friends_overview(username)
    return jsonify(success=True, **overview)


@app.route('/friend_requests_summary')
def friend_requests_summary_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    summary = build_friend_request_summary(username)
    return jsonify(success=True, **summary)


@app.route('/profile_summary')
def profile_summary_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(success=True, profile=build_profile_summary(username))


@app.route('/save_profile', methods=['POST'])
def save_profile_api():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        profile = data.get('profile', {}) if isinstance(data.get('profile', {}), dict) else {}
        if not username:
            return jsonify(success=False, message='缺少使用者帳號'), 400
        allowed_titles = {item['name'] for item in build_available_titles(username)}
        if profile.get('selectedTitle') and allowed_titles and str(profile.get('selectedTitle')) not in allowed_titles:
            return jsonify(success=False, message='這個稱號尚未解鎖'), 400
        save_user_profile(username, profile)
        return jsonify(success=True, message='個人資料已更新', profile=build_profile_summary(username))
    except Exception as e:
        return jsonify(success=False, message=f'更新個人資料失敗：{e}'), 500


@app.route('/room_history_summary')
def room_history_summary_api():
    username = str(request.args.get('username', '')).strip()
    player_name = str(request.args.get('playerName', '')).strip().lower()
    bank_keyword = str(request.args.get('bankKeyword', '')).strip().lower()
    game_mode = str(request.args.get('gameMode', '')).strip().lower()
    start_date = str(request.args.get('startDate', '')).strip()
    end_date = str(request.args.get('endDate', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400

    where = ['created_by=?']
    params = [username]
    if player_name:
        where.append('LOWER(player_names_text) LIKE ?')
        params.append(f'%{player_name}%')
    if bank_keyword:
        where.append('(LOWER(bank_title) LIKE ? OR LOWER(room_name) LIKE ?)')
        params.extend([f'%{bank_keyword}%', f'%{bank_keyword}%'])
    if game_mode in {'individual', 'team'}:
        where.append('game_mode=?')
        params.append(game_mode)
    if start_date:
        try:
            start_ts = int(time.mktime(time.strptime(start_date, '%Y-%m-%d')))
            where.append('closed_at>=?')
            params.append(start_ts)
        except Exception:
            pass
    if end_date:
        try:
            end_ts = int(time.mktime(time.strptime(end_date, '%Y-%m-%d'))) + 86399
            where.append('closed_at<=?')
            params.append(end_ts)
        except Exception:
            pass

    with closing(get_conn()) as conn:
        rows = conn.execute(f'''
            SELECT id, room_pin, room_name, bank_title, game_mode, player_names_text,
                   question_count, player_count, closed_at, summary_json
            FROM room_history_archive
            WHERE {' AND '.join(where)}
            ORDER BY closed_at DESC, id DESC
        ''', params).fetchall()

    records = []
    for row in rows:
        summary = parse_json_value(row.get('summary_json'), {})
        chart_stats = summary.get('chartStats', {}) if isinstance(summary, dict) else {}
        records.append({
            'id': int(row.get('id') or 0),
            'roomPin': row.get('room_pin') or '',
            'roomName': row.get('room_name') or '',
            'bankTitle': row.get('bank_title') or '',
            'gameMode': row.get('game_mode') or 'individual',
            'playerNames': [name.strip() for name in str(row.get('player_names_text') or '').split('|') if name.strip()],
            'questionCount': int(row.get('question_count') or 0),
            'playerCount': int(row.get('player_count') or 0),
            'closedAt': int(row.get('closed_at') or 0),
            'correctTotal': int(chart_stats.get('correctTotal') or 0),
            'wrongTotal': int(chart_stats.get('wrongTotal') or 0),
            'leaderboard': summary.get('leaderboard', []) if isinstance(summary, dict) else [],
        })
    return jsonify(success=True, records=records)


@app.route('/room_history_detail')
def room_history_detail_api():
    history_id = int(request.args.get('id', '0') or 0)
    if history_id <= 0:
        return jsonify(success=False, message='缺少歷史記錄編號'), 400
    with closing(get_conn()) as conn:
        row = conn.execute('SELECT detail_json FROM room_history_archive WHERE id=?', (history_id,)).fetchone()
    if not row:
        return jsonify(success=False, message='找不到該歷史記錄'), 404
    return jsonify(success=True, detail=parse_json_value(row.get('detail_json'), {}))


@app.route('/send_friend_request', methods=['POST'])
def send_friend_request_api():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        friend_name = str(data.get('friendName', '')).strip()
        if not username or not friend_name:
            return jsonify(success=False, message='請輸入好友帳號'), 400
        if username == friend_name:
            return jsonify(success=False, message='自己已經在好友榜裡了'), 400
        if not get_user_exists(username) or not get_user_exists(friend_name):
            return jsonify(success=False, message='找不到這個帳號'), 404

        a, b = sorted([username, friend_name], key=lambda item: item.lower())
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            existing_friend = conn.execute('''
                SELECT 1 FROM user_friendships
                WHERE requester=? AND addressee=? AND status='accepted'
                LIMIT 1
            ''', (a, b)).fetchone()
            if existing_friend:
                return jsonify(success=False, message='你們已經是好友了'), 400

            pending = conn.execute('''
                SELECT id, requester, addressee
                FROM user_friend_requests
                WHERE status='pending'
                  AND (
                    (requester=? AND addressee=?)
                    OR
                    (requester=? AND addressee=?)
                  )
                ORDER BY id DESC
                LIMIT 1
            ''', (username, friend_name, friend_name, username)).fetchone()
            if pending:
                if str(pending[1]) == friend_name and str(pending[2]) == username:
                    return jsonify(success=False, message='對方已向你送出申請，請到申請紀錄接受'), 400
                return jsonify(success=False, message='好友申請已送出，請等待對方回應'), 400

            conn.execute('''
                INSERT INTO user_friend_requests
                (requester, addressee, requester_device, status, created_at)
                VALUES (?, ?, ?, 'pending', ?)
            ''', (username, friend_name, describe_client_device(request.user_agent.string), now_ts()))
            conn.commit()
        summary = build_friend_request_summary(friend_name)
        return jsonify(success=True, message='好友申請已送出', **summary)
    except Exception as e:
        return jsonify(success=False, message=f'加入好友失敗：{e}'), 500


@app.route('/respond_friend_request', methods=['POST'])
def respond_friend_request_api():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        request_id = int(data.get('requestId', 0) or 0)
        action = str(data.get('action', '')).strip().lower()
        if not username or request_id <= 0:
            return jsonify(success=False, message='缺少申請資訊'), 400
        if action not in {'accept', 'reject'}:
            return jsonify(success=False, message='不支援的操作'), 400

        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.row_factory = dict_factory
            row = conn.execute('''
                SELECT id, requester, addressee, status
                FROM user_friend_requests
                WHERE id=? AND addressee=?
                LIMIT 1
            ''', (request_id, username)).fetchone()
            if not row:
                return jsonify(success=False, message='找不到這筆好友申請'), 404
            if str(row.get('status') or '') != 'pending':
                return jsonify(success=False, message='這筆申請已處理過'), 400

            conn.execute('''
                UPDATE user_friend_requests
                SET status=?, responded_at=?
                WHERE id=?
            ''', ('accepted' if action == 'accept' else 'rejected', now_ts(), request_id))

            if action == 'accept':
                a, b = sorted([str(row.get('requester') or '').strip(), username], key=lambda item: item.lower())
                conn.execute('''
                    INSERT OR IGNORE INTO user_friendships (requester, addressee, status, created_at)
                    VALUES (?, ?, 'accepted', ?)
                ''', (a, b, now_ts()))
            conn.commit()

        return jsonify(
            success=True,
            message='已接受好友申請' if action == 'accept' else '已忽略好友申請',
            overview=build_friends_overview(username),
            requestSummary=build_friend_request_summary(username)
        )
    except Exception as e:
        return jsonify(success=False, message=f'處理好友申請失敗：{e}'), 500


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
                q = normalize_question(q)
                options = q.get('options', [])
                answer_indexes = sorted([i for i, opt in enumerate(options) if opt.get('correct')])
                conn.execute('''
                    INSERT INTO room_questions
                    (room_pin,question_id,seq,title,content,type,options_json,answer_json,
                     explanation,time_label,score,fake_answer,mode,image,difficulty,category,origin_bank_id,origin_question_id)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ''', (pin, str(q.get('roomQuestionId') or uid('rq')), idx,
                      q.get('title',''), q.get('content',''), q.get('type','single'),
                      json.dumps(options, ensure_ascii=False),
                      json.dumps(answer_indexes, ensure_ascii=False),
                      q.get('explanation',''), q.get('time','20 秒'),
                      int(q.get('score',1000) or 1000), 1 if q.get('fakeAnswer') else 0,
                      q.get('mode','個人賽'), q.get('image',''),
                      normalize_difficulty(q.get('difficulty')),
                      normalize_category(q.get('category')),
                      bank_id, str(q.get('id',''))))

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


@app.route('/kick_player', methods=['POST'])
def kick_player():
    try:
        data = request.get_json(silent=True) or {}
        pin = str(data.get('pin', '')).strip()
        host_name = str(data.get('hostName', '')).strip()
        target_name = str(data.get('targetName', '')).strip()
        if not pin or not host_name or not target_name:
            return jsonify(success=False, message='缺少必要資料'), 400
        with closing(get_conn()) as conn:
            host_row = conn.execute(
                'SELECT 1 FROM room_players WHERE room_pin=? AND player_name=? AND is_host=1',
                (pin, host_name)
            ).fetchone()
            if not host_row:
                return jsonify(success=False, message='只有房主可以踢人'), 403
            target = conn.execute(
                'SELECT is_host FROM room_players WHERE room_pin=? AND player_name=?',
                (pin, target_name)
            ).fetchone()
            if not target:
                return jsonify(success=False, message='找不到該玩家'), 404
            if int(target.get('is_host') or 0) == 1:
                return jsonify(success=False, message='不能踢掉房主'), 400
            conn.execute('DELETE FROM room_players WHERE room_pin=? AND player_name=?', (pin, target_name))
            conn.commit()
        return jsonify(success=True, message='玩家已被移出房間')
    except Exception as e:
        return jsonify(success=False, message=f'踢人失敗：{e}'), 500


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
            players = conn.execute('''
                SELECT player_name, face, hair, eyes, eyes_offset_y, is_host, is_eliminated, team_id
                FROM room_players
                WHERE room_pin=?
                  AND NOT (player_name LIKE '__host_%__' AND is_host=1)
                ORDER BY is_host DESC, joined_at ASC, id ASC
            ''', (pin,)).fetchall()

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
                SELECT rr.player_name,
                       COALESCE(SUM(rr.points_earned),0) AS total_score,
                       rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                FROM room_results rr
                JOIN room_players rp
                  ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=?
                GROUP BY rr.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                ORDER BY total_score DESC, rr.player_name ASC
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
            elif is_team_mode:
                # 團體模式也回傳玩家列表給前端右側名單使用
                answer_status = [{
                    'player_name': p.get('player_name'),
                    'face': p.get('face'),
                    'hair': p.get('hair'),
                    'eyes': p.get('eyes'),
                    'eyes_offset_y': p.get('eyes_offset_y'),
                    'is_host': p.get('is_host'),
                    'is_eliminated': p.get('is_eliminated'),
                    'answered': 0
                } for p in players]
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
                'explanation': q.get('explanation') or '', 'image': q.get('image') or '',
                'difficulty': normalize_difficulty(q.get('difficulty')),
                'category': normalize_category(q.get('category'))
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
            players=players,
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
        username = str(data.get('username', '')).strip()
        question_id = str(data.get('questionId', '')).strip()
        selected = data.get('selected', [])
        text_answer = str(data.get('textAnswer', '')).strip()
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
            question_type = str(q.get('type') or 'single')
            options = json.loads(q.get('options_json') or '[]')
            option_labels = [chr(65+i) for i in answer_indexes]
            fill_answer = ''
            if question_type == 'fill' and options:
                fill_answer = str(options[0].get('text') or '').strip()

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
                               answerText=(fill_answer or '無') if question_type == 'fill' else ('、'.join(option_labels) or '無'),
                               totalScore=total_score)

            if question_type == 'fill':
                normalized_input = ''.join(text_answer.lower().split())
                normalized_answer = ''.join(fill_answer.lower().split())
                is_correct = 1 if normalized_input and normalized_input == normalized_answer else 0
            else:
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

            if not is_correct:
                owner = get_wrong_book_owner(username, player_name)
                save_wrong_question(owner, room.get('bank_id'), room.get('bank_title'), q)

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
                SELECT rr.player_name,
                       COALESCE(SUM(points_earned),0) AS total_score,
                       rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                FROM room_results rr
                JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=? AND rp.is_eliminated=0
                GROUP BY rr.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                ORDER BY total_score DESC,rr.player_name ASC LIMIT 5
            ''', (pin,)).fetchall()
            all_rank = conn.execute('''
                SELECT rr.player_name,
                       COALESCE(SUM(rr.points_earned),0) AS total_score,
                       rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                FROM room_results rr
                JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=? AND rp.is_eliminated=0
                GROUP BY rr.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                ORDER BY total_score DESC,rr.player_name ASC
            ''', (pin,)).fetchall()
            my_rank = next((i+1 for i,r in enumerate(all_rank) if r['player_name']==player_name), None)
            conn.commit()

            return jsonify(success=True, isCorrect=bool(is_correct), pointsEarned=points,
                           answerOrder=answer_order,
                           correctIndexes=answer_indexes, correctLabels=option_labels,
                           explanation=q.get('explanation') or '',
                           answerText=(fill_answer or '無') if question_type == 'fill' else ('、'.join(option_labels) or '無'),
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
            if next_index >= total:
                conn.execute(
                    "UPDATE rooms SET current_question_index=?,phase='question',status='closed' WHERE pin=?",
                    (next_index, pin)
                )
                record_room_winner(conn, pin)
            else:
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
            record_room_winner(conn, pin)
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
