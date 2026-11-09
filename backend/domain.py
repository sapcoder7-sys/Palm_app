from decimal import Decimal, InvalidOperation


def money_to_paise(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount > Decimal('100000000'):
            raise ValueError('Amount must be between 0.01 and 100,000,000.')
        if amount != amount.quantize(Decimal('0.01')):
            raise ValueError('Use no more than two decimal places.')
        return int(amount * 100)
    except (InvalidOperation, TypeError):
        raise ValueError('Enter a valid amount.') from None


def validate_refund(payment_status, payment_amount, reserved_amount, requested_amount):
    if payment_status != 'paid':
        raise ValueError('Only paid transactions can be refunded.')
    if requested_amount <= 0 or requested_amount + reserved_amount > payment_amount:
        raise ValueError('Refund exceeds the available payment balance.')
