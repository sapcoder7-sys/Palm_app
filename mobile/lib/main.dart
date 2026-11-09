import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';
import 'api.dart';

const palmGreen = Color(0xFF136B56);
const ink = Color(0xFF18342D);
String money(dynamic value) =>
    '₹${((value as num? ?? 0) / 100).toStringAsFixed(2)}';
String title(String value) =>
    value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';

void main() => runApp(const PalmApp());

class PalmApp extends StatelessWidget {
  const PalmApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Palm',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: palmGreen),
          scaffoldBackgroundColor: const Color(0xFFF5F7F4),
          appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFFF5F7F4),
              foregroundColor: ink,
              centerTitle: false),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
            minimumSize: const Size(48, 50),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          )),
        ),
        home: const LoginPage(),
      );
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final form = GlobalKey<FormState>();
  final server =
      TextEditingController(text: const String.fromEnvironment('API_BASE_URL'));
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false, obscure = true;
  String? error;

  @override
  void dispose() {
    server.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> login() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    final api = Api(server.text.trim().replaceAll(RegExp(r'/+$'), ''));
    try {
      final result = await api.call('/auth/login',
          method: 'POST',
          data: {'email': email.text.trim(), 'password': password.text});
      api.token = result['token'];
      if (!mounted) return;
      password.clear();
      await Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => HomePage(
              api: api, user: Map<String, dynamic>.from(result['user']))));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
          body: SafeArea(
              child: Center(
                  child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.spa_rounded, size: 64, color: palmGreen),
                    const SizedBox(height: 16),
                    const Text('Palm',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 42,
                            fontWeight: FontWeight.w800,
                            color: ink)),
                    const Text('Every payment. A clearer picture.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.black54)),
                    const SizedBox(height: 40),
                    const Text('Welcome back',
                        style: TextStyle(
                            fontSize: 26, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const Text('Sign in to your business workspace.'),
                    const SizedBox(height: 24),
                    TextFormField(
                        controller: server,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                            labelText: 'Server address',
                            hintText: 'https://api.yourcompany.com',
                            prefixIcon: Icon(Icons.dns_outlined)),
                        validator: (value) {
                          final uri = Uri.tryParse(value?.trim() ?? '');
                          if (uri == null ||
                              uri.host.isEmpty ||
                              uri.userInfo.isNotEmpty ||
                              uri.hasQuery ||
                              uri.hasFragment ||
                              !['https', if (kDebugMode) 'http']
                                  .contains(uri.scheme)) {
                            return kDebugMode
                                ? 'Enter a valid HTTP or HTTPS server URL.'
                                : 'Enter a valid HTTPS server URL.';
                          }
                          return null;
                        }),
                    const SizedBox(height: 16),
                    TextFormField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        decoration: const InputDecoration(
                            labelText: 'Email',
                            prefixIcon: Icon(Icons.mail_outline)),
                        validator: (v) => v != null && v.contains('@')
                            ? null
                            : 'Enter your email.'),
                    const SizedBox(height: 16),
                    TextFormField(
                        controller: password,
                        obscureText: obscure,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) {
                          if (!busy) login();
                        },
                        decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                                tooltip:
                                    obscure ? 'Show password' : 'Hide password',
                                onPressed: () =>
                                    setState(() => obscure = !obscure),
                                icon: Icon(obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined))),
                        validator: (v) => v == null || v.isEmpty
                            ? 'Enter your password.'
                            : null),
                    if (error != null)
                      Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Text(error!,
                              style: const TextStyle(color: Colors.red))),
                    const SizedBox(height: 24),
                    FilledButton(
                        onPressed: busy ? null : login,
                        child: Text(busy ? 'Signing in…' : 'Sign in')),
                    const SizedBox(height: 20),
                    const Text(
                        'Your administrator provides your account and server address.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.black54)),
                  ],
                ))),
      ))));
}

class HomePage extends StatefulWidget {
  final Api api;
  final Map<String, dynamic> user;
  const HomePage({super.key, required this.api, required this.user});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int tab = 0;
  bool loading = true, actionBusy = false;
  String? error;
  String query = '', filter = 'all';
  Map<String, dynamic> dashboard = {};
  List<Map<String, dynamic>> payments = [], refunds = [], employees = [];
  bool get admin => widget.user['role'] == 'admin';
  List<String> get tabs =>
      ['Overview', 'Payments', 'Returns', if (admin) 'Team'];

  @override
  void initState() {
    super.initState();
    refresh();
  }

  void notify(String message) {
    if (mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> refresh() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await Future.wait([
        widget.api.call('/dashboard'),
        widget.api.call('/payments'),
        widget.api.call('/refunds'),
        if (admin) widget.api.call('/employees'),
      ]);
      if (!mounted) return;
      setState(() {
        dashboard = Map<String, dynamic>.from(result[0]);
        payments = (result[1] as List)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        refunds = (result[2] as List)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        if (admin)
          employees = (result[3] as List)
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
      });
    } on ApiException catch (e) {
      if (e.status == 401) {
        widget.api.token = null;
        if (mounted) Navigator.of(context).pop();
        return;
      }
      if (mounted) setState(() => error = e.message);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> action(String path,
      {Map<String, dynamic>? data, String method = 'POST'}) async {
    if (actionBusy) return;
    setState(() => actionBusy = true);
    try {
      await widget.api.call(path, method: method, data: data);
      await refresh();
      notify('Saved successfully.');
    } catch (e) {
      notify(e.toString());
    } finally {
      if (mounted) setState(() => actionBusy = false);
    }
  }

  Future<void> showEntry(String kind, {Map<String, dynamic>? payment}) async {
    final saved = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) =>
            EntryDialog(api: widget.api, kind: kind, payment: payment));
    if (saved == true && mounted) {
      await refresh();
      notify('Saved successfully.');
    }
  }

  Future<bool> confirm(String heading, String message) async =>
      await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
                title: Text(heading),
                content: Text(message),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Confirm')),
                ],
              )) ??
      false;

  Future<void> showReport(bool audit) async {
    try {
      final result = await widget.api
          .call(audit ? '/audit' : '/reports/payments.csv', raw: !audit);
      final text = audit
          ? (result as List)
              .map((e) =>
                  '${e['created_at']} • ${e['actor_name']}\n${e['action']} • ${e['entity_id']}')
              .join('\n\n')
          : result as String;
      if (!mounted) return;
      await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
                title: Text(audit ? 'Activity history' : 'Payments CSV'),
                content: SizedBox(
                    width: 600,
                    child: SingleChildScrollView(
                        child: SelectableText(
                            text.isEmpty ? 'No activity yet.' : text))),
                actions: [
                  TextButton(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: text));
                        notify('Copied to clipboard.');
                      },
                      child: const Text('Copy')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Close')),
                ],
              ));
    } catch (e) {
      notify(e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: Row(children: [
              const Icon(Icons.spa_rounded, color: palmGreen),
              const SizedBox(width: 10),
              Text('Palm / ${tabs[tab]}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 20))
            ]),
            actions: [
              IconButton(
                  tooltip: 'Refresh',
                  onPressed: loading ? null : refresh,
                  icon: const Icon(Icons.refresh)),
              PopupMenuButton<String>(
                  onSelected: (value) async {
                    if (value == 'logout') {
                      try {
                        await widget.api.call('/auth/logout', method: 'POST');
                      } catch (e) {
                        notify(
                            'Server logout failed; signing out on this device.');
                      }
                      widget.api.token = null;
                      if (context.mounted) Navigator.pop(context);
                    } else {
                      await showReport(value == 'audit');
                    }
                  },
                  itemBuilder: (_) => [
                        if (admin)
                          const PopupMenuItem(
                              value: 'csv', child: Text('Payments CSV')),
                        if (admin)
                          const PopupMenuItem(
                              value: 'audit', child: Text('Activity history')),
                        const PopupMenuItem(
                            value: 'logout', child: Text('Sign out')),
                      ]),
            ]),
        body: SafeArea(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? Center(
                        child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.cloud_off_outlined,
                                      size: 48),
                                  const SizedBox(height: 12),
                                  Text(error!, textAlign: TextAlign.center),
                                  const SizedBox(height: 16),
                                  FilledButton(
                                      onPressed: refresh,
                                      child: const Text('Try again')),
                                ])))
                    : RefreshIndicator(
                        onRefresh: refresh,
                        child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                            children: [
                              if (tab == 0) ...overview(),
                              if (tab == 1) ...paymentList(),
                              if (tab == 2) ...refundList(),
                              if (tab == 3 && admin) ...employeeList(),
                            ]))),
        floatingActionButton: (tab == 0 || tab == 1 || (tab == 3 && admin))
            ? FloatingActionButton.extended(
                onPressed: loading
                    ? null
                    : () => showEntry(tab == 3 ? 'employee' : 'payment'),
                icon: const Icon(Icons.add),
                label: Text(tab == 3 ? 'Add employee' : 'Record payment'),
              )
            : null,
        bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (v) => setState(() {
                  tab = v;
                  query = '';
                  filter = 'all';
                }),
            destinations: [
              const NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  selectedIcon: Icon(Icons.grid_view_rounded),
                  label: 'Overview'),
              const NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: 'Payments'),
              const NavigationDestination(
                  icon: Icon(Icons.assignment_return_outlined),
                  label: 'Returns'),
              if (admin)
                const NavigationDestination(
                    icon: Icon(Icons.people_outline), label: 'Team'),
            ]),
      );

  List<Widget> overview() => [
        Text('Hello, ${widget.user['name']}',
            style: const TextStyle(
                fontSize: 28, fontWeight: FontWeight.w700, color: ink)),
        const SizedBox(height: 6),
        Text(
            admin
                ? 'Your business at a glance · All time'
                : 'Your collections at a glance · All time',
            style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 24),
        Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
                color: ink, borderRadius: BorderRadius.circular(24)),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('NET COLLECTIONS',
                  style: TextStyle(
                      color: Color(0xFFB7D6C7),
                      letterSpacing: 1.5,
                      fontSize: 12)),
              const SizedBox(height: 14),
              Text(money(dashboard['net_paise']),
                  style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
              const SizedBox(height: 12),
              const Text('Paid payments minus approved refunds',
                  style: TextStyle(color: Color(0xFFB7D6C7))),
            ])),
        const SizedBox(height: 16),
        LayoutBuilder(
            builder: (_, constraints) =>
                Wrap(spacing: 12, runSpacing: 12, children: [
                  metric(
                      'Paid',
                      dashboard['paid_paise'],
                      Icons.check_circle_outline,
                      palmGreen,
                      (constraints.maxWidth - 12) / 2),
                  metric('Pending', dashboard['pending_paise'], Icons.schedule,
                      const Color(0xFFA46A14), (constraints.maxWidth - 12) / 2),
                  metric('Refunds', dashboard['refunded_paise'], Icons.undo,
                      const Color(0xFF9F5146), (constraints.maxWidth - 12) / 2),
                  SizedBox(
                      width: (constraints.maxWidth - 12) / 2,
                      child: Card(
                          child: Padding(
                              padding: const EdgeInsets.all(18),
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.receipt_long,
                                        color: palmGreen),
                                    const SizedBox(height: 12),
                                    Text('${dashboard['count'] ?? 0}',
                                        style: const TextStyle(
                                            fontSize: 22,
                                            fontWeight: FontWeight.bold)),
                                    const Text('Transactions')
                                  ])))),
                ])),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Recent activity',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          TextButton(
              onPressed: () => setState(() => tab = 1),
              child: const Text('View all'))
        ]),
        if (payments.isEmpty)
          empty(
              'No payments yet',
              'Record your first payment to start tracking collections.',
              Icons.receipt_long_outlined),
        ...payments.take(5).map(paymentCard),
      ];

  Widget metric(String label, dynamic amount, IconData icon, Color color,
          double width) =>
      SizedBox(
          width: width,
          child: Card(
              child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(icon, color: color),
                        const SizedBox(height: 12),
                        FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(money(amount),
                                style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold))),
                        Text(label),
                      ]))));

  Widget empty(String heading, String message, IconData icon) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 12),
      child: Column(children: [
        Icon(icon, size: 48, color: palmGreen),
        const SizedBox(height: 16),
        Text(heading,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center)
      ]));

  Widget badge(String status) {
    final color = ['paid', 'approved'].contains(status)
        ? palmGreen
        : status == 'rejected'
            ? Colors.red.shade700
            : const Color(0xFF9C6A11);
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(20)),
        child: Text(title(status),
            style: TextStyle(
                color: color, fontSize: 12, fontWeight: FontWeight.w600)));
  }

  List<Widget> paymentList() {
    final visible = payments
        .where((p) =>
            (filter == 'all' || p['status'] == filter) &&
            '${p['customer']} ${p['reference']} ${p['employee_name']}'
                .toLowerCase()
                .contains(query.toLowerCase()))
        .toList();
    return [
      TextField(
          decoration: const InputDecoration(
              hintText: 'Search customer, reference or employee',
              prefixIcon: Icon(Icons.search)),
          onChanged: (v) => setState(() => query = v)),
      const SizedBox(height: 12),
      Wrap(
          spacing: 8,
          children: ['all', 'paid', 'pending']
              .map((s) => ChoiceChip(
                  label: Text(title(s)),
                  selected: filter == s,
                  onSelected: (_) => setState(() => filter = s)))
              .toList()),
      const SizedBox(height: 12),
      Text('${visible.length} transactions',
          style: const TextStyle(color: Colors.black54)),
      const SizedBox(height: 8),
      if (visible.isEmpty)
        empty('No matching payments', 'New payments will appear here.',
            Icons.receipt_long_outlined),
      ...visible.map(paymentCard),
    ];
  }

  Widget paymentCard(Map<String, dynamic> p) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => paymentDetails(p),
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                CircleAvatar(
                    backgroundColor: const Color(0xFFE5EFE7),
                    child: Text(
                        p['customer'].toString().substring(0, 1).toUpperCase(),
                        style: const TextStyle(color: palmGreen))),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(p['customer'],
                          style: const TextStyle(fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Text('${p['method']} · ${p['employee_name']}',
                          style: const TextStyle(
                              fontSize: 12, color: Colors.black54),
                          overflow: TextOverflow.ellipsis)
                    ])),
                const SizedBox(width: 8),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(money(p['amount_paise']),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  badge(p['status'])
                ]),
              ]))));

  Future<void> paymentDetails(Map<String, dynamic> p) async {
    final selected = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
              title: Text(p['customer']),
              content: SingleChildScrollView(
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(money(p['amount_paise']),
                        style: const TextStyle(
                            fontSize: 30, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    badge(p['status']),
                    const SizedBox(height: 16),
                    Text(
                        'Method: ${p['method']}\nEmployee: ${p['employee_name']}\nReference: ${p['reference'].toString().isEmpty ? '—' : p['reference']}\nRefunded: ${money(p['refunded_paise'])}\nCreated: ${p['created_at']}\n\n${p['notes']}'),
                  ])),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close')),
                if (p['status'] == 'pending')
                  FilledButton(
                      onPressed:
                          actionBusy ? null : () => Navigator.pop(ctx, 'paid'),
                      child: const Text('Mark paid')),
                if (p['status'] == 'paid')
                  TextButton(
                      onPressed: actionBusy
                          ? null
                          : () => Navigator.pop(ctx, 'refund'),
                      child: const Text('Request refund')),
              ],
            ));
    if (!mounted) return;
    if (selected == 'paid' &&
        await confirm('Confirm payment received',
            'Record ${money(p['amount_paise'])} from ${p['customer']} as paid?')) {
      await action('/payments/${p['id']}/paid');
    } else if (selected == 'refund') {
      await showEntry('refund', payment: p);
    }
  }

  List<Widget> refundList() => [
        const Text('Returns & refunds',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text(
            'Open a paid transaction to request a refund. Approval records a refund; it does not transfer money.',
            style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 20),
        if (refunds.isEmpty)
          empty(
              'No refund requests',
              'Requested, approved and rejected refunds appear here.',
              Icons.assignment_return_outlined),
        ...refunds.map((r) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                            child: Text(r['customer'],
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17))),
                        Text(money(r['amount_paise']),
                            style: const TextStyle(fontWeight: FontWeight.bold))
                      ]),
                      const SizedBox(height: 10),
                      Text(r['reason']),
                      const SizedBox(height: 8),
                      Text('Requested by ${r['employee_name']}',
                          style: const TextStyle(
                              color: Colors.black54, fontSize: 12)),
                      const SizedBox(height: 12),
                      badge(r['status']),
                      if (admin && r['status'] == 'pending')
                        Wrap(
                            spacing: 8,
                            children: ['approved', 'rejected']
                                .map((decision) => TextButton(
                                    onPressed: actionBusy
                                        ? null
                                        : () async {
                                            if (await confirm(
                                                decision == 'approved'
                                                    ? 'Approve refund'
                                                    : 'Reject refund',
                                                '${title(decision)}: ${money(r['amount_paise'])} for ${r['customer']}?')) {
                                              await action(
                                                  '/refunds/${r['id']}/review',
                                                  data: {'status': decision});
                                            }
                                          },
                                    child: Text(decision == 'approved'
                                        ? 'Approve'
                                        : 'Reject')))
                                .toList()),
                    ])))),
      ];

  List<Widget> employeeList() => [
        const Text('Your team',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Manage employee accounts and access.'),
        const SizedBox(height: 20),
        ...employees.map((e) => Card(
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const CircleAvatar(child: Icon(Icons.person_outline)),
                        const SizedBox(width: 12),
                        Expanded(
                            child: Text(e['name'],
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 18))),
                        Text(title(e['role']))
                      ]),
                      const SizedBox(height: 12),
                      Text(e['email']),
                      if (e['phone'].toString().isNotEmpty) Text(e['phone']),
                      const SizedBox(height: 8),
                      Text(
                          e['active'] == true
                              ? 'Active account'
                              : 'Inactive account',
                          style: TextStyle(
                              color: e['active'] == true
                                  ? palmGreen
                                  : Colors.grey)),
                      if (e['id'] != widget.user['id'])
                        TextButton(
                            onPressed: actionBusy
                                ? null
                                : () async {
                                    final active = e['active'] != true;
                                    if (await confirm(
                                        active
                                            ? 'Activate account'
                                            : 'Deactivate account',
                                        'Change access for ${e['name']}?')) {
                                      await action('/employees/${e['id']}',
                                          method: 'PATCH',
                                          data: {'active': active});
                                    }
                                  },
                            child: Text(e['active'] == true
                                ? 'Deactivate account'
                                : 'Activate account')),
                    ])))),
      ];
}

class EntryDialog extends StatefulWidget {
  final Api api;
  final String kind;
  final Map<String, dynamic>? payment;
  const EntryDialog(
      {super.key, required this.api, required this.kind, this.payment});
  @override
  State<EntryDialog> createState() => _EntryDialogState();
}

class _EntryDialogState extends State<EntryDialog> {
  final form = GlobalKey<FormState>();
  final fields = <String, TextEditingController>{};
  final requestKey = const Uuid().v4();
  String method = 'Cash', status = 'paid', role = 'employee';
  bool busy = false;
  String? error;
  TextEditingController controller(String name) =>
      fields.putIfAbsent(name, TextEditingController.new);
  @override
  void dispose() {
    for (final field in fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Widget input(String key, String label,
          {bool optional = false,
          bool amount = false,
          bool secret = false,
          int max = 200}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextFormField(
          controller: controller(key),
          obscureText: secret,
          maxLength: max,
          keyboardType: amount
              ? const TextInputType.numberWithOptions(decimal: true)
              : key == 'email'
                  ? TextInputType.emailAddress
                  : key == 'phone'
                      ? TextInputType.phone
                      : TextInputType.text,
          decoration: InputDecoration(labelText: label, counterText: ''),
          validator: (value) {
            if (!optional && (value == null || value.trim().isEmpty))
              return 'Required';
            if (amount && !RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(value ?? ''))
              return 'Enter an amount with up to 2 decimal places.';
            if (amount &&
                ((num.tryParse(value ?? '') ?? 0) <= 0 ||
                    (num.tryParse(value ?? '') ?? 0) > 100000000))
              return 'Amount must be 0.01 to 100,000,000.';
            if (secret && (value?.length ?? 0) < 12)
              return 'Use at least 12 characters.';
            if (key == 'email' && !(value ?? '').contains('@'))
              return 'Enter a valid email.';
            return null;
          },
        ),
      );

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    final data = <String, dynamic>{
      for (final entry in fields.entries)
        entry.key:
            entry.key == 'password' ? entry.value.text : entry.value.text.trim()
    };
    String path;
    if (widget.kind == 'payment') {
      path = '/payments';
      data.addAll(
          {'method': method, 'status': status, 'idempotency_key': requestKey});
    } else if (widget.kind == 'refund') {
      path = '/refunds';
      data.addAll(
          {'payment_id': widget.payment!['id'], 'idempotency_key': requestKey});
    } else {
      path = '/employees';
      data['role'] = role;
    }
    try {
      await widget.api.call(path, method: 'POST', data: data);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: !busy,
      child: AlertDialog(
        title: Text(widget.kind == 'payment'
            ? 'Record payment'
            : widget.kind == 'refund'
                ? 'Request refund'
                : 'Add team member'),
        content: SizedBox(
            width: 460,
            child: SingleChildScrollView(
                child: Form(
                    key: form,
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      if (widget.kind == 'payment') ...[
                        input('customer', 'Customer name'),
                        input('amount', 'Amount (INR)', amount: true),
                        DropdownButtonFormField<String>(
                            initialValue: method,
                            decoration: const InputDecoration(
                                labelText: 'Payment method'),
                            items: ['Cash', 'UPI', 'Bank', 'Card']
                                .map((s) =>
                                    DropdownMenuItem(value: s, child: Text(s)))
                                .toList(),
                            onChanged: (v) => setState(() => method = v!)),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                            initialValue: status,
                            decoration: const InputDecoration(
                                labelText: 'Payment status'),
                            items: ['paid', 'pending']
                                .map((s) => DropdownMenuItem(
                                    value: s, child: Text(title(s))))
                                .toList(),
                            onChanged: (v) => setState(() => status = v!)),
                        const SizedBox(height: 16),
                        input('reference', 'Reference / receipt number',
                            optional: true),
                        input('notes', 'Notes', optional: true, max: 1000),
                      ],
                      if (widget.kind == 'refund') ...[
                        Text(
                            '${widget.payment!['customer']} · Paid ${money(widget.payment!['amount_paise'])}'),
                        const SizedBox(height: 16),
                        input('amount', 'Refund amount (INR)', amount: true),
                        input('reason', 'Reason for refund', max: 1000),
                      ],
                      if (widget.kind == 'employee') ...[
                        input('name', 'Full name'),
                        input('email', 'Email'),
                        input('phone', 'Phone', optional: true, max: 30),
                        input('password', 'Initial password (12+ characters)',
                            secret: true, max: 256),
                        DropdownButtonFormField<String>(
                            initialValue: role,
                            decoration:
                                const InputDecoration(labelText: 'Access role'),
                            items: ['employee', 'admin']
                                .map((s) => DropdownMenuItem(
                                    value: s, child: Text(title(s))))
                                .toList(),
                            onChanged: (v) => setState(() => role = v!)),
                      ],
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Text(error!,
                                style: const TextStyle(color: Colors.red))),
                    ])))),
        actions: [
          TextButton(
              onPressed: busy ? null : () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: busy ? null : save,
              child: Text(busy ? 'Saving…' : 'Save'))
        ],
      ));
}
