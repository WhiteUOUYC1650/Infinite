package com.infinite.chat;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhoneNumbersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
