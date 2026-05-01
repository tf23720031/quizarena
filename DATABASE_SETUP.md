# QuizArena — 資料庫持久化設定指南

## 架構說明

| 儲存層 | 用途 |
|--------|------|
| **PostgreSQL** (Render DATABASE_URL) | 所有使用者資料主儲存 |
| **SQLite** (本地開發備援) | 本地開發時自動使用 |
| **localStorage** | 快取/暫存，重新部署後仍讀 DB |

---

## Render 部署設定

### 1. 建立 PostgreSQL 資料庫

在 Render Dashboard：
1. New → **PostgreSQL**
2. 記下 **Internal Database URL**

### 2. 設定環境變數

在你的 Web Service → Environment：

```
DATABASE_URL = postgresql://user:pass@host/dbname
```

> Render 提供的 URL 開頭可能是 `postgres://`，程式會自動轉換為 `postgresql://`

### 3. 自動建表

部署後 app.py 啟動時會自動執行：
- `init_users_db()` — 建立所有使用者相關表
- `init_extended_db()` — 建立擴充表（story_progress、marketplace_banks 等）
- `init_postgres_quiz_banks_db()` — 建立題庫表

**不需要手動執行 SQL**。

---

## 資料表一覽

### users
| 欄位 | 類型 | 說明 |
|------|------|------|
| username | TEXT | 主鍵（唯一） |
| email | TEXT | 電子郵件 |
| nickname | TEXT | 顯示暱稱 |
| level | INTEGER | 等級 |
| exp | INTEGER | 經驗值 |
| coins | INTEGER | 金幣 |
| account_status | TEXT | active/inactive/banned/student/teacher |
| last_login_at | BIGINT | 最後登入時間戳 |

### story_progress
| 欄位 | 類型 | 說明 |
|------|------|------|
| username | TEXT | 使用者 |
| quiz_bank_id | TEXT | 題庫 ID |
| cleared_levels | INTEGER | 已通關數 |
| current_level | INTEGER | 目前關卡 |
| completed | BOOLEAN | 是否全通關 |
| last_played_at | BIGINT | 最後遊玩時間 |

### wrong_question_book
| 欄位 | 類型 | 說明 |
|------|------|------|
| username | TEXT | 使用者 |
| question_id | TEXT | 題目 ID |
| story_chapter | TEXT | 故事章節名稱 |
| story_level | INTEGER | 故事關卡號 |
| user_answer_index | INTEGER | 玩家選的答案索引 |
| wrong_count | INTEGER | 答錯次數 |
| review_count | INTEGER | 複習次數 |
| mastered | BOOLEAN | 是否已掌握 |

### quiz_banks
| 欄位 | 類型 | 說明 |
|------|------|------|
| username | TEXT | 擁有者 |
| bank_id | TEXT | 題庫 ID |
| title | TEXT | 題庫名稱 |
| data | JSONB | 完整題庫資料 |
| visibility | TEXT | private/public |
| source_type | TEXT | user/ai/marketplace_copy |

### marketplace_banks
| 欄位 | 類型 | 說明 |
|------|------|------|
| bank_id | TEXT | 題庫 ID |
| owner_username | TEXT | 上架者 |
| questions_json | JSONB | 題目陣列 |
| copy_count | INTEGER | 被複製次數 |
| avg_rating | FLOAT | 平均評分 |

### user_achievements
| 欄位 | 類型 | 說明 |
|------|------|------|
| username | TEXT | 使用者 |
| achievement_id | TEXT | 成就 ID |
| unlocked | BOOLEAN | 是否解鎖 |
| unlocked_at | BIGINT | 解鎖時間 |
| selected_showcase | BOOLEAN | 是否展示 |

### room_history
| 欄位 | 類型 | 說明 |
|------|------|------|
| room_id | TEXT | 房間 ID |
| host_username | TEXT | 房主 |
| room_pin | TEXT | 6碼 PIN |
| quiz_bank_id | TEXT | 使用題庫 |
| status | TEXT | ended/active |
| player_count | INTEGER | 玩家數 |

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/profile?username=` | 讀取個人資料 |
| PATCH | `/api/profile` | 更新個人資料 |
| GET | `/api/story/progress?username=` | 讀取故事進度 |
| POST | `/api/story/progress` | 儲存故事進度 |
| POST | `/api/story/wrong-answer` | 記錄故事錯題 |
| GET | `/api/wrong-book?username=` | 讀取錯題本 |
| POST | `/api/wrong-book/mark-reviewed` | 標記已複習 |
| GET | `/api/quiz-banks/my?username=` | 讀取我的題庫 |
| POST | `/api/quiz-banks` | 儲存單一題庫 |
| GET | `/api/marketplace/banks` | 讀取市集題庫 |
| POST | `/api/marketplace/copy` | 複製市集題庫 |
| POST | `/api/marketplace/publish` | 上架題庫 |
| GET | `/api/achievements?username=` | 讀取成就 |
| POST | `/api/achievements/sync` | 同步解鎖成就 |
| PATCH | `/api/achievements/showcase` | 更新展示成就 |
| GET | `/api/daily-mission?username=` | 讀取每日任務 |
| POST | `/api/daily-mission/complete` | 完成任務 |
| GET | `/api/rooms/history?username=` | 讀取房間歷史 |
| GET | `/api/account/status?username=` | 讀取帳號狀態 |
| PATCH | `/api/account/status` | 更新帳號狀態 |

---

## 前端整合（js/api_client.js）

所有頁面都已引入 `js/api_client.js`，使用 `window.QA` 物件：

```javascript
// 讀取個人資料
const profile = await QA.loadProfile();

// 儲存故事進度
await QA.saveStoryProgress(bankId, clearedLevels, currentLevel, score, completed);

// 記錄故事錯題（含章節/關卡資訊）
await QA.addWrongAnswer(stage, subjectTitle, { chapter, level, userAnswer });

// 讀取錯題本
const wb = await QA.loadWrongBook();

// 複製市集題庫到我的題庫
const result = await QA.copyMarketplaceBank(bankId);

// 更新帳號狀態
await QA.api('/api/account/status', { method:'PATCH', body: JSON.stringify({username, status:'teacher'}) });
```

所有 API 都有 **localStorage 快取備援**：
- API 失敗時自動讀快取
- 成功時自動更新快取
- 重新部署後資料不消失（資料在 PostgreSQL）

---

## localStorage 只用於快取

| Key | 用途 |
|-----|------|
| `currentUser` | 登入狀態（session） |
| `qa_profile_cache` | 個人資料快取 |
| `qa_banks_cache` | 題庫列表快取 |
| `qa_story_progress_cache` | 故事進度快取 |
| `qa_ach_cache` | 成就快取 |

> 快取隨時可清除，真實資料永久保存於 PostgreSQL。
