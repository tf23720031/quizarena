import os
import pytest

# Force SQLite for tests (no PostgreSQL needed)
os.environ['DATABASE_URL'] = ''
# Use a dedicated test data dir so we don't pollute the real DB
TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), 'test_data')
os.environ['QUIZARENA_DATA_DIR'] = TEST_DATA_DIR
os.makedirs(TEST_DATA_DIR, exist_ok=True)

# Fresh analytics DB each session to avoid stale data across runs
from create_db import create_analytics_tables_sqlite
_analytics_db = os.path.join(TEST_DATA_DIR, 'analytics.db')
if os.path.exists(_analytics_db):
    os.remove(_analytics_db)
create_analytics_tables_sqlite(_analytics_db)

from app import app as flask_app

@pytest.fixture
def app():
    flask_app.config['TESTING'] = True
    flask_app.config['SECRET_KEY'] = 'test-secret'
    yield flask_app

@pytest.fixture
def client(app):
    return app.test_client()
