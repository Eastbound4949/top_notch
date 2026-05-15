package com.topnotch.overlay

import android.content.Context
import android.graphics.*
import android.view.View

class LinearProgressView(context: Context) : View(context) {

    var progress: Float = 0f
        set(v) { field = v.coerceIn(0f, 1f); invalidate() }

    var accentColor: Int = Color.parseColor("#7c5cbf")
        set(v) {
            field = v
            fillPaint.color = v
            trackPaint.color = Color.argb(35, Color.red(v), Color.green(v), Color.blue(v))
            invalidate()
        }

    var rounded: Boolean = true
    var glowEnabled: Boolean = false

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#7c5cbf")
    }
    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(35, 124, 92, 191)
    }
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        maskFilter = BlurMaskFilter(10f, BlurMaskFilter.Blur.NORMAL)
    }

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
        accentColor = Color.parseColor("#7c5cbf")
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val r = if (rounded) h / 2f else 0f
        val fillW = w * progress

        // Track
        canvas.drawRoundRect(0f, 0f, w, h, r, r, trackPaint)

        // Glow behind fill
        if (glowEnabled && fillW > 0) {
            glowPaint.color = Color.argb(80, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
            canvas.drawRoundRect(0f, -h * 0.5f, fillW + h, h * 1.5f, r, r, glowPaint)
        }

        // Fill
        if (progress > 0.005f) {
            canvas.drawRoundRect(0f, 0f, fillW, h, r, r, fillPaint)
        }
    }
}
