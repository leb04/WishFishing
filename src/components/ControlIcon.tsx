const paths = {
  cast: <><path d="M3 16a8 8 0 0 1 8-8h4v8a3 3 0 0 1-6 0v-2l2 2"/><path d="m15 8 4-4"/></>,
  log: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18m3-13h4m-4 4h4"/></>,
  sound: <><path d="M3 9v6h4l5 4V5L7 9H3Z"/><path d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/></>,
  mute: <><path d="M3 9v6h4l5 4V5L7 9H3Z"/><path d="m16 10 4 4m0-4-4 4"/></>,
  pause: <path d="M9 5v14m6-14v14"/>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  still: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 6-6 5 5 3-3 4 4"/><circle cx="15.5" cy="8.5" r=".5"/></>,
  scene: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
  expand: <path d="M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5" />,
  shrink: <path d="M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4" />,
};

export function ControlIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
