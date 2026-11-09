"""Apply Palm settings after `flutter create --platforms=android .`."""
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'mobile'
manifest = root / 'android/app/src/main/AndroidManifest.xml'
text = manifest.read_text()
text = text.replace('android:label="palm_app"', 'android:label="Palm"')
if 'android.permission.INTERNET' not in text:
    text = text.replace('<application', '<uses-permission android:name="android.permission.INTERNET"/>\n    <application', 1)
manifest.write_text(text)
# HTTP is available for local debug builds only. Release builds require HTTPS.
debug_manifest = root / 'android/app/src/debug/AndroidManifest.xml'
debug_manifest.parent.mkdir(parents=True, exist_ok=True)
debug_manifest.write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:usesCleartextTraffic="true"/>
</manifest>
''')
print('Android permissions and Palm name configured.')
