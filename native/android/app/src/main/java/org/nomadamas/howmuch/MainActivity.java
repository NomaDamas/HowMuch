package org.nomadamas.howmuch;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

/** HowMuch app shell: hosts the HowMuch web camera app in a WebView. No keys inside; it only loads a HowMuch server URL. */
public final class MainActivity extends Activity {
    private static final String DEFAULT_URL = "http://10.0.2.2:5173"; // emulator -> host loopback
    private WebView web;
    private PermissionRequest pending;

    private String serverUrl() {
        SharedPreferences p = getSharedPreferences("howmuch", MODE_PRIVATE);
        return p.getString("url", DEFAULT_URL);
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
        WebView.setWebContentsDebuggingEnabled(true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!Uri.parse(serverUrl()).getHost().equals(request.getOrigin().getHost())) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) request.grant(request.getResources());
                    else { pending = request; requestPermissions(new String[]{Manifest.permission.CAMERA}, 7); }
                });
            }
        });
        web.setWebViewClient(new WebViewClient() {
            // Local HowMuch servers use a private self-signed certificate: trust it for the configured host only.
            @Override public void onReceivedSslError(WebView v, SslErrorHandler h, SslError e) {
                if (Uri.parse(e.getUrl()).getHost().equals(Uri.parse(serverUrl()).getHost())) h.proceed(); else h.cancel();
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) askServer(String.valueOf(e.getDescription()));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.getHost() != null && u.getHost().equals(Uri.parse(serverUrl()).getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, u)); return true;
            }
        });
        web.loadUrl(serverUrl());
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == 7 && pending != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pending.grant(pending.getResources()); else pending.deny();
            pending = null;
        }
    }

    /** Long-press the screen is reserved for the web app, so the address dialog opens on load failure or volume-up. */
    @Override public boolean onKeyDown(int key, android.view.KeyEvent ev) {
        if (key == android.view.KeyEvent.KEYCODE_VOLUME_UP) { askServer(null); return true; }
        return super.onKeyDown(key, ev);
    }

    private void askServer(String error) {
        EditText t = new EditText(this); t.setText(serverUrl());
        new AlertDialog.Builder(this).setTitle("HowMuch 서버 주소")
            .setMessage((error != null ? "연결 실패: " + error + "\n\n" : "") + "예: https://192.168.0.12:8443 (Mac에서 npm run demo:phone)")
            .setView(t)
            .setPositiveButton("저장 후 열기", (d, w) -> {
                String v = t.getText().toString().trim();
                if (v.startsWith("http://") || v.startsWith("https://")) getSharedPreferences("howmuch", MODE_PRIVATE).edit().putString("url", v).apply();
                web.loadUrl(serverUrl());
            }).setNegativeButton("다시 시도", (d, w) -> web.loadUrl(serverUrl())).show();
    }
}
