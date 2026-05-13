package com.topnotch.overlay

object DownloadEventBus {
    var onProgress: ((jobId: String, pct: Int, downloaded: Long, total: Long, speed: Long, status: String) -> Unit)? = null
    var onNotificationAction: ((jobId: String, action: String) -> Unit)? = null
}
