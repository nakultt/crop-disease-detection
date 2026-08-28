package com.plantguard.app.ui

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Destination files for `ActivityResultContracts.TakePicture`.
 *
 * The contract hands the camera app a URI to write into, which means the file
 * must exist and be shareable first. Everything lands in the app's own cache
 * directory and is exposed through a `FileProvider`, so no storage permission
 * is involved and nothing is written to the shared gallery.
 */
object CameraCapture {

    private const val CAPTURE_DIR = "captures"

    fun newImageUri(context: Context): Uri {
        val directory = File(context.cacheDir, CAPTURE_DIR).apply { mkdirs() }

        // Each capture gets its own file; reusing one name races with the
        // camera app still holding the previous handle.
        val file = File.createTempFile("capture_", ".jpg", directory)

        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
    }

    /**
     * Delete captures from earlier sessions.
     *
     * They are only needed until the bitmap is decoded, and the cache directory
     * would otherwise grow with every photograph taken.
     */
    fun clearOldCaptures(context: Context) {
        val directory = File(context.cacheDir, CAPTURE_DIR)
        if (!directory.isDirectory) return
        directory.listFiles()?.forEach { it.delete() }
    }
}
