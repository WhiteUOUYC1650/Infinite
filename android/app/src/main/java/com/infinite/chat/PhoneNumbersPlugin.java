package com.infinite.chat;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

@CapacitorPlugin(
    name = "PhoneNumbers",
    permissions = {
        @Permission(
            alias = "phone",
            strings = { Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_PHONE_NUMBERS }
        )
    }
)
public class PhoneNumbersPlugin extends Plugin {

    @PluginMethod
    public void getSimNumbers(PluginCall call) {
        if (!hasPhonePermission()) {
            requestPermissionForAlias("phone", call, "phonePermissionCallback");
            return;
        }
        resolveSimNumbers(call);
    }

    @PermissionCallback
    private void phonePermissionCallback(PluginCall call) {
        if (!hasPhonePermission()) {
            call.reject("Phone permission denied");
            return;
        }
        resolveSimNumbers(call);
    }

    private boolean hasPhonePermission() {
        boolean state = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return state;
        }
        boolean numbers = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED;
        return state && numbers;
    }

    private void resolveSimNumbers(PluginCall call) {
        JSArray numbers = new JSArray();
        try {
            SubscriptionManager subscriptionManager = (SubscriptionManager) getContext().getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (subscriptionManager != null) {
                List<SubscriptionInfo> subscriptions = subscriptionManager.getActiveSubscriptionInfoList();
                if (subscriptions != null) {
                    for (SubscriptionInfo info : subscriptions) {
                        String number = readSubscriptionNumber(subscriptionManager, info);
                        JSObject entry = new JSObject();
                        entry.put("slot", info.getSimSlotIndex());
                        entry.put("number", number == null ? "" : number);
                        entry.put("carrier", info.getCarrierName() == null ? "" : info.getCarrierName().toString());
                        numbers.put(entry);
                    }
                }
            }
            if (numbers.length() == 0) {
                TelephonyManager telephonyManager = (TelephonyManager) getContext().getSystemService(android.content.Context.TELEPHONY_SERVICE);
                if (telephonyManager != null) {
                    String number = telephonyManager.getLine1Number();
                    if (number != null && !number.isEmpty()) {
                        JSObject entry = new JSObject();
                        entry.put("slot", 0);
                        entry.put("number", number);
                        entry.put("carrier", telephonyManager.getNetworkOperatorName());
                        numbers.put(entry);
                    }
                }
            }
        } catch (SecurityException e) {
            call.reject("Phone permission denied", e);
            return;
        }

        JSObject result = new JSObject();
        result.put("numbers", numbers);
        call.resolve(result);
    }

    private String readSubscriptionNumber(SubscriptionManager subscriptionManager, SubscriptionInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            String number = subscriptionManager.getPhoneNumber(info.getSubscriptionId());
            if (number != null && !number.isEmpty()) return number;
        }
        return info.getNumber();
    }
}
