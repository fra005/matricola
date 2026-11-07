package it.matricola.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Matricola per Android: apre il sito dell'app a schermo intero.
 * I dati restano salvati sul telefono (localStorage della WebView); l'AI e la lettura dei calendari
 * usano le funzioni del sito, quindi serve la connessione a internet.
 */
public class MainActivity extends Activity {
    private static final String HOST = "matricola-primo-anno.netlify.app";
    private static final String START_URL = "https://" + HOST + "/";
    private static final int FILE_CHOOSER = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " MatricolaApp/1.0");

        web.addJavascriptInterface(new Bridge(), "MatricolaAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;   // pagine dell'app: restano qui
                openExternal(u);                                                               // tutto il resto: browser o altre app
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadDataWithBaseURL(null, offlinePage(), "text/html", "utf-8", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");   // i file .ics hanno tipi diversi a seconda del telefono: li accetto tutti, li controlla l'app
                try {
                    startActivityForResult(Intent.createChooser(i, "Scegli il file del calendario"), FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Nessuna app per scegliere i file", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{ data.getData() };
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Nessuna app per aprire questo link", Toast.LENGTH_SHORT).show();
        }
    }

    private String offlinePage() {
        return "<!doctype html><html lang='it'><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{font-family:sans-serif;background:#F5F6FA;color:#18213D;padding:32px 20px;line-height:1.5}"
            + "h1{font-size:1.6rem;background:linear-gradient(transparent 40%,#F3E45A 40%,#F3E45A 90%,transparent 90%);display:inline}"
            + "a{display:inline-block;margin-top:16px;background:#2B47C9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold}</style></head>"
            + "<body><h1>Matricola</h1><p>Non riesco a collegarmi. Controlla la connessione a internet e riprova.</p>"
            + "<a href='" + START_URL + "'>Riprova</a></body></html>";
    }

    /** Ponte usato dalla pagina per salvare file (per esempio le sessioni di studio in .ics). */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(String name, String mime, String content) {
            String safe = name == null ? "matricola.ics" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            try {
                byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
                String where;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime == null ? "text/calendar" : mime);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("insert");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
                    where = "Download";
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, safe);
                    try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                    where = f.getParent();
                }
                final String msg = "Salvato in " + where + ": " + safe;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Non riesco a salvare il file", Toast.LENGTH_LONG).show());
            }
        }
    }
}
