"""Phase 1 analytics tests."""
import json
import time
import pytest


# ── Task 4: save_match_results ──────────────────────────────────────────────

def test_save_match_results_returns_true(client):
    """save_match_results 應回傳 True 且不拋例外。"""
    from app import save_match_results
    results = [
        {
            'player_name': 'TestPlayer',
            'score': 1200,
            'rank': 1,
            'total_players': 3,
            'correct_count': 10,
            'wrong_count': 2,
            'avg_speed_sec': 3.5,
            'subject_scores': {'數學': 90},
            'raw_answers': [{'q_id': 'q1', 'correct': True, 'speed_sec': 2.1}],
        }
    ]
    ok = save_match_results(
        room_id='room-test-001',
        room_name='Test Room',
        quiz_bank_name='測試題庫',
        results=results,
    )
    assert ok is True


# ── Task 5: update_player_statistics ──────────────────────────────────────

def test_update_player_statistics_aggregates_correctly(client):
    """update_player_statistics 應正確累計勝率與正確率。"""
    from app import save_match_results, _get_analytics_conn

    for rank in [1, 2]:
        save_match_results(
            room_id=f'room-stats-{rank}',
            room_name='Stats Room',
            quiz_bank_name='StatBank',
            results=[{
                'player_name': 'StatsPlayer',
                'score': 1000 if rank == 1 else 800,
                'rank': rank,
                'total_players': 3,
                'correct_count': 8,
                'wrong_count': 2,
                'avg_speed_sec': 3.0,
                'subject_scores': {},
                'raw_answers': [],
            }],
        )

    time.sleep(0.5)  # wait for background thread

    conn, is_pg = _get_analytics_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM player_statistics WHERE player_name=?",
        ('StatsPlayer',)
    )
    row = cur.fetchone()
    conn.close()

    assert row is not None
    assert row['total_games'] >= 2
    assert row['total_wins'] >= 1
    assert row['total_correct'] >= 16


# ── Task 7: /api/history & /api/stats ─────────────────────────────────────

def test_api_history_returns_list(client):
    """GET /api/history/<name> 應回傳 JSON 列表。"""
    from app import save_match_results
    save_match_results('r1', 'R1', 'Bank', [{
        'player_name': 'HistoryUser', 'score': 500, 'rank': 2,
        'total_players': 5, 'correct_count': 5, 'wrong_count': 5,
        'avg_speed_sec': 4.0, 'subject_scores': {}, 'raw_answers': [],
    }])
    resp = client.get('/api/history/HistoryUser')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'history' in data
    assert len(data['history']) >= 1
    assert data['history'][0]['room_id'] == 'r1'


def test_api_stats_returns_object(client):
    """GET /api/stats/<name> 應回傳玩家統計物件。"""
    time.sleep(0.3)
    resp = client.get('/api/stats/HistoryUser')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'total_games' in data
    assert data['total_games'] >= 1


# ── Task 8: /api/radar & /api/game-results ────────────────────────────────

def test_api_radar_returns_three_datasets(client):
    """GET /api/radar/<name> 應回傳 self/average/top 三組雷達資料。"""
    resp = client.get('/api/radar/HistoryUser')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'self' in data
    assert 'average' in data
    assert 'top' in data
    assert len(data['self']) == 6


def test_api_game_results_returns_rankings(client):
    """GET /api/game-results/<room_id> 應回傳排名列表。"""
    resp = client.get('/api/game-results/r1')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'rankings' in data
    assert 'my_stats' in data


# ── Task 9: /api/leaderboard ──────────────────────────────────────────────

def test_api_leaderboard_total(client):
    """GET /api/leaderboard?type=total 應回傳排名陣列。"""
    resp = client.get('/api/leaderboard?type=total&limit=10')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'rankings' in data
    assert isinstance(data['rankings'], list)


# ── Task 1 (Phase 3): Teacher overview ────────────────────────────────────

def test_teacher_overview_returns_summary(client):
    """GET /api/teacher/overview/<room_id> 應回傳班級統計。"""
    from app import save_match_results
    save_match_results('room-teacher-01', 'Teacher Room', 'BioBank', [
        {'player_name': 'S1', 'score': 900, 'rank': 1, 'total_players': 2,
         'correct_count': 9, 'wrong_count': 1, 'avg_speed_sec': 2.5,
         'subject_scores': {'生物': 90},
         'raw_answers': [{'q_id': 'q1', 'correct': True, 'speed_sec': 2.0}]},
        {'player_name': 'S2', 'score': 400, 'rank': 2, 'total_players': 2,
         'correct_count': 4, 'wrong_count': 6, 'avg_speed_sec': 5.0,
         'subject_scores': {'生物': 40},
         'raw_answers': [{'q_id': 'q1', 'correct': False, 'speed_sec': 5.0}]},
    ])
    resp = client.get('/api/teacher/overview/room-teacher-01')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'total_students' in data
    assert data['total_students'] == 2
    assert 'avg_accuracy' in data
    assert 'needs_help' in data


def test_teacher_weak_questions(client):
    """GET /api/teacher/weak-questions/<room_id> 應回傳題目錯誤率排序。"""
    resp = client.get('/api/teacher/weak-questions/room-teacher-01')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'questions' in data
    assert len(data['questions']) >= 1
    assert 'q_id' in data['questions'][0]
    assert 'error_rate' in data['questions'][0]


def test_ai_suggestion_returns_text(client):
    """POST /api/teacher/ai-suggestion 應回傳建議文字（fallback 模式）。"""
    import os
    os.environ['HF_API_KEY'] = ''
    resp = client.post('/api/teacher/ai-suggestion', json={
        'student_name': 'S2',
        'room_id': 'room-teacher-01',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'suggestion' in data
    assert len(data['suggestion']) > 10


def test_parent_report_generates_token(client):
    """POST /api/teacher/parent-report 應回傳 token 與 url。"""
    resp = client.post('/api/teacher/parent-report', json={
        'student_name': 'S1',
        'room_id': 'room-teacher-01',
        'teacher_name': 'Teacher01',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'token' in data
    assert 'url' in data
    assert len(data['token']) == 32


def test_parent_report_api_returns_data(client):
    """GET /api/parent-report/<token> 應回傳匿名化報告資料。"""
    gen = client.post('/api/teacher/parent-report', json={
        'student_name': 'S1',
        'room_id': 'room-teacher-01',
        'teacher_name': 'T',
    }).get_json()
    token = gen['token']
    resp = client.get(f'/api/parent-report/{token}')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['student_name'] == 'S1'
    assert 'score' in data
