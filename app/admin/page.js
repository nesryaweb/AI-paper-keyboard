
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as tmImage from "@teachablemachine/image";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";

const SETTINGS_KEY = "keyboard-ai-settings";

function normalizeUrl(url) {
  let cleaned = url.trim();

  cleaned = cleaned.replace(/(model|metadata)\.json\/?$/i, "");

  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

export default function AdminPage() {
  const [modelUrl, setModelUrl] = useState("");
  const [confidence, setConfidence] = useState(85);
  const [classes, setClasses] = useState([]);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Load previously saved settings when the page opens.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (saved) {
        const settings = JSON.parse(saved);

        setModelUrl(settings.modelUrl || "");
        setConfidence(settings.confidence ?? 85);
        setClasses(settings.classes || []);
      }
    } catch (error) {
      console.error("Could not load saved settings:", error);
      setMessage("Could not load saved settings.");
      setMessageType("error");
    }
  }, []);

  async function testModel() {
    if (!modelUrl.trim()) {
      setMessage("Please enter your Teachable Machine model URL.");
      setMessageType("error");
      return;
    }

    setTesting(true);
    setTested(false);
    setClasses([]);
    setMessage("");

    try {
      const url = normalizeUrl(modelUrl);

      const model = await tmImage.load(
        `${url}model.json`,
        `${url}metadata.json`
      );

      const labels = model.getClassLabels();

      if (!labels || labels.length === 0) {
        throw new Error("No classes were found in this model.");
      }

      setClasses(labels);
      setTested(true);

      setMessage("Your AI model loaded successfully!");
      setMessageType("success");
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not load the model. Check the URL and make sure the model has been uploaded to Teachable Machine."
      );

      setMessageType("error");
    } finally {
      setTesting(false);
    }
  }

  function saveSettings() {
    if (!tested) {
      setMessage("Test your model successfully before saving.");
      setMessageType("error");
      return;
    }

    const settings = {
      modelUrl: normalizeUrl(modelUrl),
      confidence,
      classes,
    };

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      setMessage("Model settings saved successfully!");
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage("Could not save settings in this browser.");
      setMessageType("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#fffbf5] px-5 py-8 text-[#0d1117]">
      <div className="mx-auto max-w-2xl">

        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#68717d] transition hover:text-[#6fa3f5]"
        >
          <ArrowLeft size={17} />
          Back to keyboard
        </Link>

        <div className="mb-8">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d1117] text-[#6fa3f5]">
            <Brain size={25} />
          </div>

          <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#e6840a]">
            PROJECT ADMINISTRATION
          </p>

          <h1 className="font-serif text-3xl font-semibold">
            AI Model Settings
          </h1>

          <p className="mt-2 text-sm text-[#68717d]">
            Connect your trained AI keyboard model.
          </p>
        </div>

        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">

          <label className="mb-2 block text-sm font-semibold">
            Teachable Machine Model URL
          </label>

          <input
            type="url"
            value={modelUrl}
            onChange={(e) => {
              setModelUrl(e.target.value);
              setTested(false);
              setClasses([]);
              setMessage("");
            }}
            placeholder="https://teachablemachine.withgoogle.com/models/..."
            className="w-full rounded-lg border border-[#e5e5e5] bg-[#fffbf5] px-4 py-3 text-sm outline-none transition focus:border-[#6fa3f5] focus:ring-2 focus:ring-[#6fa3f5]/20"
          />

          <p className="mt-2 text-xs text-[#68717d]">
            Paste the shareable model URL from Teachable Machine.
          </p>

          <div className="my-7 border-t border-[#e5e5e5]" />

          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-semibold">
              Recognition confidence
            </label>

            <span className="font-semibold text-[#e6840a]">
              {confidence}%
            </span>
          </div>

          <input
            type="range"
            min="50"
            max="99"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full accent-[#6fa3f5]"
          />

          <p className="mt-2 text-xs text-[#68717d]">
            Start at 85%. We can adjust this after testing the keyboard.
          </p>

          <div className="my-7 border-t border-[#e5e5e5]" />

          <button
            onClick={testModel}
            disabled={testing || !modelUrl.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0d1117] px-5 py-3 font-semibold transition hover:border-[#6fa3f5] hover:bg-[#f1f6ff] disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Loading model...
              </>
            ) : (
              <>
                <Brain size={17} />
                Test AI Model
              </>
            )}
          </button>

          {classes.length > 0 && (
            <div className="mt-6 rounded-xl border border-[#6fa3f5] bg-[#f1f6ff] p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-[#0d1117]">
                <CheckCircle2 size={18} className="text-green-600" />
                {tested ? "Model loaded successfully" : "Previously saved model classes"}
              </div>

              <p className="mb-3 text-sm text-[#68717d]">
                The AI model contains {classes.length} classes:
              </p>

              <div className="flex flex-wrap gap-2">
                {classes.map((name) => (
                  <span
                    key={name}
                    className="rounded-lg border border-[#6fa3f5] bg-white px-3 py-2 text-sm font-semibold text-[#0d1117]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div
              className={`mt-5 flex items-start gap-3 rounded-lg border p-4 text-sm ${
                messageType === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}

              {message}
            </div>
          )}

          <button
            onClick={saveSettings}
            disabled={!tested}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#6fa3f5] px-5 py-3 font-semibold text-[#0d1117] transition hover:bg-[#e6840a] disabled:opacity-40"
          >
            <Save size={17} />
            Save Model Settings
          </button>

        </section>

        <section className="mt-5 rounded-2xl border border-[#e5e5e5] bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Brain size={18} className="text-[#e6840a]" />
            <h2 className="font-semibold">How the model works</h2>
          </div>

          <p className="text-sm leading-relaxed text-[#68717d]">
            You can train the AI with any letter from A to Z. The model
            class names will appear automatically after testing. Include
            a NO_HAND class so the website knows when a finger has moved
            away from a key.
          </p>
        </section>

      </div>
    </main>
  );
}
