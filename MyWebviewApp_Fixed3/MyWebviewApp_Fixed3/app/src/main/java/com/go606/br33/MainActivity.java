package com.go606.br33;

import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.DisplayMetrics;
import android.webkit.*;
import androidx.appcompat.app.AppCompatActivity;
import com.adjust.sdk.Adjust;
import com.adjust.sdk.AdjustConfig;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onResume() {
        super.onResume();
        Adjust.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        Adjust.onPause();
    }

    // 固定字体
    @Override
    public void applyOverrideConfiguration(Configuration overrideConfiguration) {
        if (overrideConfiguration != null) {
            overrideConfiguration.fontScale = 1.0f;
        }
        super.applyOverrideConfiguration(overrideConfiguration);
    }

    // 固定显示密度
    @Override
    protected void attachBaseContext(Context newBase) {
        Configuration config = newBase.getResources().getConfiguration();
        config.fontScale = 1.0f;
        config.densityDpi = DisplayMetrics.DENSITY_DEVICE_STABLE;
        Context context = newBase.createConfigurationContext(config);
        super.attachBaseContext(context);
    }

    @Override
    protected void onCreate(Bundle b){
        super.onCreate(b);
        setContentView(R.layout.activity_main);

        // ★★ 动态 Adjust Token ★★
        String adjustToken = getString(R.string.backend_adjust_token);
        AdjustConfig config = new AdjustConfig(getApplicationContext(), adjustToken, AdjustConfig.ENVIRONMENT_PRODUCTION);
        Adjust.onCreate(config);

        final WebView w = findViewById(R.id.webview);

        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setTextZoom(100);

        JsInterface jsInterface = new JsInterface(this);
        w.addJavascriptInterface(jsInterface, "jsBridge");

        // WebViewClient：内部链接在 WebView 打开，外链使用外部 Intent
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return handleUrl(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String urlRaw) {
                if (urlRaw == null) return false;
                return handleUrl(view, urlRaw);
            }

            private boolean handleUrl(WebView view, String urlRaw) {
                if (urlRaw == null) return false;
                String url = urlRaw.trim();

                if (url.contains("3go606.com") || url.contains("go606.com") || url.contains("1go606.com")) {
                    return false;
                }

                openExternal(url);
                return true;
            }
        });

        // WebChromeClient：处理 target="_blank"
        w.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                                          boolean isUserGesture, Message resultMsg) {

                WebView newWebView = new WebView(MainActivity.this);

                WebSettings ns = newWebView.getSettings();
                ns.setJavaScriptEnabled(true);
                ns.setDomStorageEnabled(true);
                ns.setJavaScriptCanOpenWindowsAutomatically(true);
                ns.setSupportMultipleWindows(true);
                ns.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

                newWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        return handleNewWebViewUrl(request.getUrl().toString());
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        return handleNewWebViewUrl(url);
                    }

                    private boolean handleNewWebViewUrl(String url) {
                        if (url == null) return false;

                        if (url.matches(".*\\.(png|jpg|jpeg)(\\?.*)?$")) {
                            openExternal(url);
                            return true;
                        }

                        if (url.contains("3go606.com") || url.contains("go606.com") || url.contains("1go606.com")) {
                            runOnUiThread(() -> w.loadUrl(url));
                            return true;
                        }

                        openExternal(url);
                        return true;
                    }
                });

                newWebView.setWebChromeClient(new WebChromeClient());

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // ★★ 动态加载 H5 URL ★★
        String url = getString(R.string.backend_web_url);
w.loadUrl(url);
    }

    // 外部跳转（APP 优先）
    private void openExternal(String url) {

        if (url == null || url.isEmpty()) return;

        String appUrl = buildAppLink(url);

        try {
            Intent appIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(appUrl));
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(appIntent);
            return;
        } catch (Exception ignored) {}

        try {
            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(webIntent);
        } catch (Exception ignored) {}
    }

    // 转换 APP Scheme
    private String buildAppLink(String url) {

        if (url == null) return url;

        if (url.contains("t.me/")) {
            String user = url.substring(url.lastIndexOf("/") + 1);
            return "tg://resolve?domain=" + user;
        }

        if (url.contains("facebook.com/")) {
            return "fb://facewebmodal/f?href=" + url;
        }

        if (url.contains("instagram.com/")) {
            String user = url.substring(url.indexOf(".com/") + 5).split("[/?]")[0];
            return "instagram://user?username=" + user;
        }

        if (url.contains("whatsapp.com/channel/")) {
            return url;
        }

        if (url.contains("x.com/") || url.contains("twitter.com/")) {
            String user = url.substring(url.lastIndexOf("/") + 1).split("\\?")[0];
            return "twitter://user?screen_name=" + user;
        }

        return url;
    }
}
