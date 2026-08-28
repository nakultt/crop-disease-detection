# Keep ONNX Runtime JNI entry points; they are reached reflectively.
-keep class ai.onnxruntime.** { *; }
-dontwarn ai.onnxruntime.**
