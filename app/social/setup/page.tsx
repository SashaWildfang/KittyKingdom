"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgeField, FieldInput, LooksEditor, type Birth, PhotoManager, PromptsEditor, changed, clearDraft, readDraft, saveMe, writeDraft, type Own } from "../profile-form";
import { SectionIcon } from "../icons";
import { useApi } from "../ui";

type Me = { profile: Own | null; view: { id: string } | null; birth: Birth };
type Step = { id: string; title: string; intro: string; keys?: string[]; required?: string[]; datingOnly?: boolean };

const STEPS: Step[] = [
  { id: "basics", title: "The basics", intro: "Just the essentials. Everything here can be changed later.", keys: ["name", "age", "gender", "pronouns", "sexuality", "is_looking"], required: ["name", "age", "gender", "is_looking"] },
  { id: "targets", title: "Who you're looking for", intro: "Matching only shows you to people who fit what you both want.", keys: ["looking_for_gender", "looking_for_min_age", "looking_for_max_age", "looking_for_relationship_type", "sexual_position", "looking_for_sexual_position"], datingOnly: true },
  { id: "about", title: "About you", intro: "This is what our matching AI reads most. The more you write, the better your matches.", keys: ["bio", "hobbies_interests", "likes", "dislikes", "favorite_games", "fun_fact"] },
  { id: "lifestyle", title: "Lifestyle", intro: "Quick taps. These help avoid dealbreakers later.", keys: ["sleep_schedule", "activity_level", "want_kids", "marriage_goals", "smokes", "drinks", "uses_weed", "smoking_ok", "drinking_ok", "substance_ok"] },
  { id: "where", title: "Where and when", intro: "Helps with time zones and long distance.", keys: ["location", "timezone", "distance_comfort", "relationship_status"] },
  { id: "photos", title: "Photos", intro: "Profiles with a photo or art get far more likes. SFW only." },
  { id: "extras", title: "Make it yours", intro: "A prompt or two gives people something to reply to, and a color makes your profile pop." },
];

export default function Setup() {
  const { data, error } = useApi<Me>("/api/dating/me");
  const [own, setOwn] = useState<Own | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [prompts, setPrompts] = useState<Own["prompts"]>([]);
  const [web, setWeb] = useState<Own["web"]>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    if (data.profile) {
      setOwn(data.profile);
      setValues(data.profile.values);
      setPrompts(data.profile.prompts);
      setWeb(data.profile.web);
    }
    // Pick up where they left off if the tab was refreshed (or the site updated) mid-setup
    const draft = readDraft<{ values: Record<string, unknown>; prompts: Own["prompts"]; web: Own["web"]; step: number; started: boolean }>("setup");
    if (draft) {
      setValues({ ...(data.profile?.values ?? {}), ...draft.values });
      if (draft.prompts) setPrompts(draft.prompts);
      if (draft.web) setWeb(draft.web);
      setStep(draft.step ?? 0);
      setStarted(Boolean(draft.started));
      setRestored(Boolean(draft.started));
    }
    setHydrated(true);
  }, [data, hydrated]);
  useEffect(() => {
    if (hydrated && !done && started) writeDraft("setup", { values, prompts, web, step, started });
  }, [hydrated, done, started, values, prompts, web, step]);

  // Decided once from the profile as loaded, so confirming the review doesn't shift the steps
  const review = Boolean(data?.profile && !data.profile.reviewConfirmed);
  const steps = useMemo(() => {
    const list: Step[] = [];
    if (review) list.push({ id: "review", title: "Check your converted answers", intro: "We moved your Discord profile to the new system and turned your typed answers into options. Please check the highlighted ones.", keys: data!.profile!.review });
    const open = values.is_looking === "Yes";
    return [...list, ...STEPS.filter((s) => !s.datingOnly || open)];
  }, [review, data, values.is_looking]);
  const cur = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, started]);

  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;

  const next = async () => {
    setErr(null);
    // Age is filled from their birthday when we have it
    const missing = (cur.required ?? []).filter((k) => !(k === "age" && (data.birth?.age || own?.ageLocked)) && (values[k] === null || values[k] === undefined || values[k] === ""));
    if (missing.length) return setErr("Please fill in the required fields (marked with *).");
    if (typeof values.age === "number" && values.age < 18) return setErr("Dating is for members 18 and over.");
    const body: Record<string, unknown> = {};
    if (cur.keys) {
      const picked = Object.fromEntries(cur.keys.map((k) => [k, values[k]]));
      const diff = own ? changed(own.values, picked) : Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== null && v !== "" && v !== undefined));
      if (Object.keys(diff).length) body.fields = diff;
    }
    if (cur.id === "review") body.confirmReview = true;
    if (cur.id === "extras") {
      body.prompts = prompts.filter((p) => p.a.trim());
      body.web = web;
    }
    if (Object.keys(body).length) {
      setBusy(true);
      const r = await saveMe(body);
      setBusy(false);
      if (!r.ok || !r.profile) return setErr(r.error ?? "Couldn't save that.");
      setOwn(r.profile);
      setValues(r.profile.values);
    }
    if (step >= steps.length - 1) {
      clearDraft("setup");
      setDone(true);
    }
    else setStep((s) => s + 1);
  };

  if (done)
    return (
      <div className="dt-setup dt-setup--done">
        <PartyPopper size={40} aria-hidden="true" />
        <h1>You&apos;re all set{values.name ? `, ${values.name}` : ""}!</h1>
        <p className="dt-muted">Your profile is live. Matches refresh within a minute as our AI reads your answers.</p>
        {own ? (
          <p>
            Profile strength: <b>{own.strength.score}%</b>
            {own.strength.missing[0] ? <span className="dt-muted"> · Tip: {own.strength.missing[0].tip}</span> : null}
          </p>
        ) : null}
        <div className="dt-row dt-row--center">
          <a className="dt-btn dt-btn--big" href={values.is_looking === "Yes" ? "/social/discover" : "/social/discover?mode=friends"}>
            {values.is_looking === "Yes" ? "Start discovering" : "Find friends"} <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="dt-btn dt-btn--ghost" href="/social/profile">
            Fine-tune my profile
          </a>
        </div>
      </div>
    );

  if (!started)
    return (
      <div className="dt-setup dt-setup--intro">
        <Sparkles size={34} aria-hidden="true" />
        <h1>{own ? (review ? "Your profile moved to the website!" : "Update your profile") : "Create your dating profile"}</h1>
        <p className="dt-muted">
          {own
            ? "Everything you wrote on Discord is still here. We'll walk through it step by step so you can check the converted answers and add the new stuff: photos, prompts and your own profile color."
            : "About five minutes. Tap answers instead of typing where you can, skip anything optional, and change it all later."}
        </p>
        <ul className="dt-checks">
          <li>
            <Check size={14} aria-hidden="true" /> Only verified 18+ members can see dating profiles
          </li>
          <li>
            <Check size={14} aria-hidden="true" /> Our AI matches by meaning, so &quot;hiking&quot; finds &quot;outdoors&quot; too
          </li>
          <li>
            <Check size={14} aria-hidden="true" /> Not looking to date? You can still be here to make friends
          </li>
        </ul>
        <button type="button" className="dt-btn dt-btn--big" onClick={() => setStarted(true)}>
          {own ? "Let's go" : "Get started"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    );

  const needsProfile = !own && (cur.id === "photos" || cur.id === "extras");
  return (
    <div className="dt-setup">
      <div className="dt-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s.id} className={i < step ? "is-done" : i === step ? "is-on" : undefined} />
        ))}
      </div>
      <p className="dt-kicker">
        Step {step + 1} of {steps.length}
      </p>
      {restored ? (
        <p className="dt-note">
          Welcome back! We kept the answers you hadn&apos;t saved yet.{" "}
          <button type="button" className="dt-textlink" onClick={() => setRestored(false)}>
            OK
          </button>
        </p>
      ) : null}
      <h1>{cur.title}</h1>
      <p className="dt-muted">{cur.intro}</p>

      <div className="dt-card dt-setup-card">
        {cur.id === "photos" ? (
          own ? (
            <PhotoManager photos={own.photos} onChange={(p) => setOwn((o) => (o ? { ...o, photos: p.photos, strength: p.strength } : p))} />
          ) : null
        ) : cur.id === "extras" ? (
          <>
            <h3 className="dt-h-icon">
              <SectionIcon id="prompts" /> Prompts
            </h3>
            <PromptsEditor value={prompts} onChange={setPrompts} />
            <h3 className="dt-h-icon">
              <SectionIcon id="looks" /> Looks
            </h3>
            <LooksEditor web={web} onChange={setWeb} name={String(values.name ?? "")} />
          </>
        ) : cur.id === "review" && !cur.keys?.length ? (
          <p>Nothing needs fixing. Your answers converted cleanly! Continue to check the rest.</p>
        ) : (
          <div className="dt-edit-fields">
            {cur.keys!.map((k) => (
              <div key={k} className={cur.required?.includes(k) ? "is-required" : undefined}>
                {k === "age" ? (
                  <AgeField value={values.age} locked={Boolean(own?.ageLocked)} birth={data.birth} onChange={(v) => setValues((x) => ({ ...x, age: v }))} />
                ) : (
                  <FieldInput k={k} value={values[k]} flagged={cur.id === "review"} legacy={own?.legacy[k]} onChange={(v) => setValues((x) => ({ ...x, [k]: v }))} />
                )}
              </div>
            ))}
          </div>
        )}
        {needsProfile ? <p className="dt-error">Finish the basics first.</p> : null}
      </div>

      {err ? <p className="dt-error">{err}</p> : null}
      <div className="dt-setup-nav">
        <button type="button" className="dt-btn dt-btn--ghost" onClick={() => (step ? setStep((s) => s - 1) : setStarted(false))} disabled={busy}>
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </button>
        {cur.required ? null : step < steps.length - 1 && cur.id !== "review" ? (
          <button type="button" className="dt-textlink" onClick={() => setStep((s) => s + 1)} disabled={busy}>
            Skip for now
          </button>
        ) : null}
        <button type="button" className="dt-btn" onClick={() => void next()} disabled={busy}>
          {busy ? <Loader2 size={15} className="dt-spin" aria-hidden="true" /> : null}
          {cur.id === "review" ? "Looks good" : step >= steps.length - 1 ? "Finish" : "Continue"} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
