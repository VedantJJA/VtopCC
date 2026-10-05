package com.vtopcc.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.security.KeyStore;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    installVitTrust();
    super.onCreate(savedInstanceState);
  }

  /**
   * VIT's servers send an incomplete certificate chain (missing intermediate), which Android
   * rejects with "Trust anchor for certification path not found". Fall back to accepting the
   * chain only when the leaf certificate belongs to a *.vit.ac.in host; all other hosts use
   * normal system validation.
   */
  private void installVitTrust() {
    try {
      TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
      tmf.init((KeyStore) null);
      final X509TrustManager def = (X509TrustManager) tmf.getTrustManagers()[0];

      X509TrustManager tm = new X509TrustManager() {
        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
          def.checkClientTrusted(chain, authType);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
          try {
            def.checkServerTrusted(chain, authType);
          } catch (CertificateException e) {
            if (chain == null || chain.length == 0) throw e;
            X509Certificate leaf = chain[0];
            String dn = leaf.getSubjectX500Principal().getName().toLowerCase();
            boolean vit = dn.contains("vit.ac.in");
            if (!vit) {
              try {
                if (leaf.getSubjectAlternativeNames() != null) {
                  for (java.util.List<?> san : leaf.getSubjectAlternativeNames()) {
                    if (String.valueOf(san.get(1)).toLowerCase().endsWith("vit.ac.in")) vit = true;
                  }
                }
              } catch (Exception ignored) { }
            }
            if (!vit) throw e;
            leaf.checkValidity();
          }
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
          return def.getAcceptedIssuers();
        }
      };

      SSLContext ctx = SSLContext.getInstance("TLS");
      ctx.init(null, new TrustManager[]{tm}, null);
      HttpsURLConnection.setDefaultSSLSocketFactory(ctx.getSocketFactory());
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}
