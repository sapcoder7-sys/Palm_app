import unittest
from domain import money_to_paise, validate_refund


class MoneyTests(unittest.TestCase):
    def test_exact_decimal_conversion(self):
        self.assertEqual(money_to_paise('0.29'), 29)
        self.assertEqual(money_to_paise('123456.78'), 12345678)

    def test_reject_invalid_money(self):
        for value in ('NaN', 'Infinity', '-1', '0', '1.001', '', None, '100000000.01'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                money_to_paise(value)

    def test_refunds_respect_pending_and_approved_reservations(self):
        validate_refund('paid', 10000, 6000, 4000)
        with self.assertRaises(ValueError):
            validate_refund('paid', 10000, 6000, 4001)
        with self.assertRaises(ValueError):
            validate_refund('pending', 10000, 0, 1)
