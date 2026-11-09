import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import unittest
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
from werkzeug.security import generate_password_hash
from app import app


@unittest.skipUnless(os.getenv('TEST_DATABASE_URL'), 'Set TEST_DATABASE_URL for PostgreSQL integration tests.')
class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ['TEST_DATABASE_URL']
        cls.previous_url = os.environ.get('DATABASE_URL')
        cls.schema = 'palm_test_' + uuid4().hex
        with psycopg.connect(cls.base, autocommit=True) as conn:
            conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(cls.schema)))
        os.environ['DATABASE_URL'] = make_conninfo(cls.base, options=f'-c search_path={cls.schema}')
        with psycopg.connect(os.environ['DATABASE_URL']) as conn:
            conn.execute(Path(__file__).resolve().parents[1].joinpath('schema.sql').read_text())
        cls.password = 'Test-only-password-123!'
        cls.password_hash = generate_password_hash(cls.password)

    @classmethod
    def tearDownClass(cls):
        # Only the randomly named schema created by this suite is removed.
        assert cls.schema.startswith('palm_test_') and len(cls.schema) == 42
        with psycopg.connect(cls.base, autocommit=True) as conn:
            conn.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(cls.schema)))
        if cls.previous_url is None:
            os.environ.pop('DATABASE_URL', None)
        else:
            os.environ['DATABASE_URL'] = cls.previous_url

    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.ids = {}
        with psycopg.connect(os.environ['DATABASE_URL']) as conn:
            conn.execute('TRUNCATE audit_log,refunds,payments,sessions,users,login_attempts CASCADE')
            for name, role in [('admin', 'admin'), ('alice', 'employee'), ('bob', 'employee')]:
                self.ids[name] = uuid4()
                conn.execute('INSERT INTO users(id,name,email,password_hash,role) VALUES(%s,%s,%s,%s,%s)',
                             (self.ids[name], name, name + '@palm.test', self.password_hash, role))
        self.headers = {}
        for name in self.ids:
            response = self.client.post('/auth/login', json={'email': name + '@palm.test', 'password': self.password})
            self.assertEqual(response.status_code, 200)
            self.headers[name] = {'Authorization': 'Bearer ' + response.json['token']}

    def payment(self, owner='alice', **changes):
        data = dict(customer='Customer A', amount='100.29', method='Cash', status='paid', idempotency_key=str(uuid4()))
        data.update(changes)
        response = self.client.post('/payments', headers=self.headers[owner], json=data)
        self.assertEqual(response.status_code, 201, response.json)
        return response.json['id']

    def refund(self, pid, amount='50', owner='alice', **changes):
        data = dict(payment_id=pid, amount=amount, reason='Returned item', idempotency_key=str(uuid4()))
        data.update(changes)
        return self.client.post('/refunds', headers=self.headers[owner], json=data)

    def test_access_and_employee_isolation(self):
        pid = self.payment()
        self.assertEqual(self.client.get('/payments').status_code, 401)
        self.assertEqual(self.client.get('/employees', headers=self.headers['alice']).status_code, 403)
        self.assertEqual(len(self.client.get('/payments', headers=self.headers['alice']).json), 1)
        self.assertEqual(self.client.get('/payments', headers=self.headers['bob']).json, [])
        self.assertEqual(self.refund(pid, owner='bob').status_code, 404)
        self.assertEqual(self.client.post(f'/payments/{pid}/paid', headers=self.headers['bob']).status_code, 404)

    def test_full_refund_workflow_and_audit(self):
        pid = self.payment()
        refund = self.refund(pid)
        self.assertEqual(refund.status_code, 201)
        rid = refund.json['id']
        path = f'/refunds/{rid}/review'
        self.assertEqual(self.client.post(path, headers=self.headers['alice'], json={'status': 'approved'}).status_code, 403)
        self.assertEqual(self.client.post(path, headers=self.headers['admin'], json={'status': 'approved'}).status_code, 200)
        self.assertEqual(self.client.post(path, headers=self.headers['admin'], json={'status': 'approved'}).status_code, 409)
        dashboard = self.client.get('/dashboard', headers=self.headers['admin']).json
        self.assertEqual(dashboard['net_paise'], 5029)
        self.assertEqual(dashboard['refunded_paise'], 5000)
        audit = self.client.get('/audit', headers=self.headers['admin']).json
        self.assertEqual({row['action'] for row in audit}, {'payment.created', 'refund.requested', 'refund.approved'})

    def test_pending_payment_must_be_paid_before_refund(self):
        pid = self.payment(status='pending')
        self.assertEqual(self.refund(pid).status_code, 400)
        self.assertEqual(self.client.post(f'/payments/{pid}/paid', headers=self.headers['alice']).status_code, 200)
        self.assertEqual(self.refund(pid).status_code, 201)

    def test_refund_limits_and_rejection_releases_balance(self):
        pid = self.payment()
        rid = self.refund(pid, '90').json['id']
        self.assertEqual(self.refund(pid, '11').status_code, 400)
        self.client.post(f'/refunds/{rid}/review', headers=self.headers['admin'], json={'status': 'rejected'})
        self.assertEqual(self.refund(pid, '100.29').status_code, 201)

    def test_retry_does_not_duplicate_payment_or_refund(self):
        key = str(uuid4())
        pid = self.payment(idempotency_key=key)
        response = self.client.post('/payments', headers=self.headers['alice'], json={'idempotency_key': key})
        self.assertEqual(response.json['id'], pid)
        key = str(uuid4())
        rid = self.refund(pid, idempotency_key=key).json['id']
        self.assertEqual(self.refund(pid, idempotency_key=key).json['id'], rid)
        self.assertEqual(len(self.client.get('/payments', headers=self.headers['admin']).json), 1)
        self.assertEqual(len(self.client.get('/refunds', headers=self.headers['admin']).json), 1)

    def test_concurrent_refunds_cannot_exceed_payment(self):
        pid = self.payment(amount='100')
        def submit(_):
            with app.test_client() as client:
                return client.post('/refunds', headers=self.headers['alice'], json={
                    'payment_id': pid, 'amount': '60', 'reason': 'Concurrent request', 'idempotency_key': str(uuid4()),
                }).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes = list(pool.map(submit, range(2)))
        self.assertEqual(sorted(codes), [201, 400])

    def test_deactivation_revokes_sessions(self):
        response = self.client.patch('/employees/' + str(self.ids['alice']), headers=self.headers['admin'], json={'active': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/payments', headers=self.headers['alice']).status_code, 401)
        self.assertEqual(self.client.patch('/employees/' + str(self.ids['admin']), headers=self.headers['admin'], json={'active': False}).status_code, 400)

    def test_logout_revokes_token(self):
        self.assertEqual(self.client.post('/auth/logout', headers=self.headers['alice']).status_code, 200)
        self.assertEqual(self.client.get('/dashboard', headers=self.headers['alice']).status_code, 401)

    def test_csv_neutralizes_formulas_and_is_admin_only(self):
        self.payment(customer='=HYPERLINK("evil")', reference='@SUM(A1)')
        self.assertEqual(self.client.get('/reports/payments.csv', headers=self.headers['alice']).status_code, 403)
        response = self.client.get('/reports/payments.csv', headers=self.headers['admin'])
        self.assertEqual(response.status_code, 200)
        self.assertIn("'=HYPERLINK", response.text)
        self.assertIn("'@SUM", response.text)

    def test_employee_creation_and_invalid_amount(self):
        response = self.client.post('/employees', headers=self.headers['admin'], json={
            'name': 'New Employee', 'email': 'new@palm.test', 'password': self.password, 'role': 'employee',
        })
        self.assertEqual(response.status_code, 201)
        response = self.client.post('/payments', headers=self.headers['alice'], json={
            'customer': 'A', 'amount': '1.001', 'method': 'Cash', 'status': 'paid', 'idempotency_key': str(uuid4()),
        })
        self.assertEqual(response.status_code, 400)

    def test_password_whitespace_is_preserved(self):
        password = '  Long password with spaces  '
        response = self.client.post('/employees', headers=self.headers['admin'], json={
            'name': 'Spaces', 'email': 'spaces@palm.test', 'password': password,
        })
        self.assertEqual(response.status_code, 201)
        response = self.client.post('/auth/login', json={'email': 'spaces@palm.test', 'password': password})
        self.assertEqual(response.status_code, 200)
