CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','employee')),
 phone TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id),
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY, customer TEXT NOT NULL, amount_paise BIGINT NOT NULL CHECK(amount_paise > 0),
 method TEXT NOT NULL CHECK(method IN ('Cash','UPI','Bank','Card')),
 status TEXT NOT NULL CHECK(status IN ('pending','paid')),
 reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 employee_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 paid_at TIMESTAMPTZ,
 idempotency_key UUID UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
 id UUID PRIMARY KEY, payment_id UUID NOT NULL REFERENCES payments(id),
 amount_paise BIGINT NOT NULL CHECK(amount_paise > 0), reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ,
 idempotency_key UUID UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY, actor_id UUID NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, entity_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_attempts (
 identity TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_employee_idx ON payments(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON refunds(payment_id);
