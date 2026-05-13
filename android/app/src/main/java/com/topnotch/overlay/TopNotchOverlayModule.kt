package com.topnotch.overlay

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class TopNotchOverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME                    = "TopNotchOverlay"
        const val EVENT_PROGRESS          = "TopNotch_DownloadProgress"
        const val EVENT_NOTIFICATION_ACTION = "TopNotch_NotificationAction"
    }

    private val wm: WindowManager by lazy {
        reactApplicationContext.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
    }
    private var ringView: CameraRingView? = null

    private var cfgColor:     Int     = Color.parseColor("#7c5cbf")
    private var cfgThickness: Float   = 6f
    private var cfgGlow:      Boolean = false

    init {
        DownloadEventBus.onProgress = { jobId, pct, downloaded, total, speed, status ->
            sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                putString("jobId", jobId)
                putInt("percent", pct)
                putDouble("downloadedBytes", downloaded.toDouble())
                putDouble("totalBytes", total.toDouble())
                putDouble("speed", speed.toDouble())
                putString("status", status)
            })
        }
        DownloadEventBus.onNotificationAction = { jobId, action ->
            sendEvent(EVENT_NOTIFICATION_ACTION, Arguments.createMap().apply {
                putString("jobId", jobId)
                putString("action", action)
            })
        }
    }

    override fun getName() = NAME

    override fun onCatalystInstanceDestroy() {
        DownloadEventBus.onProgress          = null
        DownloadEventBus.onNotificationAction = null
        UiThreadUtil.runOnUiThread { removeOverlay() }
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (Settings.canDrawOverlays(reactApplicationContext)) { promise.resolve(true); return }
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:${reactApplicationContext.packageName}")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        reactApplicationContext.startActivity(intent)
        promise.resolve(false)
    }

    @ReactMethod
    fun hasNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) { promise.resolve(true); return }
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext, android.Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) { promise.resolve(true); return }
        val activity = currentActivity ?: run { promise.resolve(false); return }
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
            1001
        )
        promise.resolve(false)
    }

    // ── Overlay ring ──────────────────────────────────────────────────────────

    @ReactMethod
    fun showCameraOverlay(progress: Float, colorHex: String) {
        if (!Settings.canDrawOverlays(reactApplicationContext)) return
        val color = try { Color.parseColor(colorHex) } catch (_: Exception) { cfgColor }
        cfgColor = color
        UiThreadUtil.runOnUiThread {
            if (ringView == null) addOverlay()
            ringView?.progress    = progress
            ringView?.accentColor = color
        }
    }

    @ReactMethod
    fun hideCameraOverlay() {
        UiThreadUtil.runOnUiThread { removeOverlay() }
    }

    // ── Download control ──────────────────────────────────────────────────────

    @ReactMethod
    fun startDownload(jobId: String, jobName: String, url: String, totalBytes: Double) {
        val intent = Intent(reactApplicationContext, DownloadOverlayService::class.java).apply {
            action = DownloadOverlayService.ACTION_START
            putExtra("jobId", jobId)
            putExtra("jobName", jobName)
            putExtra("url", url)
            putExtra("totalBytes", totalBytes.toLong())
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            reactApplicationContext.startForegroundService(intent)
        else
            reactApplicationContext.startService(intent)
    }

    @ReactMethod
    fun pauseDownload(jobId: String) = startServiceAction(DownloadOverlayService.ACTION_PAUSE, jobId)

    @ReactMethod
    fun resumeDownload(jobId: String) = startServiceAction(DownloadOverlayService.ACTION_RESUME, jobId)

    @ReactMethod
    fun cancelDownload(jobId: String) = startServiceAction(DownloadOverlayService.ACTION_CANCEL, jobId)

    // ── Config ────────────────────────────────────────────────────────────────

    @ReactMethod
    fun applyConfig(configJson: String) {
        try {
            val cfg = JSONObject(configJson)
            cfg.optString("accentColor").takeIf { it.isNotEmpty() }
                ?.let { try { cfgColor = Color.parseColor(it) } catch (_: Exception) {} }
            cfgThickness = cfg.optDouble("ringThickness", cfgThickness.toDouble()).toFloat()
            cfgGlow      = cfg.optBoolean("glow", cfgGlow)
            UiThreadUtil.runOnUiThread {
                ringView?.accentColor  = cfgColor
                ringView?.strokeWidth  = cfgThickness
                ringView?.glowEnabled  = cfgGlow
            }
        } catch (_: Exception) {}
    }

    // Legacy stubs kept for JS compatibility
    @ReactMethod fun startForegroundService(jobId: String, jobName: String, totalBytes: Double) {}
    @ReactMethod fun stopForegroundService(jobId: String)  { hideCameraOverlay() }
    @ReactMethod fun updateProgress(jobId: String, percent: Int, downloadedBytes: Double,
                                    totalBytes: Double, speed: Double, status: String) {
        UiThreadUtil.runOnUiThread { ringView?.progress = percent / 100f }
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private fun addOverlay() {
        if (ringView != null) return
        val density = reactApplicationContext.resources.displayMetrics.density
        val sizePx  = (80 * density).toInt()
        val (cx, cy) = getCameraCenter()

        val params = WindowManager.LayoutParams(
            sizePx, sizePx,
            cx - sizePx / 2, cy - sizePx / 2,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START }

        val v = CameraRingView(reactApplicationContext).apply {
            accentColor = cfgColor
            strokeWidth = cfgThickness
            glowEnabled = cfgGlow
        }
        try { wm.addView(v, params); ringView = v } catch (_: Exception) {}
    }

    private fun removeOverlay() {
        ringView?.let { try { wm.removeView(it) } catch (_: Exception) {} }
        ringView = null
    }

    private fun getCameraCenter(): Pair<Int, Int> {
        val m = reactApplicationContext.resources.displayMetrics
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val cutout = wm.defaultDisplay.cutout
            val rect   = cutout?.boundingRects?.firstOrNull()
            if (rect != null) return Pair(rect.centerX(), rect.centerY())
        }
        val sbId = reactApplicationContext.resources.getIdentifier("status_bar_height", "dimen", "android")
        val sbH  = if (sbId > 0) reactApplicationContext.resources.getDimensionPixelSize(sbId)
                   else (24 * m.density).toInt()
        return Pair(m.widthPixels / 2, sbH / 2)
    }

    private fun startServiceAction(action: String, jobId: String) {
        reactApplicationContext.startService(
            Intent(reactApplicationContext, DownloadOverlayService::class.java).apply {
                this.action = action; putExtra("jobId", jobId)
            })
    }

    private fun sendEvent(name: String, params: WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, params)
        } catch (_: Exception) {}
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
