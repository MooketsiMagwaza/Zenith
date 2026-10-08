export const MUSASHI_QUOTES = [
  "Think lightly of yourself and deeply of the world.",
  "Today is victory over yourself of yesterday.",
  "Do nothing that is of no use.",
  "You must understand that there is more than one path to the top of the mountain.",
  "The true science of martial arts means practicing them in such a way that they will be useful at any time.",
  "Perceive that which cannot be seen with the eye.",
  "Get beyond love and grief: exist for the good of man.",
  "In battle, if you make your opponent flinch, you have already won.",
  "Step by step walk the thousand-mile road.",
  "There is nothing outside of yourself that can ever enable you to get better, stronger, richer, quicker, or smarter.",
  "It may seem difficult at first, but everything is difficult at first.",
  "A man cannot understand the art he is studying if he only looks for the end result without taking the time to delve deeply into the reasoning of the study.",
];

export const BIBLE_VERSES = [
  "Be still, and know that I am God. — Psalm 46:10",
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "The Lord is my shepherd; I shall not want. — Psalm 23:1",
  "Trust in the Lord with all your heart, and lean not on your own understanding. — Proverbs 3:5",
  "Cast all your anxiety on him because he cares for you. — 1 Peter 5:7",
  "For I know the plans I have for you, plans to prosper and not to harm you. — Jeremiah 29:11",
  "Wait on the Lord: be of good courage, and he shall strengthen your heart. — Psalm 27:14",
  "This is the day which the Lord hath made; we will rejoice and be glad in it. — Psalm 118:24",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "The Lord will fight for you; you need only to be still. — Exodus 14:14",
];

export const STOIC_QUOTES = [
  "You have power over your mind — not outside events. Realize this, and you will find strength. — Marcus Aurelius",
  "Waste no more time arguing what a good man should be. Be one. — Marcus Aurelius",
  "He who fears death will never do anything worthy of a man who is alive. — Seneca",
  "We suffer more often in imagination than in reality. — Seneca",
  "First say to yourself what you would be; and then do what you have to do. — Epictetus",
  "It's not what happens to you, but how you react to it that matters. — Epictetus",
  "The happiness of your life depends upon the quality of your thoughts. — Marcus Aurelius",
  "Difficulties strengthen the mind, as labor does the body. — Seneca",
];

export const ZEN_PROVERBS = [
  "When walking, walk. When eating, eat.",
  "Before enlightenment; chop wood, carry water. After enlightenment; chop wood, carry water.",
  "The obstacle is the path.",
  "Sit quietly, doing nothing, spring comes, and the grass grows by itself.",
  "Let go, or be dragged.",
  "Knock on the sky and listen to the sound.",
  "The quieter you become, the more you can hear.",
  "Wherever you are, be there totally.",
];

export const QUOTE_PACKS = {
  musashi: { label: "Musashi", source: "The Book of Five Rings", quotes: MUSASHI_QUOTES },
  bible: { label: "Bible Verses", source: "Holy Scripture", quotes: BIBLE_VERSES },
  stoic: { label: "Stoic", source: "Marcus Aurelius · Seneca · Epictetus", quotes: STOIC_QUOTES },
  zen: { label: "Zen Proverbs", source: "Anonymous", quotes: ZEN_PROVERBS },
} as const;

export type QuotePackId = keyof typeof QUOTE_PACKS;

/* ------------------------------------------------------------------ */
/* WALLPAPER CATEGORIES                                                */
/* ------------------------------------------------------------------ */
/* Each entry is either a remote image URL or a CSS background value   */
/* (gradient / solid). The Zen view detects gradients by prefix.       */

export type WallpaperKind = "image" | "css";
export type WallpaperItem = { kind: WallpaperKind; value: string; label?: string };

export const WALL_PASTELS: WallpaperItem[] = [
  { kind: "css", value: "#f4e6d8", label: "Cream" },
  { kind: "css", value: "#e8dcc4", label: "Sand" },
  { kind: "css", value: "#d8e2dc", label: "Mist" },
  { kind: "css", value: "#cbd5d1", label: "Sage" },
  { kind: "css", value: "#e2cfc4", label: "Blush" },
  { kind: "css", value: "#c9d6df", label: "Ice" },
  { kind: "css", value: "#d6cdea", label: "Lilac" },
  { kind: "css", value: "#f0d9c4", label: "Peach" },
];

export const WALL_GRADIENTS: WallpaperItem[] = [
  { kind: "css", value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", label: "Midnight" },
  { kind: "css", value: "linear-gradient(135deg, #2d1b4e 0%, #4a2c6d 50%, #6b3a8a 100%)", label: "Twilight" },
  { kind: "css", value: "linear-gradient(135deg, #0c2340 0%, #1a4a6e 50%, #2d8a9e 100%)", label: "Ocean Deep" },
  { kind: "css", value: "linear-gradient(135deg, #1a3c2a 0%, #2d5a3d 50%, #5a8a5c 100%)", label: "Forest" },
  { kind: "css", value: "linear-gradient(135deg, #5c2018 0%, #9b4423 50%, #d4842a 100%)", label: "Autumn" },
  { kind: "css", value: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 70%, #c9a84c 100%)", label: "Noir Gold" },
  { kind: "css", value: "linear-gradient(135deg, #faf8f5 0%, #f0ebe3 50%, #c9b99a 100%)", label: "Linen" },
  { kind: "css", value: "linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #e84393 100%)", label: "Sunset" },
  { kind: "css", value: "linear-gradient(180deg, #232526 0%, #414345 100%)", label: "Slate" },
  { kind: "css", value: "linear-gradient(135deg, #c9a0dc 0%, #e8c5d0 100%)", label: "Blossom" },
];

export const WALL_UNSPLASH: WallpaperItem[] = [
  { kind: "image", value: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80", label: "Mountain Lake" },
  { kind: "image", value: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80", label: "Foggy Pines" },
  { kind: "image", value: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1920&q=80", label: "Aurora" },
  { kind: "image", value: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1920&q=80", label: "Pine Forest" },
  { kind: "image", value: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1920&q=80", label: "Woodland" },
  { kind: "image", value: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80", label: "Sun Rays" },
  { kind: "image", value: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=1920&q=80", label: "Cliffside" },
  { kind: "image", value: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80", label: "Reflection" },
];

export const WALL_BUILTIN: WallpaperItem[] = [
  { kind: "image", value: "https://miro.medium.com/v2/resize:fit:1100/format:webp/1*dt92NJHdpAYpAiCb874CoQ.jpeg", label: "Musashi Ink" },
  { kind: "image", value: "https://images.unsplash.com/photo-1545569310-3199b6da9c2e?auto=format&fit=crop&w=1920&q=80", label: "Zen Garden" },
  { kind: "image", value: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1920&q=80", label: "Bamboo" },
  { kind: "image", value: "https://images.unsplash.com/photo-1480497490787-505ec076689f?auto=format&fit=crop&w=1920&q=80", label: "Temple" },
];

export const WALLPAPER_CATEGORIES = {
  builtin: { label: "Curated", items: WALL_BUILTIN },
  gradient: { label: "Gradient", items: WALL_GRADIENTS },
  pastel: { label: "Pastel", items: WALL_PASTELS },
  unsplash: { label: "Unsplash", items: WALL_UNSPLASH },
} as const;

export type WallpaperCategoryId = keyof typeof WALLPAPER_CATEGORIES;

/* Backward-compat: flat list of every built-in wallpaper value (used as fallback default). */
export const ZEN_BACKGROUNDS: string[] = [
  ...WALL_BUILTIN.map((w) => w.value),
  ...WALL_UNSPLASH.map((w) => w.value),
];
