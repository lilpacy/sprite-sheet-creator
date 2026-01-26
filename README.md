# Sprite Sheet Creator

AI-powered sprite sheet generator for 2D pixel art characters. Built with [fal.ai](https://fal.ai) and Next.js.

## Features

- **Character Generation** - Generate pixel art characters from text prompts using nano-banana-pro
- **Walk Cycle Sprites** - Automatically generate 6-frame walk cycle sprite sheets (2x3 grid)
- **Jump Animation** - Generate 4-frame jump animation sprite sheets (2x2 grid)
- **Attack Animation** - Generate 4-frame attack animation sprite sheets (2x2 grid) - AI picks the attack style
- **Background Removal** - Clean transparent backgrounds using Bria
- **Frame Extraction** - Adjustable grid dividers for precise frame cropping
- **Animation Preview** - Test animations with adjustable FPS
- **Sandbox Mode** - Walk, jump, and attack in a parallax side-scroller environment

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your fal.ai API key:
```
FAL_KEY=your_api_key_here
```

Get your API key at https://fal.ai/dashboard/keys

3. Run the development server:
```bash
npm run dev
```

4. Open http://localhost:3000

## Controls

### Animation Preview (Step 5)
- `D` / `→` - Walk right
- `A` / `←` - Walk left
- `Space` - Stop

### Sandbox (Step 6)
- `A` / `←` - Walk left
- `D` / `→` - Walk right
- `W` / `↑` - Jump
- `J` - Attack

## Tech Stack

- Next.js 14
- React 18
- fal.ai (nano-banana-pro, Bria background removal)
- HTML Canvas
