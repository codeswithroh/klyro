// klyro/tweaks.jsx — Tweaks island for the Klyro brand board.
// Drives theming by setting data-* attributes / CSS vars on <html>.

const { useState, useEffect } = React;

const KLYRO_DEFAULTS = /*EDITMODE-BEGIN*/{
  "style": "light",
  "paper": "cool",
  "sig": "violet",
  "texture": "on",
  "ring": "regular",
  "verify": "full",
  "duel": "reveal"
}/*EDITMODE-END*/;

function applyTheme(t) {
  const r = document.documentElement;
  // style maps to data-style + sensible paper default for night
  r.setAttribute('data-style', t.style === 'night' ? 'night' : 'light');
  r.setAttribute('data-paper', t.style === 'night' ? 'cool' : t.paper);
  r.setAttribute('data-sig', t.sig);
  r.setAttribute('data-texture', t.texture);
  r.setAttribute('data-verify', t.verify);
  r.setAttribute('data-duel', t.duel);
  if (t.ring === 'bold' || t.ring === 'fine') r.setAttribute('data-ring', t.ring);
  else r.removeAttribute('data-ring');
}

function KlyroTweaks() {
  const [t, setTweak] = useTweaks(KLYRO_DEFAULTS);
  useEffect(() => { applyTheme(t); }, [t]);

  return (
    <TweaksPanel title="Klyro — Tweaks">
      <TweakSection label="Overall visual style" />
      <TweakRadio
        label="Theme"
        value={t.style}
        options={['light', 'night']}
        onChange={(v) => setTweak('style', v)}
      />
      <TweakColor
        label="Signature color"
        value={t.sig === 'violet' ? '#6C2BF2' : t.sig === 'electric' ? '#2D6BFF' : '#FF5A1F'}
        options={['#6C2BF2', '#2D6BFF', '#FF5A1F']}
        onChange={(v) => setTweak('sig', v === '#6C2BF2' ? 'violet' : v === '#2D6BFF' ? 'electric' : 'sunset')}
      />
      <TweakRadio
        label="Paper tone"
        value={t.paper}
        options={['cool', 'warm']}
        onChange={(v) => setTweak('paper', v)}
      />
      <TweakToggle
        label="Arena grid texture"
        value={t.texture === 'on'}
        onChange={(v) => setTweak('texture', v ? 'on' : 'off')}
      />
      <TweakRadio
        label="Logo ring weight"
        value={t.ring}
        options={['fine', 'regular', 'bold']}
        onChange={(v) => setTweak('ring', v)}
      />

      <TweakSection label="The duel moment" />
      <TweakRadio
        label="Opponent's call"
        value={t.duel}
        options={['reveal', 'blind']}
        onChange={(v) => setTweak('duel', v)}
      />

      <TweakSection label="Fairness, made visible" />
      <TweakRadio
        label="Verify seal"
        value={t.verify}
        options={['full', 'minimal', 'stamp']}
        onChange={(v) => setTweak('verify', v)}
      />
    </TweaksPanel>
  );
}

// apply persisted theme ASAP (before React mounts) to avoid a flash
try {
  const saved = JSON.parse(localStorage.getItem('tweaks') || 'null');
  applyTheme(Object.assign({}, KLYRO_DEFAULTS, saved || {}));
} catch (e) { applyTheme(KLYRO_DEFAULTS); }

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<KlyroTweaks />);
