import sqlite3

conn = sqlite3.connect("rooms.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS rooms(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin TEXT UNIQUE
)
""")

cursor.execute("INSERT OR IGNORE INTO rooms(pin) VALUES ('123456')")
cursor.execute("INSERT OR IGNORE INTO rooms(pin) VALUES ('654321')")

conn.commit()
conn.close()

print("資料庫建立完成")