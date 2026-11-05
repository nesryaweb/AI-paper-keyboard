"use client";

import { useEffect, useRef, useState } from "react";
import * as tmImage from "@teachablemachine/image";
import {
  Keyboard,
  Camera,
  Trash2,
  Copy,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Brain,
  CheckCircle2,
} from "lucide-react";

const SETTINGS_KEY = "keyboard-ai-settings";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function normalizeLabel(label) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
}

export default function Home() {
  const [typedText, setTypedText] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraChooser, setCameraChooser] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [copied, setCopied] = useState(false);

  const [aiStatus, setAiStatus] = useState("Not connected");
  const [recognizedKey, setRecognizedKey] = useState("--");
  const [confidence, setConfidence] = useState(0);
  const [trainedLetters, setTrainedLetters] = useState([]);
  const [modelReady, setModelReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const predictionLoopRef = useRef(false);
  const acceptedKeyRef = useRef(false);
  const settingsRef = useRef(null);

  async function openCameraChooser() {
    setCameraError("");
    setLoadingCameras(true);

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );

      setCameras(videoDevices);
      setCameraChooser(true);

      if (!videoDevices.length) {
        setCameraError("No cameras were detected.");
      }
    } catch {
      setCameraError("Camera permission was denied or no camera is available.");
    } finally {
      setLoadingCameras(false);
    }
  }

  async function startSelectedCamera(deviceId) {
    setCameraError("");
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      streamRef.current = stream;
      setSelectedCamera(deviceId);
      setCameraActive(true);
      setCameraChooser(false);
      acceptedKeyRef.current = false;
    } catch {
      setCameraError("Could not start this camera. Please try another one.");
    }
  }

  function stopCamera() {
    predictionLoopRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraActive(false);
    setRecognizedKey("--");
    setConfidence(0);
    setAiStatus("Camera stopped");
  }

  async function refreshCameras() {
    setLoadingCameras(true);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((device) => device.kind === "videoinput"));
    } catch {
      setCameraError("Unable to refresh cameras.");
    } finally {
      setLoadingCameras(false);
    }
  }

  async function copyText() {
    if (!typedText) return;

    try {
      await navigator.clipboard.writeText(typedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCameraError("Unable to copy text.");
    }
  }

  async function loadSavedModel() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (!saved) {
        setAiStatus("No model configured");
        setModelReady(false);
        return;
      }

      const settings = JSON.parse(saved);

      if (!settings.modelUrl) {
        setAiStatus("No model configured");
        setModelReady(false);
        return;
      }

      setAiStatus("Loading AI model...");

      const url = settings.modelUrl.endsWith("/")
        ? settings.modelUrl
        : `${settings.modelUrl}/`;

      const model = await tmImage.load(
        `${url}model.json`,
        `${url}metadata.json`,
      );

      modelRef.current = model;
      settingsRef.current = settings;

      const labels = model.getClassLabels();

      const letters = labels
        .map((label) => label.trim().toUpperCase())
        .filter((label) => /^[A-Z]$/.test(label));

      setTrainedLetters(letters);
      setModelReady(true);
      setAiStatus("AI model ready");
    } catch (error) {
      console.error(error);
      modelRef.current = null;
      setModelReady(false);
      setAiStatus("Could not load model");
    }
  }

  useEffect(() => {
    if (!cameraActive) return;

    let running = true;
    let timeoutId;

    async function setup() {
      if (!streamRef.current || !videoRef.current) return;

      const video = videoRef.current;
      video.srcObject = streamRef.current;

      try {
        await video.play();
      } catch (error) {
        console.error("Video playback error:", error);
      }

      if (!running) return;

      if (!modelRef.current) {
        await loadSavedModel();
      }

      if (!running) return;

      if (!modelRef.current) {
        setAiStatus("Configure model in Admin");
        return;
      }

      setAiStatus("Recognizing keys");
      predictionLoopRef.current = true;

      async function predict() {
        if (!running || !predictionLoopRef.current) return;

        try {
          if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            const predictions = await modelRef.current.predict(video);

            if (!running) return;

            const best = predictions.reduce((a, b) =>
              a.probability > b.probability ? a : b,
            );

            const bestLabel = best.className;
            const bestConfidence = best.probability;
            const threshold = (settingsRef.current?.confidence ?? 85) / 100;

            setRecognizedKey(bestLabel);
            setConfidence(Math.round(bestConfidence * 100));

            const normalized = normalizeLabel(bestLabel);

            if (
              normalized === "NOHAND" ||
              normalized === "NONE" ||
              normalized === "NOTOUCH"
            ) {
              acceptedKeyRef.current = false;
              setAiStatus("Ready for next touch");
            } else if (
              /^[A-Z]$/.test(bestLabel.trim().toUpperCase()) &&
              bestConfidence >= threshold
            ) {
              if (!acceptedKeyRef.current) {
                setTypedText(
                  (previous) => previous + bestLabel.trim().toUpperCase(),
                );
                acceptedKeyRef.current = true;
              }

              setAiStatus("Key recognized");
            } else {
              setAiStatus("Looking for a key...");
            }
          }
        } catch (error) {
          console.error("Prediction error:", error);
          setAiStatus("Recognition error");
        }

        if (running && predictionLoopRef.current) {
          timeoutId = setTimeout(predict, 180);
        }
      }

      predict();
    }

    setup();

    return () => {
      running = false;
      predictionLoopRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [cameraActive]);

  useEffect(() => {
    loadSavedModel();

    function handleShortcut(event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
        window.location.href = "/admin";
      }
    }

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const selectedCameraName =
    cameras.find((camera) => camera.deviceId === selectedCamera)?.label ||
    "Selected camera";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-l from-[#fce8d5] via-[#fffbf5] to-[#dce9fc] text-[#0d1117]">
      {/* Soft decorative gradient glows */}
      <div className="pointer-events-none fixed -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#f4b47e]/20 blur-[120px]" />
      <div className="pointer-events-none fixed -right-40 top-[25%] h-[450px] w-[450px] rounded-full bg-[#6fa3f5]/15 blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-40 left-[30%] h-[450px] w-[450px] rounded-full bg-[#f4b47e]/10 blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-5 md:px-10 md:py-7">
        <header className="mb-5 text-center">
          <div className="mb-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.2em] text-[#e6840a]">
            <Sparkles size={14} />
            ARTIFICIAL INTELLIGENCE IN ACTION
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-semibold md:text-4xl">
            Watch <span className="text-[#e6840a]">AI</span> Turn Touches Into{" "}
            <span className="text-[#174ea6]">Text</span>
          </h1>

          <p className="mt-1 text-sm text-[#68717d]">
            Touch a paper key. Let artificial intelligence recognize it.
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-[#0d1117]/5 backdrop-blur-md md:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d1117] text-white">
                <Keyboard size={19} />
              </div>

              <div>
                <h2 className="font-semibold">Your AI Keyboard</h2>
                <p className="text-xs text-[#68717d]">
                  Recognized letters appear here
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyText}
                disabled={!typedText}
                className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm transition hover:bg-[#fffbf5] disabled:opacity-40"
              >
                <Copy size={15} />
                {copied ? "Copied!" : "Copy"}
              </button>

              <button
                onClick={() => setTypedText("")}
                disabled={!typedText}
                className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm transition hover:bg-[#fffbf5] disabled:opacity-40"
              >
                <Trash2 size={15} />
                Clear
              </button>
            </div>
          </div>

          <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-[#6fa3f5] bg-[#f1f6ff]/90 p-6 md:min-h-[300px]">
            {typedText ? (
              <p className="w-full break-words text-center font-serif text-5xl font-semibold leading-relaxed tracking-wider md:text-7xl">
                {typedText}
                <span className="ml-1 inline-block h-12 w-1 animate-pulse bg-[#e6840a] align-middle md:h-16" />
              </p>
            ) : (
              <div className="text-center">
                <Keyboard
                  size={48}
                  strokeWidth={1.2}
                  className="mx-auto mb-4 text-[#6fa3f5]"
                />
                <p className="font-serif text-2xl text-[#68717d] md:text-4xl">
                  Your letters will appear here
                </p>
                <p className="mt-2 text-sm text-[#68717d]">
                  Touch a paper key to begin typing
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-lg shadow-[#0d1117]/5 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5e5] px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={19} className="text-[#e6840a]" />
                <h2 className="font-semibold">Live Camera</h2>
              </div>

              <span className="flex items-center gap-2 text-xs text-[#68717d]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    cameraActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {cameraActive ? "Camera connected" : "Camera off"}
              </span>
            </div>

            <div className="relative flex aspect-video items-center justify-center bg-[#0d1117]">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="px-5 text-center text-white">
                  <Camera
                    size={54}
                    strokeWidth={1.2}
                    className="mx-auto mb-3 text-[#6fa3f5]"
                  />
                  <p className="text-lg font-medium">Camera is not connected</p>
                  <p className="mt-1 text-sm text-white/60">
                    Connect a camera to let AI see the paper keyboard.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="max-w-full truncate text-xs text-[#68717d]">
                {cameraActive ? selectedCameraName : "No camera selected"}
              </p>

              {cameraActive ? (
                <div className="flex gap-2">
                  <button
                    onClick={openCameraChooser}
                    className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm transition hover:bg-[#fffbf5]"
                  >
                    Switch camera
                  </button>

                  <button
                    onClick={stopCamera}
                    className="rounded-lg bg-[#0d1117] px-4 py-2 text-sm text-white transition hover:bg-[#6fa3f5] hover:text-[#0d1117]"
                  >
                    Stop camera
                  </button>
                </div>
              ) : (
                <button
                  onClick={openCameraChooser}
                  disabled={loadingCameras}
                  className="flex items-center gap-2 rounded-lg bg-[#6fa3f5] px-5 py-2.5 text-sm font-semibold text-[#0d1117] transition hover:bg-[#e6840a] disabled:opacity-50"
                >
                  <Camera size={16} />
                  {loadingCameras ? "Loading..." : "Choose camera"}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-[#0d1117]/5 backdrop-blur-md">
            <div className="mb-5 flex items-center gap-2">
              <Brain size={19} className="text-[#e6840a]" />
              <h2 className="font-semibold">AI Recognition</h2>
            </div>

            <div className="rounded-xl bg-[#f1f6ff] p-5">
              <p className="mb-2 text-xs font-bold tracking-wider text-[#68717d]">
                RECOGNIZED KEY
              </p>

              <div className="flex min-h-24 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white">
                <span className="font-serif text-5xl font-semibold">
                  {recognizedKey}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[#68717d]">Confidence</span>
                <span className="font-semibold">{confidence}%</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5e5e5]">
                <div
                  className="h-full rounded-full bg-[#e6840a] transition-all"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#68717d]">AI model</span>
                <span className="font-medium">
                  {modelReady ? "Connected" : "Not connected"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#68717d]">Status</span>
                <span className="font-medium text-[#e6840a]">{aiStatus}</span>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] p-4 text-sm text-[#68717d]">
                {modelReady ? (
                  <CheckCircle2 size={18} className="shrink-0 text-green-600" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 text-[#e6840a]" />
                )}

                {modelReady
                  ? `${trainedLetters.length} alphabet letters are available in this model.`
                  : "Open Admin to configure your Teachable Machine model."}
              </div>
            </div>
          </div>
        </section>

        {cameraError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={17} />
            {cameraError}
          </div>
        )}

        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Full Alphabet</h3>
            <span className="text-xs text-[#68717d]">
              {trainedLetters.length} of 26 letters trained
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:grid-cols-13">
            {ALPHABET.map((letter) => {
              const trained = trainedLetters.includes(letter);

              return (
                <div
                  key={letter}
                  className={`flex aspect-square items-center justify-center rounded-lg border font-semibold ${
                    trained
                      ? "border-[#6fa3f5] bg-[#dce9fc] text-[#0d1117]"
                      : "border-white/80 bg-white/70 text-[#a3a3a3]"
                  }`}
                  title={
                    trained
                      ? `${letter} is included in the AI model`
                      : `${letter} is not yet included in the AI model`
                  }
                >
                  {letter}
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-[#68717d]">
            Blue letters are included in the trained model. Grey letters are
            available on the website but have not been trained yet.
          </p>
        </div>

        <footer className="mt-7 pb-3 text-center text-xs text-[#68717d]">
          An interactive student science fair project exploring artificial
          intelligence.
        </footer>
      </div>

      {cameraChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#fffbf5] p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  Choose a camera
                </h2>
                <p className="mt-1 text-sm text-[#68717d]">
                  Select the camera you want to use.
                </p>
              </div>

              <button
                onClick={() => setCameraChooser(false)}
                className="rounded-lg p-2 transition hover:bg-[#f1f6ff]"
                aria-label="Close camera selection"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 space-y-2">
              {cameras.map((camera, index) => (
                <button
                  key={camera.deviceId}
                  onClick={() => startSelectedCamera(camera.deviceId)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#e5e5e5] p-4 text-left transition hover:border-[#6fa3f5] hover:bg-[#f1f6ff]"
                >
                  <Camera size={20} className="text-[#e6840a]" />
                  <span className="text-sm font-medium">
                    {camera.label || `Camera ${index + 1}`}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={refreshCameras}
              disabled={loadingCameras}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] py-3 text-sm transition hover:bg-[#f1f6ff]"
            >
              <RefreshCw
                size={15}
                className={loadingCameras ? "animate-spin" : ""}
              />
              Refresh cameras
            </button>

            <p className="mt-4 text-xs leading-relaxed text-[#68717d]">
              To use DroidCam, make sure it is running and connected to your
              computer. It should appear here as a webcam.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
