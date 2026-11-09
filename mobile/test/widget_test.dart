import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:palm_app/main.dart';

void main() {
  testWidgets('Login requires server, email and password before a request',
      (tester) async {
    await tester.pumpWidget(const PalmApp());
    expect(find.text('Palm'), findsOneWidget);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your email.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
  });

  test('Money formatting uses integer paise', () {
    expect(money(29), '₹0.29');
    expect(money(10029), '₹100.29');
  });
}
