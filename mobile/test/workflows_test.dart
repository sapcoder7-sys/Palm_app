import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:palm_app/api.dart';
import 'package:palm_app/main.dart';

class FixtureApi extends Api {
  Map<String, dynamic>? submittedPayment;
  FixtureApi() : super('https://example.invalid');

  @override
  Future<dynamic> call(String path,
      {String method = 'GET',
      Map<String, dynamic>? data,
      bool raw = false}) async {
    if (path == '/payments' && method == 'POST') {
      submittedPayment = data;
      return {'id': 'new-payment'};
    }
    switch (path) {
      case '/dashboard':
        return {
          'paid_paise': 10029,
          'pending_paise': 0,
          'refunded_paise': 0,
          'net_paise': 10029,
          'count': 1
        };
      case '/payments':
        return [
          {
            'id': 'payment-1',
            'customer': 'A very long customer name for narrow screens',
            'amount_paise': 10029,
            'method': 'UPI',
            'status': 'paid',
            'employee_name': 'Employee One',
            'reference': 'REF-1',
            'notes': '',
            'refunded_paise': 0,
            'created_at': '2026-11-06'
          }
        ];
      case '/refunds':
        return [
          {
            'id': 'refund-1',
            'customer': 'Customer One',
            'amount_paise': 29,
            'reason': 'Partial return',
            'employee_name': 'Employee One',
            'status': 'pending'
          }
        ];
      case '/employees':
        return [
          {
            'id': 'admin-1',
            'name': 'Admin One',
            'email': 'admin@example.invalid',
            'phone': '',
            'role': 'admin',
            'active': true
          }
        ];
      default:
        throw ApiException('Unexpected test request: $path');
    }
  }
}

void main() {
  Future<void> openHome(WidgetTester tester, FixtureApi api,
      {String role = 'admin'}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
        home: HomePage(
            api: api,
            user: {'id': 'admin-1', 'name': 'Admin One', 'role': role})));
    await tester.pumpAndSettle();
  }

  testWidgets('Admin screens fit a phone and expose refund review',
      (tester) async {
    await openHome(tester, FixtureApi());
    expect(tester.takeException(), isNull);
    for (final tab in ['Payments', 'Returns', 'Team']) {
      await tester.tap(find.text(tab));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      if (tab == 'Returns') expect(find.text('Approve'), findsOneWidget);
    }
    expect(find.text('Your team'), findsOneWidget);
  });

  testWidgets('Employees do not see team management or refund approval',
      (tester) async {
    await openHome(tester, FixtureApi(), role: 'employee');
    expect(find.text('Team'), findsNothing);
    await tester.tap(find.text('Returns'));
    await tester.pumpAndSettle();
    expect(find.text('Approve'), findsNothing);
    expect(find.text('Reject'), findsNothing);
  });

  testWidgets('Payment form preserves decimal input and sends a retry key',
      (tester) async {
    final api = FixtureApi();
    await openHome(tester, api);
    await tester.tap(find.text('Record payment'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Customer name'), 'Customer Two');
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Amount (INR)'), '0.29');
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(api.submittedPayment?['amount'], '0.29');
    expect(api.submittedPayment?['idempotency_key'], isNotEmpty);
    expect(api.submittedPayment?['status'], 'paid');
    expect(tester.takeException(), isNull);
  });
}
