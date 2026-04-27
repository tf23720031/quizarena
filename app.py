
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
