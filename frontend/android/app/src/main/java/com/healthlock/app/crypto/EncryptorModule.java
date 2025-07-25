package com.healthlock.crypto;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import android.content.ContentResolver;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;

import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.X509EncodedKeySpec;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class EncryptorModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public EncryptorModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "Encryptor";
    }

    @ReactMethod
    public void encryptFromUri(String contentUri, String base64PublicKey, Promise promise) {
        try {
            Uri uri = Uri.parse(contentUri);
            ContentResolver resolver = reactContext.getContentResolver();
            InputStream inputStream = resolver.openInputStream(uri);

            if (inputStream == null) {
                promise.reject("READ_ERROR", "Unable to open URI: " + contentUri);
                return;
            }

            byte[] fileData = inputStream.readAllBytes(); // API 26+
            inputStream.close();

            // Generate AES Key
            KeyGenerator kgen = KeyGenerator.getInstance("AES");
            kgen.init(256);
            SecretKey aesKey = kgen.generateKey();

            byte[] nonce = new byte[12];
            new SecureRandom().nextBytes(nonce);

            Cipher aesCipher = Cipher.getInstance("AES/GCM/NoPadding");
            aesCipher.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(128, nonce));
            byte[] ciphertext = aesCipher.doFinal(fileData);

            byte[] derPub = Base64.decode(base64PublicKey, Base64.NO_WRAP);
            PublicKey pub = KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(derPub));

            Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            rsaCipher.init(Cipher.ENCRYPT_MODE, pub);
            byte[] encryptedKey = rsaCipher.doFinal(aesKey.getEncoded());

            WritableMap result = Arguments.createMap();
            result.putString("encrypted_aes_key", Base64.encodeToString(encryptedKey, Base64.NO_WRAP));
            result.putString("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
            result.putString("nonce", Base64.encodeToString(nonce, Base64.NO_WRAP));

            promise.resolve(result);

        } catch (Exception e) {
            promise.reject("ENCRYPTION_ERROR", e.getMessage(), e);
        }
    }
}
