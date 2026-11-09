import { Api, ApiError, normalizeServer } from '../api';
import { money, validAmount } from '../format';

describe('Server address validation', () => {
  test('release requires HTTPS and rejects embedded credentials', () => {
    expect(() => normalizeServer('http://server.test', false)).toThrow(ApiError);
    expect(() => normalizeServer('https://user:password@server.test', false)).toThrow(ApiError);
    expect(() => normalizeServer('https://server.test?token=secret', false)).toThrow(ApiError);
    expect(normalizeServer(' https://server.test/ ', false)).toBe('https://server.test');
    expect(normalizeServer('http://192.168.1.10:8000', true)).toBe('http://192.168.1.10:8000');
  });
});

describe('Payment input', () => {
  test('accepts paise precision without accepting invalid values', () => {
    for (const value of ['0.29', '100', '100000000.00']) expect(validAmount(value)).toBe(true);
    for (const value of ['0', '-1', '1.001', 'NaN', '', '100000000.01']) expect(validAmount(value)).toBe(false);
    expect(money(29)).toContain('0.29');
  });
});

describe('API session and transport', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });
  test('includes token and preserves exact amount and idempotency key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{"id":"payment-1"}' });
    global.fetch = fetchMock;
    const api = new Api('https://server.test'); api.token = 'test-session';
    const body = { amount: '0.29', idempotency_key: 'same-key' };
    await api.call('/payments', 'POST', body);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-session');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
  });
  test('expired sessions clear token and notify the app', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"Please sign in again."}' });
    const api = new Api('https://server.test'); api.token = 'expired'; api.onUnauthorized = jest.fn();
    await expect(api.call('/dashboard')).rejects.toThrow('Please sign in again.');
    expect(api.token).toBeNull(); expect(api.onUnauthorized).toHaveBeenCalledTimes(1);
  });
  test('handles network failure without exposing implementation details', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network details'));
    await expect(new Api('https://server.test').call('/payments')).rejects.toThrow('Cannot reach the server.');
  });
  test('handles invalid server JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '<html>unexpected</html>' });
    await expect(new Api('https://server.test').call('/payments')).rejects.toThrow('Unexpected response');
  });
});
