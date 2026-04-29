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
