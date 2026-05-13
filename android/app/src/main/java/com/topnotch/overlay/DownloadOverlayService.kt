package com.topnotch.overlay

import android.app.*
import android.content.Intent
import android.graphics.Color
import android.os.*
import androidx.core.app.NotificationCompat
import com.topnotch.progress.R
import java.io.*
import java.net.HttpURLConnection
import java.net.URL

class DownloadOverlayService : Service() {

    companion object {
        const val ACTION_START  = "com.topnotch.overlay.ACTION_START"
        const val ACTION_PAUSE  = "com.topnotch.overlay.ACTION_PAUSE"
        const val ACTION_RESUME = "com.topnotch.overlay.ACTION_RESUME"
        const val ACTION_CANCEL = "com.topnotch.overlay.ACTION_CANCEL"
        const val ACTION_STOP   = "com.topnotch.overlay.ACTION_STOP"

        private const val CHANNEL_ID      = "topnotch_dl"
        private const val NOTIFICATION_ID = 1001
    }

    private val threads       = HashMap<String, Thread>()
    private val savedBytes    = HashMap<String, Long>()
    private val totalBytesMap = HashMap<String, Long>()
    private val jobNames      = HashMap<String, String>()
    private val jobUrls       = HashMap<String, String>()

    private var lastNotifKey = ""

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobId = intent?.getStringExtra("jobId")
        when (intent?.action) {
            ACTION_START -> {
                if (jobId == null) return START_STICKY
                jobNames[jobId]      = intent.getStringExtra("jobName") ?: "Download"
                jobUrls[jobId]       = intent.getStringExtra("url")     ?: return START_STICKY
                totalBytesMap[jobId] = intent.getLongExtra("totalBytes", 0L)
                savedBytes[jobId]    = 0L
                val notif = buildNotif(jobId, 0, 0L, "downloading")
                if (Build.VERSION.SDK_INT >= 34) {
                    startForeground(NOTIFICATION_ID, notif,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } else {
                    startForeground(NOTIFICATION_ID, notif)
                }
                launchThread(jobId)
            }
            ACTION_PAUSE -> {
                if (jobId == null) return START_STICKY
                threads[jobId]?.interrupt()
                DownloadEventBus.onNotificationAction?.invoke(jobId, "pause")
                updateNotif(jobId, notifPct(jobId), 0L, "paused")
            }
            ACTION_RESUME -> {
                if (jobId == null) return START_STICKY
                launchThread(jobId)
                DownloadEventBus.onNotificationAction?.invoke(jobId, "resume")
            }
            ACTION_CANCEL -> {
                if (jobId == null) return START_STICKY
                threads[jobId]?.interrupt()
                savedBytes.remove(jobId)
                getPartialFile(jobId).delete()
                DownloadEventBus.onNotificationAction?.invoke(jobId, "cancel")
                if (threads.isEmpty()) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
            }
            ACTION_STOP -> {
                threads.values.forEach { it.interrupt() }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun launchThread(jobId: String) {
        threads[jobId]?.interrupt()

        val thread = Thread {
            var conn: HttpURLConnection? = null
            var input: InputStream?      = null
            var output: OutputStream?    = null
            try {
                val url   = jobUrls[jobId] ?: return@Thread
                val start = savedBytes[jobId] ?: 0L

                conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout    = 30_000
                if (start > 0) conn.setRequestProperty("Range", "bytes=$start-")
                conn.connect()

                val code   = conn.responseCode
                val remote = conn.contentLengthLong.takeIf { it > 0 } ?: 0L
                val total  = when {
                    code == 206 && start > 0 -> start + remote
                    remote > 0              -> remote
                    else                    -> totalBytesMap[jobId] ?: 0L
                }
                if (total > 0) totalBytesMap[jobId] = total

                val file   = getPartialFile(jobId)
                output = FileOutputStream(file, code == 206 && start > 0)
                input  = conn.inputStream

                val buf             = ByteArray(65_536)
                var downloaded      = start
                var lastReportMs    = System.currentTimeMillis()
                var lastReportBytes = downloaded

                var n: Int
                while (input.read(buf).also { n = it } != -1) {
                    if (Thread.interrupted()) throw InterruptedException()
                    output.write(buf, 0, n)
                    downloaded += n
                    savedBytes[jobId] = downloaded

                    val now = System.currentTimeMillis()
                    if (now - lastReportMs >= 400L) {
                        val elapsed = (now - lastReportMs) / 1000.0
                        val speed   = ((downloaded - lastReportBytes) / elapsed).toLong()
                        val pct     = if (total > 0) ((downloaded * 100) / total).toInt() else 0
                        report(jobId, pct, downloaded, total, speed, "downloading")
                        updateNotif(jobId, pct, speed, "downloading")
                        lastReportMs    = now
                        lastReportBytes = downloaded
                    }
                }

                val finalTotal = totalBytesMap[jobId] ?: downloaded
                savedBytes.remove(jobId)
                report(jobId, 100, finalTotal, finalTotal, 0L, "completed")
                updateNotif(jobId, 100, 0L, "completed")

            } catch (_: InterruptedException) {
                // paused / cancelled — savedBytes already holds resume position
            } catch (e: Exception) {
                report(jobId, 0, savedBytes[jobId] ?: 0L, totalBytesMap[jobId] ?: 0L, 0L, "error")
                updateNotif(jobId, 0, 0L, "error")
            } finally {
                try { output?.close() } catch (_: Exception) {}
                try { input?.close()  } catch (_: Exception) {}
                try { conn?.disconnect() } catch (_: Exception) {}
                threads.remove(jobId)
            }
        }
        threads[jobId] = thread
        thread.start()
    }

    private fun report(jobId: String, pct: Int, downloaded: Long, total: Long, speed: Long, status: String) {
        DownloadEventBus.onProgress?.invoke(jobId, pct, downloaded, total, speed, status)
    }

    private fun notifPct(jobId: String): Int {
        val d = savedBytes[jobId] ?: 0L
        val t = totalBytesMap[jobId] ?: 0L
        return if (t > 0) ((d * 100) / t).toInt() else 0
    }

    private fun updateNotif(jobId: String, pct: Int, speed: Long, status: String) {
        val key = "$jobId:$pct:$status"
        if (key == lastNotifKey) return
        lastNotifKey = key
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotif(jobId, pct, speed, status))
    }

    private fun buildNotif(jobId: String, pct: Int, speed: Long, status: String): Notification {
        val name = jobNames[jobId] ?: "Download"
        val sub  = when (status) {
            "completed" -> "Complete"
            "paused"    -> "Paused · $pct%"
            "error"     -> "Failed"
            else        -> if (speed > 0) "$pct% · ${fmtSpeed(speed)}" else "$pct%"
        }

        fun svcIntent(action: String) = PendingIntent.getService(
            this, action.hashCode(),
            Intent(this, DownloadOverlayService::class.java).apply {
                this.action = action; putExtra("jobId", jobId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(name)
            .setContentText(sub)
            .setProgress(100, pct, false)
            .setOngoing(status == "downloading" || status == "paused")
            .setOnlyAlertOnce(true)
            .setColor(Color.parseColor("#7c5cbf"))
            .apply {
                if (status == "downloading") addAction(0, "Pause",  svcIntent(ACTION_PAUSE))
                if (status == "paused")      addAction(0, "Resume", svcIntent(ACTION_RESUME))
                if (status != "completed")   addAction(0, "Cancel", svcIntent(ACTION_CANCEL))
            }
            .build()
    }

    private fun getPartialFile(jobId: String) =
        File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "$jobId.partial")

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Top Notch download progress"
                setShowBadge(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    private fun fmtSpeed(bps: Long) = when {
        bps < 1_024       -> "${bps} B/s"
        bps < 1_048_576   -> "${bps / 1_024} KB/s"
        else              -> "${"%.1f".format(bps / 1_048_576f)} MB/s"
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
