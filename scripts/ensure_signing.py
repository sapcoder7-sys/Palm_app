"""Create a private local Android signing key, without printing passwords."""
import os
from pathlib import Path
import secrets
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
android = root / 'mobile/android'
properties = android / 'key.properties'
keystore = android / 'palm-release.jks'
if not properties.exists():
    if keystore.exists():
        raise SystemExit('A keystore already exists without key.properties. Restore its configuration; refusing to replace the key.')
    java_home = os.getenv('JAVA_HOME')
    keytool = str(Path(java_home) / 'bin/keytool.exe') if java_home and os.name == 'nt' else shutil.which('keytool')
    if not keytool:
        raise SystemExit('Install a JDK and set JAVA_HOME.')
    password = secrets.token_urlsafe(36)
    env = os.environ.copy()
    env['PALM_KEY_PASSWORD'] = password
    subprocess.run([keytool, '-genkeypair', '-keystore', str(keystore), '-alias', 'palm', '-keyalg', 'RSA',
                    '-keysize', '2048', '-validity', '10000', '-storetype', 'JKS',
                    '-storepass:env', 'PALM_KEY_PASSWORD', '-keypass:env', 'PALM_KEY_PASSWORD',
                    '-dname', 'CN=Palm App, OU=Mobile, O=Palm, C=IN', '-noprompt'], env=env, check=True)
    properties.write_text(f'storePassword={password}\nkeyPassword={password}\nkeyAlias=palm\nstoreFile=../palm-release.jks\n')

gradle = android / 'app/build.gradle.kts'
text = gradle.read_text()
if 'val keystoreProperties' not in text:
    if 'signingConfig = signingConfigs.getByName("debug")' not in text:
        raise SystemExit('Unexpected Gradle signing configuration; review manually.')
    text = 'import java.util.Properties\nimport java.io.FileInputStream\n\n' + text
    text = text.replace('android {', '''val keystoreProperties = Properties().apply {
    load(FileInputStream(rootProject.file("key.properties")))
}

android {''', 1)
    text = text.replace('    buildTypes {', '''    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }
    buildTypes {''', 1)
    text = text.replace('signingConfig = signingConfigs.getByName("debug")', 'signingConfig = signingConfigs.getByName("release")')
    gradle.write_text(text)
print('Release signing configured. Back up android/palm-release.jks and android/key.properties privately.')
