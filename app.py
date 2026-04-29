from flask import Flask, send_from_directory, request, jsonify
import os, sqlite3, json, hashlib, random, time, threading, shutil, html, re
import urllib.parse, urllib.request

try:
    import requests
except Exception:
    requests = None

try:
    import psycopg2
    import psycopg2.extras
except Exception:
    psycopg2 = None
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
VALID_LANGUAGES = {'zh', 'en', 'ja', 'ko', 'es'}
OPENAI_API_URL = 'https://api.openai.com/v1/responses'
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-5')
HF_API_URL = os.environ.get('HF_API_URL', 'https://router.huggingface.co/v1/chat/completions')
HF_MODEL = os.environ.get('HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
ALLOW_AI_FALLBACK = os.environ.get('ALLOW_AI_FALLBACK', '1').strip() != '0'


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


def get_database_url():
    url = DATABASE_URL
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url


def use_postgres_quiz_store():
    return bool(get_database_url() and psycopg2 is not None)


def use_postgres_user_store():
    return use_postgres_quiz_store()


def get_pg_conn():
    url = get_database_url()
    if not url or psycopg2 is None:
        raise RuntimeError('DATABASE_URL 尚未設定，或 requirements.txt 尚未安裝 psycopg2-binary。')
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def init_postgres_quiz_banks_db():
    if not use_postgres_quiz_store():
        return
    with closing(get_pg_conn()) as conn:
        with conn.cursor() as cur:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS quiz_banks (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL,
                    bank_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    data JSONB NOT NULL,
                    updated_at BIGINT DEFAULT 0,
                    UNIQUE(username, bank_id)
                )
            ''')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_quiz_banks_username ON quiz_banks(username)')
        conn.commit()


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


def normalize_language(value):
    lang = str(value or 'zh').strip().lower()
    return lang if lang in VALID_LANGUAGES else 'zh'


def language_name(value):
    return {
        'zh': '繁體中文',
        'en': 'English',
        'ja': '日本語',
        'ko': '한국어',
        'es': 'Español',
    }.get(normalize_language(value), '繁體中文')


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
        'language': normalize_language(q.get('language')),
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
        'language': normalize_language(bank.get('language')),
        'questions': [normalize_question(q) for q in questions],
        'updatedAt': int(bank.get('updatedAt', now_ts()) or now_ts()),
    }


def load_default_quiz_banks():
    if not os.path.exists(DEFAULT_BANKS_PATH):
        banks = []
    else:
        with open(DEFAULT_BANKS_PATH, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        banks = raw.get('banks', []) if isinstance(raw, dict) else []
    banks = banks + build_extra_system_banks()
    normalized = []
    for bank in banks:
        item = normalize_bank(bank)
        item['isSystem'] = True
        item['readonly'] = True
        normalized.append(item)
    return normalized


def build_extra_system_banks():
    templates = [
        ('system_story_ai_data', '系統題庫：AI巨量資料任務', 'AI與巨量資料', [
            ('資料欄位判斷', '資料表中的一欄通常代表什麼？', ['同一種屬性的資料', '整個網站', '一張圖片的背景', '不能分析的文字'], 0),
            ('缺失值處理', '分析前發現資料缺很多欄位，最合理的第一步是什麼？', ['檢查缺失原因與比例', '直接刪掉全部資料', '把答案都填 100', '停止記錄'], 0),
            ('模型偏誤', '若訓練資料只來自單一族群，AI最可能出現什麼問題？', ['判斷偏誤', '速度變慢但更公平', '自動產生硬體', '永遠不會錯'], 0),
            ('視覺化目的', '資料視覺化最主要幫助使用者做到什麼？', ['快速看出趨勢與異常', '讓資料無法閱讀', '增加檔案大小', '取代所有分析'], 0),
            ('測試資料', '測試資料的主要用途是什麼？', ['檢查模型在新資料上的表現', '只拿來裝飾', '刪除訓練資料', '讓題目變短'], 0),
        ]),
        ('system_story_design_game', '系統題庫：設計與遊戲支線', '設計概論', [
            ('視覺層級', '在介面中讓重要按鈕更容易被看到，最相關的是哪個概念？', ['視覺層級', '檔案壓縮', '隨機排列', '取消留白'], 0),
            ('即時回饋', '玩家按下按鈕後立刻看到反應，主要改善什麼？', ['操作理解與手感', '題目數量', '網路費用', '背景音量'], 0),
            ('難度曲線', '好的關卡通常如何安排難度？', ['逐步提升挑戰', '第一關直接最難', '永遠沒有回饋', '完全不給目標'], 0),
            ('色彩對比', '文字與背景對比不足時，最直接影響什麼？', ['可讀性', '資料庫容量', '登入速度', '題目分類'], 0),
            ('成就設計', '成就系統最適合鼓勵玩家做什麼？', ['持續挑戰與探索', '跳過所有題目', '刪除帳號', '停止互動'], 0),
        ]),
        ('system_kahoot_share_template', 'Kahoot分享題庫：課堂快問快答', '課堂互動', [
            ('快問快答', 'Kahoot 類型題目最常見的特色是什麼？', ['短題幹與快速作答', '只能寫長篇作文', '不能計分', '沒有選項'], 0),
            ('暖身題', '課堂開始時用一題簡單題，主要目的通常是什麼？', ['讓學生快速進入狀態', '立刻淘汰所有人', '關閉互動', '取代教學'], 0),
            ('迷思診斷', '老師用即時答題看到很多人選錯，可以立刻做什麼？', ['補充講解迷思概念', '忽略結果', '刪除題庫', '停止課程'], 0),
            ('選項設計', '好的選項設計應該避免什麼？', ['每個選項都一模一樣', '有明確正解', '干擾選項合理', '文字簡潔'], 0),
            ('賽後複習', '遊戲後最能提升學習效果的是什麼？', ['回看錯題與解析', '只看名次', '不看答案', '刪掉紀錄'], 0),
        ]),
    ]
    banks = []
    for bank_id, title, category, rows in templates:
        banks.append({
            'id': bank_id,
            'title': title,
            'gameMode': 'individual',
            'language': 'zh',
            'questions': [
                {
                    'id': f'{bank_id}_{idx + 1}',
                    'title': q_title,
                    'content': content,
                    'type': 'single',
                    'category': category,
                    'difficulty': 'easy' if idx < 2 else 'medium',
                    'time': '20 秒',
                    'score': 1000,
                    'explanation': f'這題重點是「{options[answer]}」，適合用來做課堂快速複習。',
                    'options': [{'text': opt, 'correct': i == answer} for i, opt in enumerate(options)],
                }
                for idx, (q_title, content, options, answer) in enumerate(rows)
            ],
        })
    return banks


def get_wrong_book_owner(username, fallback_player_name=''):
    username = str(username or '').strip()
    if username:
        return username
    return str(fallback_player_name or '').strip()


def build_wrong_book_for_user(username):
    owner = str(username or '').strip()
    if not owner:
        return None
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT source_bank_id, source_bank_title, question_id, title, content, type,
                           options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at
                    FROM wrong_question_book
                    WHERE username=%s
                    ORDER BY wrong_count DESC, last_wrong_at DESC, id DESC
                ''', (owner,))
                rows = cur.fetchall()
    else:
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
            'title': row.get('title') or '錯題',
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

    return {
        'id': 'wrong_book',
        'title': '我的錯題本',
        'gameMode': 'individual',
        'questions': questions,
        'updatedAt': int(rows[0].get('last_wrong_at') or now_ts()),
        'isWrongBook': True,
        'readonly': True,
    }


def build_wrong_book_detail(username):
    owner = str(username or '').strip()
    if not owner:
        return {'username': '', 'items': [], 'totalWrongCount': 0}
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT source_bank_id, source_bank_title, question_id, title, content, type,
                           options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at
                    FROM wrong_question_book
                    WHERE username=%s
                    ORDER BY wrong_count DESC, last_wrong_at DESC, id DESC
                ''', (owner,))
                rows = cur.fetchall()
    else:
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.row_factory = dict_factory
            rows = conn.execute('''
                SELECT source_bank_id, source_bank_title, question_id, title, content, type,
                       options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at
                FROM wrong_question_book
                WHERE username=?
                ORDER BY wrong_count DESC, last_wrong_at DESC, id DESC
            ''', (owner,)).fetchall()

    items = []
    for row in rows:
        try:
            options = json.loads(row.get('options_json') or '[]')
        except Exception:
            options = []
        items.append({
            'sourceBankId': row.get('source_bank_id') or '',
            'sourceBankTitle': row.get('source_bank_title') or '未命名題庫',
            'questionId': row.get('question_id') or '',
            'title': row.get('title') or '錯題',
            'content': row.get('content') or '',
            'type': row.get('type') or 'single',
            'options': options,
            'explanation': row.get('explanation') or '',
            'image': row.get('image') or '',
            'category': row.get('category') or DEFAULT_CATEGORY,
            'difficulty': row.get('difficulty') or DEFAULT_DIFFICULTY,
            'wrongCount': int(row.get('wrong_count') or 0),
            'lastWrongAt': int(row.get('last_wrong_at') or 0),
            'lastWrongAtText': time.strftime('%Y-%m-%d %H:%M', time.localtime(int(row.get('last_wrong_at') or now_ts()))),
        })
    return {
        'username': owner,
        'items': items,
        'totalWrongCount': sum(item['wrongCount'] for item in items),
    }


def _legacy_build_wrong_book_for_user(username):
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
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    INSERT INTO wrong_question_book
                    (username, source_bank_id, source_bank_title, question_id, title, content, type,
                     options_json, explanation, image, category, difficulty, wrong_count, last_wrong_at, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s)
                    ON CONFLICT(username, source_bank_id, question_id)
                    DO UPDATE SET
                        source_bank_title=EXCLUDED.source_bank_title,
                        title=EXCLUDED.title,
                        content=EXCLUDED.content,
                        type=EXCLUDED.type,
                        options_json=EXCLUDED.options_json,
                        explanation=EXCLUDED.explanation,
                        image=EXCLUDED.image,
                        category=EXCLUDED.category,
                        difficulty=EXCLUDED.difficulty,
                        wrong_count=wrong_question_book.wrong_count + 1,
                        last_wrong_at=EXCLUDED.last_wrong_at
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


def build_local_fallback_quiz_bank(topic, category, difficulty, count, language='zh'):
    topic = str(topic or '綜合學習').strip() or '綜合學習'
    category = normalize_category(category)
    difficulty = normalize_difficulty(difficulty)
    language = normalize_language(language)
    questions = []
    option_templates = [
        ['了解基本概念', '完全無關的敘述', '只看表面文字', '隨機猜測答案'],
        ['先理解定義再判斷', '忽略題目條件', '只背答案不理解', '把所有選項都當正確'],
        ['能應用在實際情境', '只存在於單一情況', '不能被說明', '沒有任何用途'],
        ['比較差異與用途', '只看字數長短', '依照選項順序決定', '完全不用閱讀題目'],
        ['確認關鍵條件', '直接排除正確答案', '只選最短選項', '不需要解析']
    ]
    for i in range(max(1, int(count or 5))):
        opts = option_templates[i % len(option_templates)]
        questions.append({
            'id': uid('question'),
            'title': f'{topic}觀念題 {i + 1}',
            'content': f'關於「{topic}」，下列哪一個說法最合理？',
            'type': 'single',
            'difficulty': difficulty,
            'category': category,
            'language': language,
            'time': '20 秒',
            'score': 1000,
            'explanation': f'本題重點是理解「{topic}」的核心概念，並能排除不符合題意的選項。',
            'options': [
                {'text': opts[0], 'correct': True},
                {'text': opts[1], 'correct': False},
                {'text': opts[2], 'correct': False},
                {'text': opts[3], 'correct': False},
            ]
        })
    return normalize_bank({
        'id': uid('bank'),
        'title': f'{topic} 題庫',
        'gameMode': 'individual',
        'language': language,
        'questions': questions,
        'updatedAt': now_ts(),
    })


def extract_json_array(text):
    text = str(text or '').strip()
    if not text:
        raise RuntimeError('AI 沒有回傳文字內容。')
    fenced = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if fenced:
        text = fenced.group(1).strip()
    match = re.search(r'\[[\s\S]*\]', text)
    if not match:
        raise RuntimeError('AI 回傳格式錯誤，找不到 JSON 題目陣列。')
    return json.loads(match.group(0))


def normalize_ai_generated_question(raw, idx, category, difficulty, language='zh'):
    raw = raw if isinstance(raw, dict) else {}
    options = raw.get('options', [])
    answer = raw.get('answer', None)
    normalized_options = []
    if isinstance(options, list):
        for opt_index, opt in enumerate(options):
            if isinstance(opt, dict):
                text = str(opt.get('text') or opt.get('label') or opt.get('value') or '').strip()
                correct = bool(opt.get('correct'))
            else:
                text = str(opt or '').strip()
                correct = False
            if text:
                normalized_options.append({'text': text, 'correct': correct})
    if answer is not None and normalized_options:
        if isinstance(answer, int) and 0 <= answer < len(normalized_options):
            for opt_index, opt in enumerate(normalized_options):
                opt['correct'] = opt_index == answer
        elif isinstance(answer, str):
            answer_text = answer.strip()
            for opt in normalized_options:
                if opt['text'] == answer_text:
                    opt['correct'] = True
    if len(normalized_options) < 2:
        normalized_options = [{'text': '正確', 'correct': True}, {'text': '錯誤', 'correct': False}]
    if not any(opt.get('correct') for opt in normalized_options):
        normalized_options[0]['correct'] = True
    return normalize_question({
        'id': str(raw.get('id') or uid('question')),
        'title': str(raw.get('title') or raw.get('question') or f'AI 題目 {idx + 1}').strip(),
        'content': str(raw.get('content') or raw.get('question') or raw.get('title') or f'AI 題目 {idx + 1}').strip(),
        'type': str(raw.get('type') or 'single').strip(),
        'options': normalized_options,
        'time': str(raw.get('time') or '20 秒'),
        'score': int(raw.get('score') or 1000),
        'explanation': str(raw.get('explanation') or raw.get('解析') or '請依照題目關鍵概念判斷。').strip(),
        'difficulty': raw.get('difficulty') or difficulty,
        'category': raw.get('category') or category,
        'language': language,
    })


def generate_ai_quiz_bank(topic, category, difficulty, count, source_mode='ai', api_key_override='', language='zh'):
    hf_api_key = os.environ.get('HF_API_KEY', '').strip()
    if not hf_api_key:
        if ALLOW_AI_FALLBACK:
            return build_local_fallback_quiz_bank(topic, category, difficulty, count, language)
        raise RuntimeError('尚未設定 HF_API_KEY，請先到 Render Environment 新增 HuggingFace Token。')

    if requests is None:
        if ALLOW_AI_FALLBACK:
            return build_local_fallback_quiz_bank(topic, category, difficulty, count, language)
        raise RuntimeError('尚未安裝 requests，請在 requirements.txt 加上 requests。')

    web_context = ''
    if source_mode == 'web_ai':
        web_context = fetch_wikipedia_summary(topic)

    topic = str(topic or '綜合學習').strip() or '綜合學習'
    category = normalize_category(category)
    difficulty = normalize_difficulty(difficulty)
    language = normalize_language(language)
    output_language = language_name(language)
    count = max(1, min(int(count or 5), 20))

    prompt = (
        f'你是 QuizArena 的出題助手。\n'
        f'請產生 {count} 題測驗題。\n'
        f'主題：{topic}\n'
        f'類別：{category}\n'
        f'難度：{difficulty}\n\n'
        '請只回傳 JSON 陣列，不要加任何說明文字，不要 markdown。\n'
        '每題格式必須如下：\n'
        '[{"title":"題目標題","content":"完整題目內容","type":"single","difficulty":"medium","category":"綜合","time":"20 秒","score":1000,"explanation":"解析文字","options":[{"text":"選項A","correct":true},{"text":"選項B","correct":false},{"text":"選項C","correct":false},{"text":"選項D","correct":false}]}]\n'
        f'限制：所有題目、選項、解析都使用 {output_language}；每題至少 4 個選項；每題只能有一個正確答案；解析要簡潔但能教學。'
    )
    if web_context:
        prompt += f'\n\n可參考資料摘要：{web_context[:1200]}'

    try:
        response = requests.post(
            HF_API_URL,
            headers={
                'Authorization': f'Bearer {hf_api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': HF_MODEL,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 4200,
                'temperature': 0.7,
            },
            timeout=60
        )
        if response.status_code != 200:
            raise RuntimeError(f'HuggingFace HTTP {response.status_code}: {response.text[:300]}')

        response_json = response.json()
        content = response_json.get('choices', [{}])[0].get('message', {}).get('content', '')
        generated_questions = extract_json_array(content)
        questions = [
            normalize_ai_generated_question(q, idx, category, difficulty, language)
            for idx, q in enumerate(generated_questions[:count])
        ]
        if not questions:
            raise RuntimeError('AI 沒有產生題目。')

        return normalize_bank({
            'id': uid('bank'),
            'title': f'{topic} 題庫',
            'gameMode': 'individual',
            'language': language,
            'questions': questions,
            'updatedAt': now_ts(),
        })
    except Exception as e:
        if ALLOW_AI_FALLBACK:
            return build_local_fallback_quiz_bank(topic, category, difficulty, count, language)
        raise RuntimeError(str(e))


def translate_texts_with_ai(texts, target_lang):
    target_lang = normalize_language(target_lang)
    texts = [str(text or '').strip() for text in (texts or [])]
    texts = [text for text in texts if text][:80]
    if target_lang == 'zh' or not texts:
        return {text: text for text in texts}

    hf_api_key = os.environ.get('HF_API_KEY', '').strip()
    if not hf_api_key or requests is None:
        return {}

    output_language = language_name(target_lang)
    prompt = (
        f'請把下列 QuizArena 網站介面文字翻譯成 {output_language}。\n'
        '規則：只翻譯介面文字，不要翻譯人名、玩家名稱、帳號、PIN、數字代碼；保留符號與 HTML 無關文字；'
        '請只回傳 JSON 物件，key 是原文，value 是譯文，不要 markdown。\n'
        f'文字陣列：{json.dumps(texts, ensure_ascii=False)}'
    )
    try:
        response = requests.post(
            HF_API_URL,
            headers={
                'Authorization': f'Bearer {hf_api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': HF_MODEL,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 2400,
                'temperature': 0.2,
            },
            timeout=45
        )
        if response.status_code != 200:
            return {}
        response_json = response.json()
        content = response_json.get('choices', [{}])[0].get('message', {}).get('content', '')
        fenced = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if fenced:
            content = fenced.group(1).strip()
        match = re.search(r'\{[\s\S]*\}', content)
        if not match:
            return {}
        raw = json.loads(match.group(0))
        if not isinstance(raw, dict):
            return {}
        return {
            key: str(raw.get(key) or '').strip()
            for key in texts
            if str(raw.get(key) or '').strip()
        }
    except Exception:
        return {}

def get_user_exists(username):
    if not username:
        return False
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1 FROM users WHERE username=%s LIMIT 1', (username,))
                row = cur.fetchone()
        return row is not None
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        row = conn.execute('SELECT 1 FROM users WHERE username=?', (username,)).fetchone()
    return row is not None


def get_friend_usernames(username):
    if not username:
        return []
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT CASE
                        WHEN requester = %s THEN addressee
                        ELSE requester
                    END AS friend_name
                    FROM user_friendships
                    WHERE (requester = %s OR addressee = %s) AND status = 'accepted'
                    ORDER BY friend_name ASC
                ''', (username, username, username))
                rows = cur.fetchall()
        return [row['friend_name'] for row in rows]
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
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT username, wins FROM user_stats WHERE username = ANY(%s)', (names,))
                rows = cur.fetchall()
        result = {name: 0 for name in names}
        for row in rows:
            result[row['username']] = int(row.get('wins') or 0)
        return result
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


def normalize_profile_language(value):
    lang = str(value or '').strip().lower()
    return lang if lang in {'zh', 'en', 'ja', 'ko', 'es'} else 'zh'


VALID_COUNTIES = {
    '基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
    '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市',
    '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣',
}


def normalize_profile_county(value):
    county = str(value or '').strip()
    return county if county in VALID_COUNTIES else ''


def clean_avatar_data(value):
    avatar = str(value or '').strip()
    if not avatar:
        return ''
    if len(avatar) > 350000:
        raise ValueError('頭像檔案太大，請選擇較小的圖片')
    if avatar.startswith('style:'):
        try:
            style = json.loads(avatar[6:])
        except Exception:
            raise ValueError('造型資料格式錯誤')
        safe = {
            'type': 'style',
            'face': str(style.get('face') or DEFAULT_FACE),
            'hair': str(style.get('hair') or DEFAULT_HAIR),
            'eyes': str(style.get('eyes') or DEFAULT_EYES),
            'eyeOffset': max(-18, min(18, int(style.get('eyeOffset') or 0))),
        }
        return 'style:' + json.dumps(safe, ensure_ascii=False, separators=(',', ':'))
    if not re.match(r'^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$', avatar):
        raise ValueError('頭像格式不支援，請上傳 PNG、JPG 或 WebP')
    return avatar


def get_user_profile_map(usernames):
    names = [str(name).strip() for name in usernames if str(name).strip()]
    if not names:
        return {}
    default = {
        name: {'username': name, 'avatar': '', 'displayTitle': '新手挑戰者', 'language': 'zh', 'county': ''}
        for name in names
    }
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT username, avatar, display_title, preferred_language, county
                    FROM users
                    WHERE username = ANY(%s)
                ''', (names,))
                rows = cur.fetchall()
    else:
        placeholders = ','.join(['?'] * len(names))
        with closing(get_conn(USERS_DB_PATH)) as conn:
            rows = conn.execute(f'''
                SELECT username, avatar, display_title, preferred_language, county
                FROM users
                WHERE username IN ({placeholders})
            ''', names).fetchall()
    for row in rows:
        username = row.get('username') or ''
        if username in default:
            default[username].update({
                'avatar': row.get('avatar') or '',
                'displayTitle': row.get('display_title') or '新手挑戰者',
                'language': normalize_profile_language(row.get('preferred_language')),
                'county': normalize_profile_county(row.get('county')),
            })
    return default


def build_title_options(achievement_summary):
    options = [{'id': '新手挑戰者', 'label': '新手挑戰者'}]
    for item in achievement_summary.get('achievements', []):
        if item.get('unlocked'):
            title = str(item.get('title') or '').strip()
            if title == '好友同行':
                continue
            if title and not any(opt['id'] == title for opt in options):
                options.append({'id': title, 'label': title})
    if not any(opt['id'] == '常勝玩家' for opt in options):
        wins = get_user_wins_map([achievement_summary.get('username')]).get(achievement_summary.get('username'), 0)
        if wins >= 3:
            options.append({'id': '常勝玩家', 'label': '常勝玩家'})
    return options


def build_player_level(username, achievement_summary=None):
    username = str(username or '').strip()
    if achievement_summary is None:
        achievement_summary = build_achievement_summary(username)
    wins = get_user_wins_map([username]).get(username, 0)
    try:
        wrong_book = build_wrong_book_detail(username)
    except Exception:
        wrong_book = {'items': [], 'totalWrongCount': 0}
    try:
        banks = [bank for bank in load_quiz_banks_for_user(username) if not (bank.get('readonly') or bank.get('isSystem') or bank.get('isWrongBook'))]
    except Exception:
        banks = []
    questions = sum(len(bank.get('questions') or []) for bank in banks)
    xp = (
        int(wins or 0) * 120 +
        int(achievement_summary.get('unlockedCount') or 0) * 80 +
        len(wrong_book.get('items') or []) * 20 +
        int(wrong_book.get('totalWrongCount') or 0) * 8 +
        len(banks) * 50 +
        questions * 10
    )
    level = max(1, xp // 180 + 1)
    current_floor = (level - 1) * 180
    next_floor = level * 180
    return {
        'level': int(level),
        'xp': int(xp),
        'currentLevelXp': int(max(0, xp - current_floor)),
        'nextLevelXp': int(max(1, next_floor - current_floor)),
        'progress': int(min(100, max(0, ((xp - current_floor) / max(1, next_floor - current_floor)) * 100))),
    }


def build_user_profile(username):
    username = str(username or '').strip()
    if not username:
        return None
    if not get_user_exists(username):
        return None
    profiles = get_user_profile_map([username])
    profile = profiles.get(username)
    if not profile:
        return None
    wins = get_user_wins_map([username]).get(username, 0)
    achievements = build_achievement_summary(username)
    level_info = build_player_level(username, achievements)
    title_options = build_title_options(achievements)
    selected = profile.get('displayTitle') or '新手挑戰者'
    if selected not in {opt['id'] for opt in title_options}:
        selected = '新手挑戰者'
    return {
        'username': username,
        'avatar': profile.get('avatar') or '',
        'displayTitle': selected,
        'language': normalize_profile_language(profile.get('language')),
        'county': normalize_profile_county(profile.get('county')),
        'wins': int(wins or 0),
        'level': level_info,
        'achievements': achievements,
        'titleOptions': title_options,
    }


def update_user_profile(username, avatar=None, display_title=None, preferred_language=None, county=None):
    username = str(username or '').strip()
    if not username or not get_user_exists(username):
        raise ValueError('找不到使用者')
    profile = build_user_profile(username)
    current_title = profile.get('displayTitle') if profile else '新手挑戰者'
    current_language = profile.get('language') if profile else 'zh'
    current_avatar = profile.get('avatar') if profile else ''
    current_county = profile.get('county') if profile else ''

    next_avatar = current_avatar if avatar is None else clean_avatar_data(avatar)
    title_options = build_title_options(build_achievement_summary(username))
    allowed_titles = {opt['id'] for opt in title_options}
    next_title = str(display_title or current_title or '新手挑戰者').strip()
    if next_title not in allowed_titles:
        next_title = '新手挑戰者'
    next_language = normalize_profile_language(preferred_language if preferred_language is not None else current_language)
    next_county = normalize_profile_county(county if county is not None else current_county)

    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    UPDATE users
                    SET avatar=%s, display_title=%s, preferred_language=%s, county=%s
                    WHERE username=%s
                ''', (next_avatar, next_title, next_language, next_county, username))
            conn.commit()
    else:
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.execute('''
                UPDATE users
                SET avatar=?, display_title=?, preferred_language=?, county=?
                WHERE username=?
            ''', (next_avatar, next_title, next_language, next_county, username))
            conn.commit()
    return build_user_profile(username)


ACHIEVEMENTS = [
    {'id': 'welcome', 'title': '冒險起步者', 'description': '完成註冊並登入 QuizArena。', 'icon': 'fa-seedling', 'metric': 'registered', 'target': 1},
    {'id': 'first_friend', 'title': '好友同行', 'description': '成功加入 1 位好友。', 'icon': 'fa-user-group', 'metric': 'friends', 'target': 1},
    {'id': 'three_friends', 'title': '三人同行', 'description': '成功加入 3 位好友。', 'icon': 'fa-users', 'metric': 'friends', 'target': 3},
    {'id': 'party_builder', 'title': '派對召集人', 'description': '成功加入 5 位好友。', 'icon': 'fa-champagne-glasses', 'metric': 'friends', 'target': 5},
    {'id': 'social_master', 'title': '社交達人', 'description': '成功加入 10 位好友。', 'icon': 'fa-people-arrows', 'metric': 'friends', 'target': 10},
    {'id': 'wrong_collector', 'title': '錯題蒐集家', 'description': '累積 1 題錯題，開始複習弱點。', 'icon': 'fa-book-open-reader', 'metric': 'wrong_items', 'target': 1},
    {'id': 'wrong_reviewer', 'title': '錯題獵手', 'description': '累積 5 題錯題，建立自己的複習清單。', 'icon': 'fa-magnifying-glass-chart', 'metric': 'wrong_items', 'target': 5},
    {'id': 'bank_maker', 'title': '題庫大師', 'description': '建立 3 份自己的題庫。', 'icon': 'fa-file-pen', 'metric': 'quiz_banks', 'target': 3},
    {'id': 'question_builder', 'title': '知識建築師', 'description': '累積建立 20 題題目。', 'icon': 'fa-layer-group', 'metric': 'questions', 'target': 20},
    {'id': 'first_win', 'title': '首勝新秀', 'description': '拿下第 1 場勝利。', 'icon': 'fa-trophy', 'metric': 'wins', 'target': 1},
    {'id': 'triple_win', 'title': '三連佳績', 'description': '累積 3 場勝利。', 'icon': 'fa-medal', 'metric': 'wins', 'target': 3},
    {'id': 'steady_winner', 'title': '常勝旅人', 'description': '累積 10 場勝利。', 'icon': 'fa-route', 'metric': 'wins', 'target': 10},
    {'id': 'arena_star', 'title': '競技場之星', 'description': '累積 25 場勝利。', 'icon': 'fa-crown', 'metric': 'wins', 'target': 25},
    {'id': 'legend_winner', 'title': '傳說冠軍', 'description': '累積 50 場勝利。', 'icon': 'fa-gem', 'metric': 'wins', 'target': 50},
    {'id': 'lightning_master', 'title': '閃電戰神', 'description': '累積 100 場勝利，成為競技場傳說。', 'icon': 'fa-bolt', 'metric': 'wins', 'target': 100},
]


def build_achievement_summary(username):
    username = str(username or '').strip()
    if not username:
        return {'username': '', 'unlockedCount': 0, 'totalCount': len(ACHIEVEMENTS), 'achievements': []}

    friends = get_friend_usernames(username)
    wins = get_user_wins_map([username]).get(username, 0)
    try:
        wrong_book = build_wrong_book_detail(username)
    except Exception:
        wrong_book = {'items': [], 'totalWrongCount': 0}
    try:
        banks = [bank for bank in load_quiz_banks_for_user(username) if not (bank.get('readonly') or bank.get('isSystem') or bank.get('isWrongBook'))]
    except Exception:
        banks = []
    question_count = sum(len(bank.get('questions') or []) for bank in banks)
    metrics = {
        'registered': 1 if get_user_exists(username) else 0,
        'friends': len(friends),
        'wins': wins,
        'wrong_items': len(wrong_book.get('items') or []),
        'wrong_total': wrong_book.get('totalWrongCount') or 0,
        'quiz_banks': len(banks),
        'questions': question_count,
    }

    achievements = []
    for achievement in ACHIEVEMENTS:
        current = int(metrics.get(achievement['metric'], 0) or 0)
        target = int(achievement['target'] or 1)
        unlocked = current >= target
        achievements.append({
            **achievement,
            'current': min(current, target),
            'rawCurrent': current,
            'progress': 100 if unlocked else int((current / max(target, 1)) * 100),
            'unlocked': unlocked,
        })

    return {
        'username': username,
        'unlockedCount': sum(1 for item in achievements if item['unlocked']),
        'totalCount': len(achievements),
        'achievements': achievements,
    }


def build_friends_overview(username):
    if not username:
        return {'currentUser': '', 'friends': [], 'records': []}
    friend_names = get_friend_usernames(username)
    names = [username] + [name for name in friend_names if name != username]
    wins_map = get_user_wins_map(names)
    profile_map = get_user_profile_map(names)
    records = [{
        'username': name,
        'wins': wins_map.get(name, 0),
        'avatar': (profile_map.get(name) or {}).get('avatar', ''),
        'displayTitle': (profile_map.get(name) or {}).get('displayTitle', '新手挑戰者'),
    } for name in names]
    records.sort(key=lambda item: (-item['wins'], item['username'].lower()))
    return {
        'currentUser': username,
        'friends': friend_names,
        'records': records,
        'hasWins': any(item['wins'] > 0 for item in records),
    }


def get_co_played_usernames(username):
    username = str(username or '').strip()
    if not username:
        return set()
    username_key = username.lower()
    played = set()
    with closing(get_conn()) as conn:
        pins = [row.get('room_pin') for row in conn.execute(
            'SELECT DISTINCT room_pin FROM room_results WHERE LOWER(player_name)=LOWER(?)', (username,)
        ).fetchall()]
        if pins:
            placeholders = ','.join(['?'] * len(pins))
            played.update(str(row.get('player_name') or '').strip() for row in conn.execute(
                f'SELECT DISTINCT player_name FROM room_results WHERE room_pin IN ({placeholders})', pins
            ).fetchall())
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT report_json FROM teacher_report_history ORDER BY saved_at DESC LIMIT 120')
                history_rows = cur.fetchall()
    else:
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.row_factory = dict_factory
            history_rows = conn.execute('SELECT report_json FROM teacher_report_history ORDER BY saved_at DESC LIMIT 120').fetchall()

    for row in history_rows:
        try:
            report = row.get('report_json')
            if isinstance(report, str):
                report = json.loads(report)
            names = {str(item.get('playerName') or '').strip() for item in (report or {}).get('results', [])}
        except Exception:
            names = set()
        if any(name.lower() == username_key for name in names):
            played.update(names)
    played = {name for name in played if name and name.lower() != username_key}
    return played


def build_friend_recommendations(username):
    username = str(username or '').strip()
    if not username or not get_user_exists(username):
        return []
    friends = {name.lower() for name in get_friend_usernames(username)}
    co_played = get_co_played_usernames(username)
    current_profile = get_user_profile_map([username]).get(username) or {}
    my_county = current_profile.get('county') or ''
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT username, avatar, display_title, preferred_language, county
                    FROM users
                    WHERE LOWER(username) != LOWER(%s)
                ''', (username,))
                rows = cur.fetchall()
    else:
        with closing(get_conn(USERS_DB_PATH)) as conn:
            rows = conn.execute('''
                SELECT username, avatar, display_title, preferred_language, county
                FROM users
                WHERE LOWER(username) != LOWER(?)
            ''', (username,)).fetchall()

    recommendations = []
    for row in rows:
        candidate = str(row.get('username') or '').strip()
        if not candidate or candidate.lower() in friends:
            continue
        if get_pending_friend_request_between(username, candidate):
            continue
        same_county = bool(my_county and normalize_profile_county(row.get('county')) == my_county)
        played_together = any(candidate.lower() == name.lower() for name in co_played)
        score = (60 if same_county else 0) + (45 if played_together else 0)
        if score <= 0:
            continue
        reason_parts = []
        if same_county:
            reason_parts.append(f'同縣市：{my_county}')
        if played_together:
            reason_parts.append('曾一起玩過')
        recommendations.append({
            'username': candidate,
            'avatar': row.get('avatar') or '',
            'displayTitle': row.get('display_title') or '新手挑戰者',
            'county': normalize_profile_county(row.get('county')),
            'reason': '、'.join(reason_parts),
            'score': score,
        })
    recommendations.sort(key=lambda item: (-item['score'], item['username'].lower()))
    return recommendations[:8]


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
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT id, requester, addressee, requester_device, created_at, status
                    FROM user_friend_requests
                    WHERE addressee=%s AND status='pending'
                    ORDER BY created_at DESC, id DESC
                ''', (username,))
                return cur.fetchall()
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
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT id, requester, addressee, requester_device, created_at, status
                    FROM user_friend_requests
                    WHERE status='pending'
                      AND (
                        (requester=%s AND addressee=%s)
                        OR
                        (requester=%s AND addressee=%s)
                      )
                    ORDER BY id DESC
                    LIMIT 1
                ''', (user_a, user_b, user_b, user_a))
                return cur.fetchone()
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


def record_user_win(room, winner_name, winner_score):
    ts = now_ts()
    if use_postgres_user_store():
        with closing(get_pg_conn()) as user_conn:
            with user_conn.cursor() as cur:
                cur.execute('SELECT 1 FROM user_match_history WHERE room_pin=%s LIMIT 1', (room.get('pin'),))
                if cur.fetchone():
                    return False
                cur.execute('''
                    INSERT INTO user_match_history
                    (room_pin, room_name, bank_id, bank_title, winner_username, winner_score, recorded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (
                    room.get('pin') or '',
                    room.get('room_name') or '',
                    room.get('bank_id') or '',
                    room.get('bank_title') or '',
                    winner_name,
                    int(winner_score or 0),
                    ts,
                ))
                cur.execute('''
                    INSERT INTO user_stats (username, wins, updated_at)
                    VALUES (%s, 1, %s)
                    ON CONFLICT(username) DO UPDATE SET
                        wins = user_stats.wins + 1,
                        updated_at = EXCLUDED.updated_at
                ''', (winner_name, ts))
            user_conn.commit()
        return True

    with closing(sqlite3.connect(USERS_DB_PATH)) as user_conn:
        already = user_conn.execute('SELECT 1 FROM user_match_history WHERE room_pin=? LIMIT 1', (room.get('pin'),)).fetchone()
        if already:
            return False
        user_conn.execute('''
            INSERT INTO user_match_history
            (room_pin, room_name, bank_id, bank_title, winner_username, winner_score, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            room.get('pin') or '',
            room.get('room_name') or '',
            room.get('bank_id') or '',
            room.get('bank_title') or '',
            winner_name,
            int(winner_score or 0),
            ts,
        ))
        user_conn.execute('''
            INSERT INTO user_stats (username, wins, updated_at)
            VALUES (?, 1, ?)
            ON CONFLICT(username) DO UPDATE SET
                wins = user_stats.wins + 1,
                updated_at = excluded.updated_at
        ''', (winner_name, ts))
        user_conn.commit()
    return True


def record_room_winner(conn, pin):
    room = conn.execute('SELECT pin, room_name, bank_id, bank_title, created_by FROM rooms WHERE pin=?', (pin,)).fetchone()
    if not room:
        return
    rankings = conn.execute('''
        SELECT rr.player_name, COALESCE(SUM(rr.points_earned), 0) AS total_score
        FROM room_results rr
        JOIN room_players rp ON rp.room_pin = rr.room_pin AND rp.player_name = rr.player_name
        WHERE rr.room_pin = ?
          AND COALESCE(rp.is_host, 0) = 0
          AND LOWER(rr.player_name) != LOWER(?)
        GROUP BY rr.player_name
        ORDER BY total_score DESC, rr.player_name ASC
    ''', (pin, str(room.get('created_by') or '').strip())).fetchall()
    if not rankings:
        return
    winner = rankings[0]
    winner_name = str(winner.get('player_name') or '').strip()
    if not get_user_exists(winner_name):
        return

    record_user_win(room, winner_name, int(winner.get('total_score') or 0))
    save_teacher_report_snapshot_for_pin(conn, pin)


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
    username = str(username or '').strip()
    if not username:
        return []
    if use_postgres_quiz_store():
        init_postgres_quiz_banks_db()
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    SELECT data
                    FROM quiz_banks
                    WHERE username = %s
                    ORDER BY updated_at DESC, id DESC
                ''', (username,))
                rows = cur.fetchall()
        banks = []
        for row in rows:
            raw = row.get('data')
            if isinstance(raw, str):
                raw = json.loads(raw)
            banks.append(normalize_bank(raw))
        return banks
    with _quiz_lock:
        return load_quiz_store()['users'].get(username, [])


def save_quiz_banks_for_user(username, banks):
    username = str(username or '').strip()
    mutable_banks = []
    for bank in banks if isinstance(banks, list) else []:
        if isinstance(bank, dict) and (bank.get('readonly') or bank.get('isSystem') or bank.get('isWrongBook')):
            continue
        mutable_banks.append(normalize_bank(bank))

    if use_postgres_quiz_store():
        init_postgres_quiz_banks_db()
        incoming_ids = {str(bank.get('id')) for bank in mutable_banks}
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                for bank in mutable_banks:
                    cur.execute('''
                        INSERT INTO quiz_banks (username, bank_id, title, data, updated_at)
                        VALUES (%s, %s, %s, %s::jsonb, %s)
                        ON CONFLICT(username, bank_id)
                        DO UPDATE SET
                            title = EXCLUDED.title,
                            data = EXCLUDED.data,
                            updated_at = EXCLUDED.updated_at
                    ''', (
                        username,
                        str(bank.get('id')),
                        str(bank.get('title') or '未命名題庫'),
                        json.dumps(bank, ensure_ascii=False),
                        int(bank.get('updatedAt') or now_ts()),
                    ))

                if incoming_ids:
                    cur.execute(
                        'DELETE FROM quiz_banks WHERE username = %s AND NOT (bank_id = ANY(%s))',
                        (username, list(incoming_ids))
                    )
                else:
                    cur.execute('DELETE FROM quiz_banks WHERE username = %s', (username,))
            conn.commit()
        return

    with _quiz_lock:
        data = load_quiz_store()
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
    room['room_key_plain'] = ''
    return room


def truthy_option_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'y', 'correct', '正確', '答案'}


def infer_answer_indexes(answer_json, options):
    try:
        raw = json.loads(answer_json or '[]')
    except Exception:
        raw = []
    if not isinstance(raw, list):
        raw = [raw]

    indexes = []
    for item in raw:
        try:
            indexes.append(int(item))
            continue
        except Exception:
            pass
        text = str(item or '').strip()
        if len(text) == 1 and text.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            indexes.append(ord(text.upper()) - 65)
            continue
        for idx, option in enumerate(options or []):
            option_text = str((option or {}).get('text') or '').strip() if isinstance(option, dict) else str(option or '').strip()
            if text and option_text == text:
                indexes.append(idx)

    if not indexes:
        for idx, option in enumerate(options or []):
            if not isinstance(option, dict):
                continue
            if (
                truthy_option_value(option.get('correct')) or
                truthy_option_value(option.get('isCorrect')) or
                truthy_option_value(option.get('answer'))
            ):
                indexes.append(idx)
    return sorted({idx for idx in indexes if isinstance(idx, int) and idx >= 0})


def build_teacher_report_from_conn(conn, pin):
    room = conn.execute('SELECT * FROM rooms WHERE pin=?', (pin,)).fetchone()
    if not room:
        return None
    teacher_name = str(room.get('created_by') or '').strip()
    teacher_key = teacher_name.lower()
    questions = conn.execute(
        'SELECT question_id,seq,title,content,type,options_json,answer_json,explanation FROM room_questions WHERE room_pin=? ORDER BY seq ASC',
        (pin,)
    ).fetchall()
    players = conn.execute('''
        SELECT player_name, team_id, is_host
        FROM room_players
        WHERE room_pin=? AND COALESCE(is_host, 0) = 0
          AND LOWER(player_name) != LOWER(?)
        ORDER BY team_id ASC, player_name ASC
    ''', (pin, teacher_name)).fetchall()
    results = conn.execute('''
        SELECT rr.*, rp.team_id
        FROM room_results rr
        JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
        WHERE rr.room_pin=?
          AND COALESCE(rp.is_host, 0) = 0
          AND LOWER(rr.player_name) != LOWER(?)
        ORDER BY rp.team_id ASC, rr.player_name ASC, rr.question_id ASC
    ''', (pin, teacher_name)).fetchall()

    q_order = {q['question_id']: int(q['seq'] or 0) for q in questions}
    q_titles = {q['question_id']: q['title'] or '' for q in questions}
    q_options = {}
    q_types = {}
    for q in questions:
        try:
            q_options[q['question_id']] = json.loads(q.get('options_json') or '[]')
        except Exception:
            q_options[q['question_id']] = []
        q_types[q['question_id']] = str(q.get('type') or 'single')
    per_player = {
        player['player_name']: {
            'playerName': player['player_name'],
            'teamId': int(player.get('team_id') or 0),
            'answered': 0,
            'correct': 0,
            'totalScore': 0,
        }
        for player in players
    }
    per_question = {}
    for q in questions:
        try:
            options = json.loads(q.get('options_json') or '[]')
        except Exception:
            options = []
        answer_indexes = infer_answer_indexes(q.get('answer_json'), options)
        correct_parts = []
        for idx in answer_indexes:
            label = chr(65 + idx) if isinstance(idx, int) and idx >= 0 else str(idx)
            text = ''
            if isinstance(idx, int) and 0 <= idx < len(options):
                text = str((options[idx] or {}).get('text') or '').strip()
            correct_parts.append(f'{label}. {text}' if text else label)
        per_question[q['question_id']] = {
            'questionId': q['question_id'],
            'seq': int(q['seq'] or 0),
            'title': q['title'] or '',
            'content': q['content'] or '',
            'correctAnswerText': '、'.join(correct_parts) or '無',
            'correctIndexes': answer_indexes,
            'options': [
                {
                    'label': chr(65 + idx),
                    'text': str((option or {}).get('text') or '').strip() if isinstance(option, dict) else str(option or '').strip(),
                }
                for idx, option in enumerate(options)
            ],
            'explanation': q.get('explanation') or '',
            'answered': 0,
            'correct': 0,
        }

    enriched = []
    for row in results:
        player_name = row['player_name']
        if str(player_name or '').strip().lower() == teacher_key:
            continue
        if player_name not in per_player:
            per_player[player_name] = {
                'playerName': player_name,
                'teamId': int(row.get('team_id') or 0),
                'answered': 0,
                'correct': 0,
                'totalScore': 0,
            }
        is_correct = bool(row.get('is_correct'))
        points = int(row.get('points_earned') or 0)
        per_player[player_name]['answered'] += 1
        per_player[player_name]['correct'] += 1 if is_correct else 0
        per_player[player_name]['totalScore'] += points
        if row['question_id'] in per_question:
            per_question[row['question_id']]['answered'] += 1
            per_question[row['question_id']]['correct'] += 1 if is_correct else 0
        try:
            selected_indexes = json.loads(row.get('selected_json') or '[]')
        except Exception:
            selected_indexes = []
        if not isinstance(selected_indexes, list):
            selected_indexes = []
        selected_parts = []
        options = q_options.get(row['question_id']) or []
        for idx in selected_indexes:
            try:
                idx = int(idx)
            except Exception:
                continue
            label = chr(65 + idx) if idx >= 0 else str(idx)
            text = ''
            if 0 <= idx < len(options):
                text = str((options[idx] or {}).get('text') or '').strip()
            selected_parts.append(f'{label}. {text}' if text else label)
        selected_text = '、'.join(selected_parts) if selected_parts else ('未選擇' if q_types.get(row['question_id']) != 'fill' else '填答內容未保存')
        if is_correct and row['question_id'] in per_question and per_question[row['question_id']].get('correctAnswerText') in {'', '-', '無'}:
            per_question[row['question_id']]['correctAnswerText'] = selected_text
        enriched.append({
            'playerName': player_name,
            'teamId': int(row.get('team_id') or 0),
            'questionId': row['question_id'],
            'seq': q_order.get(row['question_id'], 0),
            'title': q_titles.get(row['question_id'], ''),
            'selectedIndexes': selected_indexes,
            'selectedAnswerText': selected_text,
            'isCorrect': is_correct,
            'pointsEarned': points,
            'answerOrder': int(row.get('answer_order') or 0),
        })

    player_summaries = sorted(per_player.values(), key=lambda item: (-item['totalScore'], item['playerName'].lower()))
    for item in player_summaries:
        item['accuracy'] = round((item['correct'] / item['answered']) * 100, 1) if item['answered'] else 0
    question_stats = sorted(per_question.values(), key=lambda item: item['seq'])
    for item in question_stats:
        item['accuracy'] = round((item['correct'] / item['answered']) * 100, 1) if item['answered'] else 0

    return {
        'room': {
            'pin': room.get('pin'),
            'roomName': room.get('room_name') or '',
            'bankTitle': room.get('bank_title') or '',
            'createdBy': room.get('created_by') or '',
            'status': room.get('status') or '',
            'createdAt': int(room.get('created_at') or 0),
        },
        'questions': question_stats,
        'players': player_summaries,
        'results': enriched,
    }


def save_teacher_report_snapshot(report):
    if not report or not report.get('room'):
        return
    room = report['room']
    pin = str(room.get('pin') or '').strip()
    if not pin:
        return
    created_by = str(room.get('createdBy') or '').strip()
    saved_at = now_ts()
    payload = json.dumps(report, ensure_ascii=False)
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    INSERT INTO teacher_report_history
                    (pin, room_name, bank_title, created_by, report_json, created_at, saved_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
                    ON CONFLICT(pin) DO UPDATE SET
                        room_name=EXCLUDED.room_name,
                        bank_title=EXCLUDED.bank_title,
                        created_by=EXCLUDED.created_by,
                        report_json=EXCLUDED.report_json,
                        saved_at=EXCLUDED.saved_at
                ''', (
                    pin,
                    room.get('roomName') or '',
                    room.get('bankTitle') or '',
                    created_by,
                    payload,
                    int(room.get('createdAt') or saved_at),
                    saved_at,
                ))
            conn.commit()
        return
    with closing(sqlite3.connect(USERS_DB_PATH)) as history_conn:
        history_conn.execute('''
            INSERT INTO teacher_report_history
            (pin, room_name, bank_title, created_by, report_json, created_at, saved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pin) DO UPDATE SET
                room_name=excluded.room_name,
                bank_title=excluded.bank_title,
                created_by=excluded.created_by,
                report_json=excluded.report_json,
                saved_at=excluded.saved_at
        ''', (
            pin,
            room.get('roomName') or '',
            room.get('bankTitle') or '',
            created_by,
            payload,
            int(room.get('createdAt') or saved_at),
            saved_at,
        ))
        history_conn.commit()


def save_teacher_report_snapshot_for_pin(conn, pin):
    report = build_teacher_report_from_conn(conn, pin)
    if report and (report.get('players') or report.get('results')):
        save_teacher_report_snapshot(report)


def load_teacher_report_snapshot(pin):
    pin = str(pin or '').strip()
    if not pin:
        return None
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT report_json, saved_at FROM teacher_report_history WHERE pin=%s LIMIT 1', (pin,))
                row = cur.fetchone()
        if not row:
            return None
        report = row.get('report_json')
        if isinstance(report, str):
            report = json.loads(report)
        report['fromHistory'] = True
        report['savedAt'] = int(row.get('saved_at') or 0)
        return report
    with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
        conn.row_factory = dict_factory
        row = conn.execute('SELECT report_json, saved_at FROM teacher_report_history WHERE pin=? LIMIT 1', (pin,)).fetchone()
    if not row:
        return None
    report = json.loads(row.get('report_json') or '{}')
    report['fromHistory'] = True
    report['savedAt'] = int(row.get('saved_at') or 0)
    return report


def list_teacher_report_history(username=''):
    username = str(username or '').strip()
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                if username:
                    cur.execute('''
                        SELECT pin, room_name, bank_title, created_by, created_at, saved_at
                        FROM teacher_report_history
                        WHERE created_by=%s
                        ORDER BY saved_at DESC, id DESC
                        LIMIT 50
                    ''', (username,))
                else:
                    cur.execute('''
                        SELECT pin, room_name, bank_title, created_by, created_at, saved_at
                        FROM teacher_report_history
                        ORDER BY saved_at DESC, id DESC
                        LIMIT 50
                    ''')
                rows = cur.fetchall()
    else:
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.row_factory = dict_factory
            if username:
                rows = conn.execute('''
                    SELECT pin, room_name, bank_title, created_by, created_at, saved_at
                    FROM teacher_report_history
                    WHERE created_by=?
                    ORDER BY saved_at DESC, id DESC
                    LIMIT 50
                ''', (username,)).fetchall()
            else:
                rows = conn.execute('''
                    SELECT pin, room_name, bank_title, created_by, created_at, saved_at
                    FROM teacher_report_history
                    ORDER BY saved_at DESC, id DESC
                    LIMIT 50
                ''').fetchall()
    return [{
        'pin': row.get('pin') or '',
        'roomName': row.get('room_name') or '',
        'bankTitle': row.get('bank_title') or '',
        'createdBy': row.get('created_by') or '',
        'createdAt': int(row.get('created_at') or 0),
        'savedAt': int(row.get('saved_at') or 0),
        'savedAtText': time.strftime('%Y-%m-%d %H:%M', time.localtime(int(row.get('saved_at') or now_ts()))),
    } for row in rows]


def build_business_dashboard_summary():
    if use_postgres_user_store():
        with closing(get_pg_conn()) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) AS total FROM users')
                user_count = int((cur.fetchone() or {}).get('total') or 0)
                cur.execute('SELECT COUNT(*) AS total, COALESCE(SUM(wins), 0) AS wins FROM user_stats')
                stats_row = cur.fetchone() or {}
                cur.execute('''
                    SELECT pin, room_name, bank_title, created_by, report_json, saved_at
                    FROM teacher_report_history
                    ORDER BY saved_at DESC, id DESC
                    LIMIT 30
                ''')
                report_rows = cur.fetchall()
    else:
        with closing(sqlite3.connect(USERS_DB_PATH)) as conn:
            conn.row_factory = dict_factory
            user_count = int((conn.execute('SELECT COUNT(*) AS total FROM users').fetchone() or {}).get('total') or 0)
            stats_row = conn.execute('SELECT COUNT(*) AS total, COALESCE(SUM(wins), 0) AS wins FROM user_stats').fetchone() or {}
            report_rows = conn.execute('''
                SELECT pin, room_name, bank_title, created_by, report_json, saved_at
                FROM teacher_report_history
                ORDER BY saved_at DESC, id DESC
                LIMIT 30
            ''').fetchall()

    total_reports = len(report_rows)
    total_students = 0
    accuracy_values = []
    recent_reports = []
    for row in report_rows:
        report = row.get('report_json')
        if isinstance(report, str):
            try:
                report = json.loads(report)
            except Exception:
                report = {}
        players = report.get('players') if isinstance(report, dict) else []
        players = players if isinstance(players, list) else []
        total_students += len(players)
        for player in players:
            accuracy_values.append(float(player.get('accuracy') or 0))
        saved_at = int(row.get('saved_at') or 0)
        recent_reports.append({
            'pin': row.get('pin') or '',
            'roomName': row.get('room_name') or '',
            'bankTitle': row.get('bank_title') or '',
            'createdBy': row.get('created_by') or '',
            'savedAt': saved_at,
            'savedAtText': time.strftime('%Y-%m-%d %H:%M', time.localtime(saved_at or now_ts())),
            'studentCount': len(players),
        })

    avg_accuracy = round(sum(accuracy_values) / len(accuracy_values), 1) if accuracy_values else 0
    return {
        'userCount': user_count,
        'trackedPlayers': int(stats_row.get('total') or 0),
        'totalWins': int(stats_row.get('wins') or 0),
        'reportCount': total_reports,
        'studentParticipations': total_students,
        'averageAccuracy': avg_accuracy,
        'recentReports': recent_reports,
    }


def delete_room_fully(conn, pin):
    save_teacher_report_snapshot_for_pin(conn, pin)
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


def init_postgres_users_db():
    if not use_postgres_user_store():
        return
    with closing(get_pg_conn()) as conn:
        with conn.cursor() as c:
            c.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
                )
            ''')
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT ''")
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_title TEXT DEFAULT '新手挑戰者'")
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'zh'")
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS county TEXT DEFAULT ''")
            c.execute('''
                CREATE TABLE IF NOT EXISTS user_friendships (
                    id SERIAL PRIMARY KEY,
                    requester TEXT NOT NULL,
                    addressee TEXT NOT NULL,
                    status TEXT DEFAULT 'accepted',
                    created_at BIGINT,
                    UNIQUE(requester, addressee)
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS wrong_question_book (
                    id SERIAL PRIMARY KEY,
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
                    last_wrong_at BIGINT,
                    created_at BIGINT,
                    UNIQUE(username, source_bank_id, question_id)
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS user_friend_requests (
                    id SERIAL PRIMARY KEY,
                    requester TEXT NOT NULL,
                    addressee TEXT NOT NULL,
                    requester_device TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at BIGINT,
                    responded_at BIGINT
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS user_stats (
                    username TEXT PRIMARY KEY,
                    wins INTEGER DEFAULT 0,
                    updated_at BIGINT
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS user_match_history (
                    id SERIAL PRIMARY KEY,
                    room_pin TEXT UNIQUE,
                    room_name TEXT,
                    bank_id TEXT,
                    bank_title TEXT,
                    winner_username TEXT,
                    winner_score INTEGER DEFAULT 0,
                    recorded_at BIGINT
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS teacher_report_history (
                    id SERIAL PRIMARY KEY,
                    pin TEXT UNIQUE NOT NULL,
                    room_name TEXT,
                    bank_title TEXT,
                    created_by TEXT,
                    report_json JSONB NOT NULL,
                    created_at BIGINT,
                    saved_at BIGINT
                )
            ''')
            c.execute('CREATE INDEX IF NOT EXISTS idx_teacher_report_history_created_by ON teacher_report_history(created_by)')
        conn.commit()


def init_users_db():
    if use_postgres_user_store():
        init_postgres_users_db()
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
        for col, typ in [
            ('avatar', "TEXT DEFAULT ''"),
            ('display_title', "TEXT DEFAULT '新手挑戰者'"),
            ('preferred_language', "TEXT DEFAULT 'zh'"),
            ('county', "TEXT DEFAULT ''"),
        ]:
            if col not in existing:
                c.execute(f'ALTER TABLE users ADD COLUMN {col} {typ}')
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
        c.execute('''
            CREATE TABLE IF NOT EXISTS teacher_report_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pin TEXT UNIQUE NOT NULL,
                room_name TEXT,
                bank_title TEXT,
                created_by TEXT,
                report_json TEXT NOT NULL,
                created_at INTEGER,
                saved_at INTEGER
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
            'team_play_mode': 'TEXT DEFAULT "classic"',
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

        conn.commit()


ensure_data_store()
init_users_db()
init_rooms_db()
init_postgres_quiz_banks_db()
ensure_file(QUIZ_BANKS_PATH, {'users': {}})


@app.route('/')
def home():
    return send_from_directory(PROJECT_DIR, 'index.html')


for page in ['create_home.html', 'player_join.html', 'waiting_room.html',
             'house_waiting_room.html', 'quiz_game.html', 'wrong_book.html',
             'teacher_report.html', 'business_dashboard.html', 'profile.html']:
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
        if use_postgres_user_store():
            with closing(get_pg_conn()) as conn:
                with conn.cursor() as cur:
                    cur.execute('SELECT username, email FROM users WHERE username=%s OR email=%s LIMIT 1', (username, email))
                    existing = cur.fetchone()
                    if existing:
                        msg = '帳號已存在' if existing.get('username') == username else 'Email 已存在'
                        return jsonify(success=False, message=msg), 400
                    cur.execute(
                        'INSERT INTO users (username, email, password) VALUES (%s, %s, %s)',
                        (username, email, hash_text(password))
                    )
                conn.commit()
            return jsonify(success=True, message='註冊成功')
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
        return jsonify(success=False, message=f'註冊失敗：{e}'), 500


@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        password = str(data.get('password', '')).strip()
        if use_postgres_user_store():
            with closing(get_pg_conn()) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'SELECT username, email, avatar, display_title, preferred_language, county FROM users WHERE username = %s AND password = %s',
                        (username, hash_text(password))
                    )
                    user = cur.fetchone()
            if not user:
                return jsonify(success=False, message='帳號或密碼錯誤'), 401
            return jsonify(success=True, username=user['username'], email=user['email'],
                           avatar=user.get('avatar') or '',
                           displayTitle=user.get('display_title') or '新手挑戰者',
                           language=normalize_profile_language(user.get('preferred_language')),
                           county=normalize_profile_county(user.get('county')),
                           message='登入成功')
        with closing(get_conn(USERS_DB_PATH)) as conn:
            user = conn.execute(
                'SELECT username, email, avatar, display_title, preferred_language, county FROM users WHERE username = ? AND password = ?',
                (username, hash_text(password))
            ).fetchone()
        if not user:
            return jsonify(success=False, message='帳號或密碼錯誤'), 401
        return jsonify(success=True, username=user['username'], email=user['email'],
                       avatar=user.get('avatar') or '',
                       displayTitle=user.get('display_title') or '新手挑戰者',
                       language=normalize_profile_language(user.get('preferred_language')),
                       county=normalize_profile_county(user.get('county')),
                       message='登入成功')
    except Exception as e:
        return jsonify(success=False, message=f'登入失敗：{e}'), 500


@app.route('/user_profile')
def user_profile_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    profile = build_user_profile(username)
    if not profile:
        return jsonify(success=False, message='找不到使用者'), 404
    return jsonify(success=True, profile=profile)


@app.route('/update_user_profile', methods=['POST'])
def update_user_profile_api():
    try:
        data = request.get_json() or {}
        username = str(data.get('username', '')).strip()
        profile = update_user_profile(
            username,
            avatar=data.get('avatar') if 'avatar' in data else None,
            display_title=data.get('displayTitle') if 'displayTitle' in data else None,
            preferred_language=data.get('language') if 'language' in data else None,
            county=data.get('county') if 'county' in data else None,
        )
        return jsonify(success=True, profile=profile, message='個人資料已更新')
    except ValueError as e:
        return jsonify(success=False, message=str(e)), 400
    except Exception as e:
        return jsonify(success=False, message=f'更新個人資料失敗：{e}'), 500


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
        language = normalize_language(data.get('language'))
        requested_count = int(data.get('count', 5) or 5)
        count = max(1, min(requested_count, 20))
        source_mode = str(data.get('sourceMode', 'ai')).strip()
        api_key = str(data.get('apiKey', '')).strip()
        if data.get('storyMode'):
            topic = f'{topic}，請每題完全不同，題目概念不可重複，並在解析中加入一小段不同的劇情線索'
        bank = generate_ai_quiz_bank(topic, category, difficulty, count, source_mode=source_mode, api_key_override=api_key, language=language)
        return jsonify(success=True, quizBank=bank)
    except Exception as e:
        return jsonify(success=False, message=f'AI 題庫生成失敗：{e}'), 500


@app.route('/translate_texts', methods=['POST'])
def translate_texts_api():
    data = request.get_json() or {}
    target_lang = normalize_language(data.get('targetLang'))
    texts = data.get('texts', [])
    if not isinstance(texts, list):
        return jsonify(success=False, message='翻譯文字格式錯誤'), 400
    translations = translate_texts_with_ai(texts, target_lang)
    return jsonify(success=True, translations=translations)


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


@app.route('/friend_recommendations')
def friend_recommendations_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(success=True, recommendations=build_friend_recommendations(username))


@app.route('/achievements_summary')
def achievements_summary_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(success=True, **build_achievement_summary(username))


@app.route('/wrong_book_summary')
def wrong_book_summary_api():
    username = str(request.args.get('username', '')).strip()
    if not username:
        return jsonify(success=False, message='缺少使用者帳號'), 400
    return jsonify(success=True, **build_wrong_book_detail(username))


@app.route('/ai_tutor', methods=['POST'])
def ai_tutor_api():
    data = request.get_json() or {}
    question = str(data.get('question') or '').strip()
    selected = str(data.get('selected') or '').strip()
    correct = str(data.get('correct') or '').strip()
    explanation = str(data.get('explanation') or '').strip()
    target_lang = normalize_language(data.get('language'))
    fallback = (
        f'家教提示：先找題目關鍵字，再比較你的選擇與正解。\n'
        f'你的答案：{selected or "尚未作答"}\n'
        f'正解：{correct or "請看綠色選項"}\n'
        f'解析：{explanation or "這題可以從定義、條件、排除錯誤選項三步驟重新理解。"}'
    )
    hf_api_key = os.environ.get('HF_API_KEY', '').strip()
    if not hf_api_key or requests is None:
        return jsonify(success=True, tutor=fallback)
    try:
        prompt = (
            f'你是 QuizArena 的溫柔 AI 家教，請用 {language_name(target_lang)} 回答。\n'
            '請針對學生答錯的題目，用 3 個短段落教學：1 關鍵概念 2 為什麼錯 3 下次怎麼判斷。\n'
            f'題目：{question}\n學生選擇：{selected}\n正解：{correct}\n原解析：{explanation}'
        )
        response = requests.post(
            HF_API_URL,
            headers={'Authorization': f'Bearer {hf_api_key}', 'Content-Type': 'application/json'},
            json={'model': HF_MODEL, 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 900, 'temperature': 0.35},
            timeout=35
        )
        if response.status_code != 200:
            return jsonify(success=True, tutor=fallback)
        content = response.json().get('choices', [{}])[0].get('message', {}).get('content', '').strip()
        return jsonify(success=True, tutor=content or fallback)
    except Exception:
        return jsonify(success=True, tutor=fallback)


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
        if use_postgres_user_store():
            with closing(get_pg_conn()) as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT 1 FROM user_friendships
                        WHERE requester=%s AND addressee=%s AND status='accepted'
                        LIMIT 1
                    ''', (a, b))
                    if cur.fetchone():
                        return jsonify(success=False, message='你們已經是好友了'), 400

                    cur.execute('''
                        SELECT id, requester, addressee
                        FROM user_friend_requests
                        WHERE status='pending'
                          AND (
                            (requester=%s AND addressee=%s)
                            OR
                            (requester=%s AND addressee=%s)
                          )
                        ORDER BY id DESC
                        LIMIT 1
                    ''', (username, friend_name, friend_name, username))
                    pending = cur.fetchone()
                    if pending:
                        if str(pending.get('requester') or '') == friend_name and str(pending.get('addressee') or '') == username:
                            return jsonify(success=False, message='對方已向你送出申請，請到好友申請接受'), 400
                        return jsonify(success=False, message='好友申請已送出，請等待對方回應'), 400

                    cur.execute('''
                        INSERT INTO user_friend_requests
                        (requester, addressee, requester_device, status, created_at)
                        VALUES (%s, %s, %s, 'pending', %s)
                    ''', (username, friend_name, describe_client_device(request.user_agent.string), now_ts()))
                conn.commit()
            summary = build_friend_request_summary(friend_name)
            return jsonify(success=True, message='好友申請已送出', **summary)

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

        if use_postgres_user_store():
            with closing(get_pg_conn()) as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT id, requester, addressee, status
                        FROM user_friend_requests
                        WHERE id=%s AND addressee=%s
                        LIMIT 1
                    ''', (request_id, username))
                    row = cur.fetchone()
                    if not row:
                        return jsonify(success=False, message='找不到這筆好友申請'), 404
                    if str(row.get('status') or '') != 'pending':
                        return jsonify(success=False, message='這筆申請已處理過'), 400

                    cur.execute('''
                        UPDATE user_friend_requests
                        SET status=%s, responded_at=%s
                        WHERE id=%s
                    ''', ('accepted' if action == 'accept' else 'rejected', now_ts(), request_id))

                    if action == 'accept':
                        a, b = sorted([str(row.get('requester') or '').strip(), username], key=lambda item: item.lower())
                        cur.execute('''
                            INSERT INTO user_friendships (requester, addressee, status, created_at)
                            VALUES (%s, %s, 'accepted', %s)
                            ON CONFLICT(requester, addressee) DO NOTHING
                        ''', (a, b, now_ts()))
                conn.commit()

            return jsonify(
                success=True,
                message='已接受好友申請' if action == 'accept' else '已忽略好友申請',
                overview=build_friends_overview(username),
                requestSummary=build_friend_request_summary(username)
            )

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
        team_play_mode = str(data.get('teamPlayMode', 'classic')).strip().lower()
        if team_play_mode not in {'classic', 'free_assign'}:
            team_play_mode = 'classic'
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
                 status,max_players,team_mode,team_count,team_size,team_play_mode,allow_lobby_join,
                 current_question_index,game_start_ts,created_at)
                VALUES (?,?,?,?,?,?,?,?,'waiting',?,?,?,?,?,?,0,0,?)
                ''', (pin, room_name, bank_id, bank_title, created_by, is_private,
                  hash_text(room_key) if is_private else '',
                   '', max_players,
                  team_mode, team_count, team_size, team_play_mode, allow_lobby_join, now_ts()))

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
        safe_message = html.escape(message)
        with closing(sqlite3.connect(ROOMS_DB_PATH)) as conn:
            conn.execute('''
                INSERT INTO room_messages
                (room_pin,sender_name,message,face,hair,eyes,eyes_offset_y,team_id,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
            ''', (pin, sender_name, safe_message, avatar['face'], avatar['hair'],
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
            team_play_mode = str(room.get('team_play_mode') or 'classic').strip().lower()
            if team_play_mode not in {'classic', 'free_assign'}:
                team_play_mode = 'classic'
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
                  AND COALESCE(is_host, 0) = 0
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
                if team_play_mode == 'free_assign':
                    team_sub_map = {x['question_id']: x for x in conn.execute('''
                        SELECT rr.question_id, rr.player_name, rr.is_correct, rr.points_earned
                        FROM room_results rr
                        JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                        WHERE rr.room_pin=? AND rp.team_id=?
                    ''', (pin, my_team_id)).fetchall()}
                    for q in questions:
                        if q['question_id'] not in team_sub_map:
                            current_q = q
                            break
                    if current_q is None and questions:
                        current_q = questions[0]
                    teams = conn.execute(
                        'SELECT team_id FROM room_teams WHERE room_pin=? ORDER BY team_id ASC', (pin,)
                    ).fetchall()
                    all_done = True if teams and total_questions > 0 else False
                    for t in teams:
                        done_count = conn.execute('''
                            SELECT COUNT(*) AS c
                            FROM room_questions q
                            WHERE q.room_pin=?
                              AND EXISTS(
                                  SELECT 1
                                  FROM room_results rr
                                  JOIN room_players rp
                                    ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                                  WHERE rr.room_pin=q.room_pin
                                    AND rr.question_id=q.question_id
                                    AND rp.team_id=?
                              )
                        ''', (pin, int(t.get('team_id') or 0))).fetchone()['c']
                        if done_count < total_questions:
                            all_done = False
                            break
                    if all_done and room.get('status') != 'closed':
                        conn.execute("UPDATE rooms SET status='closed' WHERE pin=?", (pin,))
                        room['status'] = 'closed'
                    finished = room.get('status') == 'closed'
                else:
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
                  AND COALESCE(rp.is_host, 0) = 0
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
                        WHERE rr.room_pin=? AND rp.team_id=? AND COALESCE(rp.is_host, 0) = 0
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
                      AND COALESCE(rp.is_host, 0) = 0
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

            if current_q and is_team_mode:
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
            isTeamMode=is_team_mode,
            teamPlayMode=team_play_mode
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
            team_play_mode = str(room.get('team_play_mode') or 'classic').strip().lower()
            if team_play_mode not in {'classic', 'free_assign'}:
                team_play_mode = 'classic'
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
                if is_team_mode and team_play_mode == 'free_assign':
                    answer_order = 1
                    points = int(q.get('score') or 1000)
                else:
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
                WHERE rr.room_pin=? AND rp.is_eliminated=0 AND COALESCE(rp.is_host, 0) = 0
                  AND LOWER(rr.player_name) != LOWER(?)
                GROUP BY rr.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                ORDER BY total_score DESC,rr.player_name ASC LIMIT 5
            ''', (pin, str(room.get('created_by') or '').strip())).fetchall()
            all_rank = conn.execute('''
                SELECT rr.player_name,
                       COALESCE(SUM(rr.points_earned),0) AS total_score,
                       rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                FROM room_results rr
                JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name
                WHERE rr.room_pin=? AND rp.is_eliminated=0 AND COALESCE(rp.is_host, 0) = 0
                  AND LOWER(rr.player_name) != LOWER(?)
                GROUP BY rr.player_name, rp.face, rp.hair, rp.eyes, rp.eyes_offset_y
                ORDER BY total_score DESC,rr.player_name ASC
            ''', (pin, str(room.get('created_by') or '').strip())).fetchall()
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
            room = conn.execute('SELECT created_by FROM rooms WHERE pin=?', (pin,)).fetchone() or {}
            teacher_name = str(room.get('created_by') or '').strip()
            questions = conn.execute(
                'SELECT question_id,seq,title FROM room_questions WHERE room_pin=? ORDER BY seq ASC', (pin,)
            ).fetchall()
            results = conn.execute(
                'SELECT rr.*,rp.team_id FROM room_results rr JOIN room_players rp ON rp.room_pin=rr.room_pin AND rp.player_name=rr.player_name WHERE rr.room_pin=? AND COALESCE(rp.is_host, 0) = 0 AND LOWER(rr.player_name) != LOWER(?) ORDER BY rp.team_id ASC,rr.player_name ASC',
                (pin, teacher_name)
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


@app.route('/teacher_report')
def teacher_report_api():
    try:
        pin = request.args.get('pin', '').strip()
        if not pin:
            return jsonify(success=False, message='缺少 PIN'), 400
        with closing(get_conn()) as conn:
            live_report = build_teacher_report_from_conn(conn, pin)
        if live_report:
            live_report['success'] = True
            live_report['fromHistory'] = False
            return jsonify(live_report)

        saved_report = load_teacher_report_snapshot(pin)
        if not saved_report:
            return jsonify(success=False, message='找不到這個房間或歷史報表'), 404
        saved_report['success'] = True
        return jsonify(saved_report)
    except Exception as e:
        return jsonify(success=False, message=f'讀取老師報表失敗：{e}'), 500


@app.route('/teacher_report_history')
def teacher_report_history_api():
    try:
        username = request.args.get('username', '').strip()
        return jsonify(success=True, reports=list_teacher_report_history(username))
    except Exception as e:
        return jsonify(success=False, message=f'讀取建房紀錄失敗：{e}'), 500


@app.route('/business_dashboard_summary')
def business_dashboard_summary_api():
    try:
        return jsonify(success=True, **build_business_dashboard_summary())
    except Exception as e:
        return jsonify(success=False, message=f'讀取營運後台失敗：{e}'), 500


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(PROJECT_DIR, filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
