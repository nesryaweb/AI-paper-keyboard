
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

function normalizeLabel(label) {
  return label.trim().toUpperCase().replace(/[\s_-]/g, "");
}

function normalizeUrl(url) {
  let cleaned = url.trim();

  cleaned = cleaned.replace(/(model|metadata)\.json\/?$/i, "");

  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function isEmptyClass(label) {
  return ["EMPTY", "NOHAND", "NONE", "NOTOUCH"].includes(
    normalizeLabel(label)
  );
}

function getLetterFromClass(label) {
  const normalized = normalizeLabel(label);

  if (isEmptyClass(normalized)) {
    return null;
  }

  const match = normalized.match(/^([A-Z])\d*$/);

  return match ? match[1] : null;
}

// Organize all model classes into letter groups.
function summarizeClasses(classes) {
  const groups = {};
  const emptyClasses = [];
  const otherClasses = [];

  classes.forEach((name) => {
    if (isEmptyClass(name)) {
      emptyClasses.push(name);
      return;
    }

    const letter = getLetterFromClass(name);

    if (letter) {
      if (!groups[letter]) {
        groups[letter] = [];
      }

      groups[letter].push(name);
    } else {
      otherClasses.push(name);
    }
  });

  return {
    groups: Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b)
    ),
    emptyClasses,
    otherClasses,
  };
}

export default function AdminPage() {
  const [modelUrl, setModelUrl] = useState("");
  const [confidence, setConfidence] = useState(85);
  const [classes, setClasses] = useState([]);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Restore previously saved settings.
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

  const summary = summarizeClasses(classes);

  const totalLetters = summary.groups.length;

  const totalSamples = summary.groups.reduce(
    (total, [, samples]) => total + samples.length,
    0
  );

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
            Connect and inspect your trained AI keyboard model.
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
            The homepage compares this threshold against the combined
            confidence of all samples belonging to a letter.
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

              <div className="mb-4 flex items-center gap-2 font-semibold text-[#0d1117]">
                <CheckCircle2 size={18} className="text-green-600" />
                {tested
                  ? "Model loaded successfully"
                  : "Previously saved model classes"}
              </div>

              <p className="mb-4 text-sm text-[#68717d]">
                Your model's classes have been organized into letter
                groups.
              </p>

              <div className="mb-5 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-center">
                  <p className="text-2xl font-semibold">{classes.length}</p>
                  <p className="text-xs text-[#68717d]">Total classes</p>
                </div>

                <div className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-center">
                  <p className="text-2xl font-semibold">{totalLetters}</p>
                  <p className="text-xs text-[#68717d]">Letters trained</p>
                </div>

                <div className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-center">
                  <p className="text-2xl font-semibold">{totalSamples}</p>
                  <p className="text-xs text-[#68717d]">Letter samples</p>
                </div>
              </div>

              <h3 className="mb-3 text-sm font-semibold">
                Alphabet sample groups
              </h3>

              <div className="space-y-2">
                {summary.groups.map(([letter, samples]) => (
                  <div
                    key={letter}
                    className="rounded-lg border border-[#e5e5e5] bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#dce9fc] font-serif text-xl font-semibold">
                          {letter}
                        </div>

                        <div>
                          <p className="text-sm font-semibold">
                            Letter {letter}
                          </p>
                          <p className="text-xs text-[#68717d]">
                            {samples.length} sample classes
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-[#f1f6ff] px-3 py-1 text-sm font-semibold">
                        {samples.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {samples.map((name, index) => (
                        <span
                          key={`${name}-${index}`}
                          className="rounded-md border border-[#e5e5e5] bg-[#fffbf5] px-2 py-1 text-xs text-[#68717d]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {summary.emptyClasses.length > 0 && (
                <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-[#0d1117]">
                    Release / Empty classes
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {summary.emptyClasses.map((name, index) => (
                      <span
                        key={`${name}-${index}`}
                        className="rounded-md border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold"
                      >
                        {name}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-[#68717d]">
                    These classes are kept separate from the alphabet.
                  </p>
                </div>
              )}

              {summary.otherClasses.length > 0 && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-red-800">
                    Other unrecognized classes
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {summary.otherClasses.map((name, index) => (
                      <span
                        key={`${name}-${index}`}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800"
                      >
                        {name}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-red-700">
                    These class names do not match the expected letter
                    or EMPTY format.
                  </p>
                </div>
              )}

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
            You can train the AI with any letter from A to Z. Each
            letter can have as many numbered sample classes as you need,
            such as A1, A2, A10, or A25. The homepage automatically groups
            these classes together and combines their prediction scores.
            Keep an EMPTY class so the website can recognize when a
            finger moves away from the keyboard.
          </p>
        </section>

      </div>
    </main>
  );
}
