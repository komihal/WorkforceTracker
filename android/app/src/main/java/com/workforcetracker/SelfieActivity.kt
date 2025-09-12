package com.workforcetracker

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageButton
import androidx.activity.ComponentActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale

class SelfieActivity : ComponentActivity() {
  private lateinit var previewView: PreviewView
  private var imageCapture: ImageCapture? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    previewView = PreviewView(this)
    previewView.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )

    val captureBtn = ImageButton(this).apply {
      setImageResource(android.R.drawable.ic_menu_camera)
      background = null
      alpha = 0.9f
      setOnClickListener { takePhoto() }
    }
    val root = FrameLayout(this)
    root.addView(previewView)
    val btnParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    )
    btnParams.marginStart = 0
    btnParams.bottomMargin = 48
    btnParams.gravity = android.view.Gravity.BOTTOM or android.view.Gravity.CENTER_HORIZONTAL
    root.addView(captureBtn, btnParams)
    setContentView(root)

    if (allPermissionsGranted()) {
      startCamera()
    } else {
      ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, REQUEST_CODE_PERMISSIONS)
    }
  }

  private fun allPermissionsGranted(): Boolean {
    val perm = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
    return perm == PackageManager.PERMISSION_GRANTED
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_CODE_PERMISSIONS) {
      if (allPermissionsGranted()) {
        startCamera()
      } else {
        setResult(Activity.RESULT_CANCELED)
        finish()
      }
    }
  }

  private fun startCamera() {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
    cameraProviderFuture.addListener({
      val cameraProvider = cameraProviderFuture.get()
      val preview = Preview.Builder().build().also {
        it.setSurfaceProvider(previewView.surfaceProvider)
      }

      imageCapture = ImageCapture.Builder()
        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
        .build()

      val cameraSelector = CameraSelector.Builder()
        .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
        .build()

      try {
        cameraProvider.unbindAll()
        cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture)
      } catch (e: Exception) {
        Log.e(TAG, "Use case binding failed", e)
        setResult(Activity.RESULT_CANCELED)
        finish()
      }
    }, ContextCompat.getMainExecutor(this))
  }

  private fun takePhoto() {
    val imageCapture = imageCapture ?: return
    val photoFile = createImageFile()
    val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
    imageCapture.takePicture(outputOptions, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
      override fun onError(exception: ImageCaptureException) {
        Log.e(TAG, "Photo capture failed: ${exception.message}", exception)
        setResult(Activity.RESULT_CANCELED)
        finish()
      }

      override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
        val uri = Uri.fromFile(photoFile)
        val data = intent
        data.putExtra("uri", uri.toString())
        data.putExtra("type", "image/jpeg")
        data.putExtra("fileName", photoFile.name)
        setResult(Activity.RESULT_OK, data)
        finish()
      }
    })
  }

  private fun createImageFile(): File {
    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
    val fileName = "selfie_${timeStamp}.jpg"
    val dir = externalCacheDir ?: cacheDir
    return File(dir, fileName)
  }

  companion object {
    private const val TAG = "SelfieActivity"
    private const val REQUEST_CODE_PERMISSIONS = 2001
    private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
  }
}


