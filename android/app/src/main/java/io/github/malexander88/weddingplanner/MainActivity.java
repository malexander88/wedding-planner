package io.github.malexander88.weddingplanner;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Wedding Planner for Android: the built web app, bundled in the APK and served from
 * assets/www under its real address (https://malexander88.github.io/wedding-planner/).
 *
 * Serving locally under the live origin means it works offline, keeps the same storage origin
 * as links the couple share, and the Supabase sync and Google Places proxy see the same Origin
 * header as the website (so no server allow-list change is needed).
 */
public class MainActivity extends Activity {
    static final String HOST = "malexander88.github.io";
    static final String BASE = "/wedding-planner/";
    static final String START = "https://" + HOST + BASE;
    private static final int REQ_FILE = 41;
    private static final int REQ_CAMERA = 42;
    /** A camera request from the page (QR scanning) waiting on Android's permission prompt. */
    private PermissionRequest pendingCamera;
    private static final int FOREST = 0xFF1F3B2D, FOREST_DARK = 0xFF0E1712, NAV_LIGHT = 0xFFFFF9F0;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String bridgeJs;
    private boolean webDark;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(0); // transparent: the launch background shows until the app paints
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false); // target=_blank goes through shouldOverrideUrlLoading
        s.setTextZoom(100);
        // The only media is the muted camera preview used to scan a pairing QR code; it starts after the
        // camera prompt, by which time the tap that opened the scanner no longer counts as a gesture.
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " WeddingPlannerAndroid/" + version());
        web.addJavascriptInterface(new Bridge(), "WPAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));
        setContentView(web);
        applyBars(systemDark());

        if (saved != null && web.restoreState(saved) != null) return;
        web.loadUrl(startUrl(getIntent()));
    }

    /** A pairing link (…/wedding-planner/#join=…) opens straight into the app; anything else starts at home. */
    private String startUrl(Intent i) {
        Uri u = i != null ? i.getData() : null;
        if (u != null && HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(BASE.substring(0, BASE.length() - 1)))
            return u.toString();
        return START;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) web.loadUrl(startUrl(intent));
    }

    // ------------------------------------------------------------------ serving the bundled app

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!HOST.equals(u.getHost())) return null; // Supabase, Open-Meteo, FSA, Google photos…: network as usual
            String path = u.getPath() == null ? "/" : u.getPath();
            if (!path.startsWith(BASE)) {
                if (path.equals(BASE.substring(0, BASE.length() - 1))) path = BASE;
                else return notFound();
            }
            String rel = path.substring(BASE.length());
            // The APK is the offline copy: no service worker (it would only cache what is already local).
            if (rel.equals("sw.js") || rel.startsWith("workbox-")) return notFound();
            if (rel.equals("registerSW.js")) return text("application/javascript", "/* service worker not used in the Android app */");
            if (rel.isEmpty() || rel.equals("index.html") || !rel.contains(".")) return index();
            try {
                InputStream in = getAssets().open("www/" + rel);
                Map<String, String> h = new HashMap<>();
                h.put("Cache-Control", rel.startsWith("assets/") ? "max-age=31536000, immutable" : "no-cache");
                return new WebResourceResponse(mime(rel), charset(rel), 200, "OK", h, in);
            } catch (IOException e) {
                // Unknown file under the app: an app route like /wedding-planner/seating → the app shell.
                return rel.startsWith("assets/") || rel.startsWith("images/") ? notFound() : index();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(BASE.substring(0, BASE.length() - 1))) return false;
            openExternal(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            // Done with the splash image behind the transparent WebView.
            getWindow().setBackgroundDrawable(new ColorDrawable(webDark ? FOREST_DARK : NAV_LIGHT));
        }
    }

    private WebResourceResponse index() {
        try {
            String html = new String(readAll(getAssets().open("www/index.html")), StandardCharsets.UTF_8);
            // The bridge script must run before the app's module script.
            // Plain splice, not a regex replacement: bridge.js contains "$" characters.
            int at = html.indexOf("<head>");
            if (at >= 0) {
                at += "<head>".length();
                html = html.substring(0, at) + "<script>" + bridgeJs() + "</script>" + html.substring(at);
            }
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse("text/html", "utf-8", 200, "OK", h, new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
        } catch (IOException e) {
            return notFound();
        }
    }

    private String bridgeJs() {
        if (bridgeJs == null) {
            try {
                bridgeJs = new String(readAll(getAssets().open("bridge.js")), StandardCharsets.UTF_8);
            } catch (IOException e) {
                bridgeJs = "";
            }
        }
        return bridgeJs;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }

    private static WebResourceResponse text(String mime, String body) {
        return new WebResourceResponse(mime, "utf-8", 200, "OK", null, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = i.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".csv")) return "text/csv";
        if (p.endsWith(".ics")) return "text/calendar";
        return "application/octet-stream";
    }

    private static String charset(String p) {
        String m = mime(p);
        return m.startsWith("text/") || m.endsWith("javascript") || m.endsWith("json") || m.endsWith("svg+xml") ? "utf-8" : null;
    }

    // ------------------------------------------------------------------ links, files, back

    private void openExternal(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        Intent i;
        if (scheme.equals("mailto")) i = new Intent(Intent.ACTION_SENDTO, u);
        else if (scheme.equals("tel")) i = new Intent(Intent.ACTION_DIAL, u);
        else if (scheme.equals("http") || scheme.equals("https") || scheme.equals("geo") || scheme.equals("sms")) i = new Intent(Intent.ACTION_VIEW, u);
        else return; // javascript:, intent:, file: etc. are never handed on
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(i);
        } catch (Exception e) {
            toast("No app found to open this link");
        }
    }

    private class Chrome extends WebChromeClient {
        /** The page asks for the camera only to scan a partner's QR code. Only our own pages may ask. */
        @Override
        public void onPermissionRequest(PermissionRequest req) {
            runOnUiThread(() -> {
                Uri o = req.getOrigin();
                boolean ours = o != null && "https".equals(o.getScheme()) && HOST.equals(o.getHost());
                boolean videoOnly = true;
                for (String r : req.getResources()) if (!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) videoOnly = false;
                if (!ours || !videoOnly) { req.deny(); return; }
                if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
                    return;
                }
                if (pendingCamera != null) pendingCamera.deny();
                pendingCamera = req;
                requestPermissions(new String[] { android.Manifest.permission.CAMERA }, REQ_CAMERA);
            });
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest req) {
            if (req == pendingCamera) pendingCamera = null;
        }

        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            try {
                Intent i = params.createIntent();
                i.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(Intent.createChooser(i, "Choose a file"), REQ_FILE);
                return true;
            } catch (Exception e) {
                fileCallback = null;
                cb.onReceiveValue(null);
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req != REQ_CAMERA || pendingCamera == null) return;
        PermissionRequest r = pendingCamera;
        pendingCamera = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            r.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        } else {
            r.deny();
        }
    }

    /** Back closes an open sheet first, then steps back through the app, and only then leaves. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.__wpBack ? window.__wpBack() : ''", value -> {
            if ("\"closed\"".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else MainActivity.super.onBackPressed();
        });
    }

    // ------------------------------------------------------------------ system bars follow the app theme

    private boolean systemDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    @SuppressWarnings("deprecation")
    private void applyBars(boolean dark) {
        webDark = dark;
        Window w = getWindow();
        w.setStatusBarColor(dark ? FOREST_DARK : FOREST);
        w.setNavigationBarColor(dark ? FOREST_DARK : NAV_LIGHT);
        if (Build.VERSION.SDK_INT >= 26) {
            View d = w.getDecorView();
            int f = d.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            f = dark ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            d.setSystemUiVisibility(f);
        }
    }

    // ------------------------------------------------------------------ bridge for things a WebView can't do

    private class Bridge {
        @JavascriptInterface
        public void theme(boolean dark) {
            runOnUiThread(() -> applyBars(dark));
        }

        @JavascriptInterface
        public void print(String title) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String name = title == null || title.isEmpty() ? "Wedding Planner" : title;
                pm.print(name, web.createPrintDocumentAdapter(name), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        @JavascriptInterface
        public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("Wedding Planner", text));
                if (Build.VERSION.SDK_INT < 33) toast("Copied");
            });
        }

        @JavascriptInterface
        public void share(String title, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                if (title != null && !title.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, title);
                startActivity(Intent.createChooser(i, title == null || title.isEmpty() ? "Share" : title));
            });
        }

        /** A file the app "downloaded" (CSV, .ics, backup): save it to Downloads, then offer to open it. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            final byte[] data;
            try {
                data = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                runOnUiThread(() -> toast("Couldn’t save the file"));
                return;
            }
            final String safe = name == null ? "download" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            final String type = mime == null || mime.isEmpty() ? mime(safe) : mime.split(";")[0];
            runOnUiThread(() -> {
                try {
                    Uri uri = Build.VERSION.SDK_INT >= 29 ? saveToDownloads(safe, type, data) : ExportProvider.save(MainActivity.this, safe, data);
                    if (Build.VERSION.SDK_INT >= 29) toast("Saved to Downloads: " + safe);
                    Intent open = new Intent(type.equals("text/calendar") ? Intent.ACTION_VIEW : Intent.ACTION_SEND);
                    if (type.equals("text/calendar")) open.setDataAndType(uri, type);
                    else open.setType(type).putExtra(Intent.EXTRA_STREAM, uri);
                    open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    if (type.equals("text/calendar") || Build.VERSION.SDK_INT < 29)
                        startActivity(Intent.createChooser(open, type.equals("text/calendar") ? "Add to calendar" : "Save or share " + safe));
                } catch (Exception e) {
                    toast("Couldn’t save " + safe);
                }
            });
        }
    }

    private Uri saveToDownloads(String name, String mime, byte[] data) throws IOException {
        ContentValues v = new ContentValues();
        v.put(MediaStore.Downloads.DISPLAY_NAME, name);
        v.put(MediaStore.Downloads.MIME_TYPE, mime);
        v.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new IOException("insert failed");
        try (OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IOException("no stream");
            out.write(data);
        }
        v.clear();
        v.put(MediaStore.Downloads.IS_PENDING, 0);
        getContentResolver().update(uri, v, null, null);
        return uri;
    }

    // ------------------------------------------------------------------ lifecycle

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }

    private String version() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Keep the cache small: exported files are only needed while another app reads them. */
    static File exportsDir(Activity a) {
        File d = new File(a.getCacheDir(), "exports");
        //noinspection ResultOfMethodCallIgnored
        d.mkdirs();
        return d;
    }

    static void write(File f, byte[] data) throws IOException {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
    }
}
