import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

class Api {
  final String baseUrl;
  String? token;
  Api(this.baseUrl);

  Future<dynamic> call(String path,
      {String method = 'GET',
      Map<String, dynamic>? data,
      bool raw = false}) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (data != null) request.body = jsonEncode(data);
    final client = http.Client();
    try {
      final response = await (() async {
        final streamed = await client.send(request);
        return http.Response.fromStream(streamed);
      })()
          .timeout(const Duration(seconds: 20));
      if (response.statusCode >= 400) {
        String message =
            'Request failed (${response.statusCode}). Please try again.';
        try {
          message = (jsonDecode(response.body) as Map)['error']?.toString() ??
              message;
        } catch (_) {}
        throw ApiException(message, response.statusCode);
      }
      return raw ? response.body : jsonDecode(response.body);
    } on TimeoutException {
      throw ApiException(
          'The server took too long. Check your connection and retry.');
    } on http.ClientException {
      throw ApiException(
          'Cannot reach the server. Check the server address and your connection.');
    } on FormatException {
      throw ApiException('The server returned an unexpected response.');
    } finally {
      client.close();
    }
  }
}
