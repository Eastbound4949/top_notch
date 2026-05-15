package com.topnotch.overlay

import android.content.Context
import android.graphics.*
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs

class CameraRingView(context: Context) : View(context) {

    var onGesture: ((String) -> Unit)? = null

    private val gestureDetector = GestureDetector(context,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                onGesture?.invoke("single")
                return true
            }
            override fun onLongPress(e: MotionEvent) {
                onGesture?.invoke("long")
            }
            override fun onDoubleTap(e: MotionEvent): Boolean {
                onGesture?.invoke("double")
                return true
            }
            override fun onFling(
                e1: MotionEvent?,
                e2: MotionEvent,
                velocityX: Float,
                velocityY: Float,
            ): Boolean {
                val dx = e2.x - (e1?.x ?: 0f)
                if (abs(dx) > 80 && abs(velocityX) > 150) {
                    onGesture?.invoke(if (dx < 0) "swipeRL" else "swipeLR")
                    return true
                }
                return false
            }
        }
    )

    override fun onTouchEvent(event: MotionEvent): Boolean {
        gestureDetector.onTouchEvent(event)
        return true
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        maskFilter = BlurMaskFilter(14f, BlurMaskFilter.Blur.NORMAL)
    }

    var progress: Float = 0f
        set(v) { field = v.coerceIn(0f, 1f); invalidate() }

    var accentColor: Int = Color.parseColor("#7c5cbf")
        set(v) {
            field = v
            progressPaint.color = v
            glowPaint.color = v
            trackPaint.color = Color.argb(35, Color.red(v), Color.green(v), Color.blue(v))
            invalidate()
        }

    var strokeWidth: Float = 6f
        set(v) {
            field = v
            progressPaint.strokeWidth = v
            trackPaint.strokeWidth = v
            glowPaint.strokeWidth = v * 2.2f
            invalidate()
        }

    var glowEnabled: Boolean = false

    private val oval = RectF()

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
        accentColor = Color.parseColor("#7c5cbf")
        strokeWidth = 6f
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = minOf(cx, cy) - strokeWidth / 2f - 2f
        oval.set(cx - r, cy - r, cx + r, cy + r)

        canvas.drawArc(oval, 0f, 360f, false, trackPaint)

        if (progress > 0.005f) {
            if (glowEnabled) canvas.drawArc(oval, -90f, progress * 360f, false, glowPaint)
            canvas.drawArc(oval, -90f, progress * 360f, false, progressPaint)
        }
    }
}
