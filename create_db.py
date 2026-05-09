import os
import sqlite3


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
ROOMS_DB_PATH = os.path.join(DATA_DIR, 'rooms.db')

os.makedirs(DATA_DIR, exist_ok=True)

conn = sqlite3.connect(ROOMS_DB_PATH)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS rooms(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin TEXT UNIQUE
)
""")

conn.commit()
conn.close()

print(f"rooms.db initialized at: {ROOMS_DB_PATH}")


# ============================================================
# ANALYTICS TABLES
# ============================================================

def create_analytics_tables_pg(conn):
    """建立 PostgreSQL 分析資料表（生產環境）"""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS match_history (
            id              SERIAL PRIMARY KEY,
            player_name     VARCHAR(100) NOT NULL,
            room_id         VARCHAR(50)  NOT NULL,
            room_name       VARCHAR(200),
            quiz_bank_name  VARCHAR(200),
            played_at       TIMESTAMPTZ DEFAULT NOW(),
            total_score     INTEGER NOT NULL DEFAULT 0,
            rank            INTEGER,
            total_players   INTEGER,
            correct_count   INTEGER NOT NULL DEFAULT 0,
            wrong_count     INTEGER NOT NULL DEFAULT 0,
            avg_speed_sec   FLOAT,
            subject_scores  JSONB,
            raw_answers     JSONB
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mh_player ON match_history(player_name)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mh_room   ON match_history(room_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_mh_played ON match_history(played_at DESC)")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS player_statistics (
            player_name     VARCHAR(100) PRIMARY KEY,
            total_games     INTEGER DEFAULT 0,
            total_wins      INTEGER DEFAULT 0,
            current_streak  INTEGER DEFAULT 0,
            best_streak     INTEGER DEFAULT 0,
            total_correct   INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 0,
            avg_score       FLOAT   DEFAULT 0,
            avg_speed_sec   FLOAT   DEFAULT 0,
            subject_avg     JSONB,
            radar_scores    JSONB,
            last_updated    TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS leaderboard_cache (
            id           SERIAL PRIMARY KEY,
            board_type   VARCHAR(50) NOT NULL,
            subject      VARCHAR(100),
            player_name  VARCHAR(100) NOT NULL,
            rank         INTEGER NOT NULL,
            score        FLOAT   NOT NULL,
            extra_data   JSONB,
            period_start DATE,
            updated_at   TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lb_type_rank ON leaderboard_cache(board_type, rank)")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS subject_ranking (
            id           SERIAL PRIMARY KEY,
            subject      VARCHAR(100) NOT NULL,
            player_name  VARCHAR(100) NOT NULL,
            avg_score    FLOAT   NOT NULL,
            game_count   INTEGER NOT NULL,
            rank         INTEGER,
            updated_at   TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(subject, player_name)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS student_analysis (
            id              SERIAL PRIMARY KEY,
            room_id         VARCHAR(50)  NOT NULL,
            student_name    VARCHAR(100) NOT NULL,
            teacher_name    VARCHAR(100),
            weak_subjects   JSONB,
            ai_suggestion   TEXT,
            question_detail JSONB,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sa_room    ON student_analysis(room_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sa_student ON student_analysis(student_name)")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS parent_reports (
            id             SERIAL PRIMARY KEY,
            report_token   VARCHAR(64) UNIQUE NOT NULL,
            student_name   VARCHAR(100) NOT NULL,
            room_id        VARCHAR(50),
            generated_by   VARCHAR(100),
            report_data    JSONB NOT NULL,
            created_at     TIMESTAMPTZ DEFAULT NOW(),
            expires_at     TIMESTAMPTZ
        )
    """)
    conn.commit()
    cur.close()
    print("[Analytics] PostgreSQL tables created.")


def create_analytics_tables_sqlite(db_path):
    """建立 SQLite 分析資料表（本地開發）"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS match_history (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name    TEXT NOT NULL,
            room_id        TEXT NOT NULL,
            room_name      TEXT,
            quiz_bank_name TEXT,
            played_at      TEXT DEFAULT (datetime('now','utc')),
            total_score    INTEGER NOT NULL DEFAULT 0,
            rank           INTEGER,
            total_players  INTEGER,
            correct_count  INTEGER NOT NULL DEFAULT 0,
            wrong_count    INTEGER NOT NULL DEFAULT 0,
            avg_speed_sec  REAL,
            subject_scores TEXT,
            raw_answers    TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_mh_player ON match_history(player_name);
        CREATE INDEX IF NOT EXISTS idx_mh_room   ON match_history(room_id);

        CREATE TABLE IF NOT EXISTS player_statistics (
            player_name     TEXT PRIMARY KEY,
            total_games     INTEGER DEFAULT 0,
            total_wins      INTEGER DEFAULT 0,
            current_streak  INTEGER DEFAULT 0,
            best_streak     INTEGER DEFAULT 0,
            total_correct   INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 0,
            avg_score       REAL    DEFAULT 0,
            avg_speed_sec   REAL    DEFAULT 0,
            subject_avg     TEXT,
            radar_scores    TEXT,
            last_updated    TEXT DEFAULT (datetime('now','utc'))
        );

        CREATE TABLE IF NOT EXISTS leaderboard_cache (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            board_type   TEXT NOT NULL,
            subject      TEXT,
            player_name  TEXT NOT NULL,
            rank         INTEGER NOT NULL,
            score        REAL    NOT NULL,
            extra_data   TEXT,
            period_start TEXT,
            updated_at   TEXT DEFAULT (datetime('now','utc'))
        );

        CREATE TABLE IF NOT EXISTS subject_ranking (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            subject      TEXT NOT NULL,
            player_name  TEXT NOT NULL,
            avg_score    REAL    NOT NULL,
            game_count   INTEGER NOT NULL,
            rank         INTEGER,
            updated_at   TEXT DEFAULT (datetime('now','utc')),
            UNIQUE(subject, player_name)
        );

        CREATE TABLE IF NOT EXISTS student_analysis (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id         TEXT NOT NULL,
            student_name    TEXT NOT NULL,
            teacher_name    TEXT,
            weak_subjects   TEXT,
            ai_suggestion   TEXT,
            question_detail TEXT,
            created_at      TEXT DEFAULT (datetime('now','utc'))
        );

        CREATE TABLE IF NOT EXISTS parent_reports (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            report_token   TEXT UNIQUE NOT NULL,
            student_name   TEXT NOT NULL,
            room_id        TEXT,
            generated_by   TEXT,
            report_data    TEXT NOT NULL,
            created_at     TEXT DEFAULT (datetime('now','utc')),
            expires_at     TEXT
        );
    """)
    conn.commit()
    conn.close()
    print("[Analytics] SQLite tables created.")


# Run analytics table creation
_analytics_db_url = os.environ.get('DATABASE_URL', '')
if _analytics_db_url:
    try:
        import psycopg2 as _psycopg2
        _pg = _psycopg2.connect(_analytics_db_url)
        create_analytics_tables_pg(_pg)
        _pg.close()
    except Exception as _e:
        print(f"[Analytics] PostgreSQL setup failed: {_e}")
else:
    _analytics_sqlite_path = os.path.join(DATA_DIR, 'analytics.db')
    create_analytics_tables_sqlite(_analytics_sqlite_path)
