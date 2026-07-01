# FallCon Ticket Conductor — Theming Guide

## How the Theming System Works

The theming system follows a four-step pipeline:

```
Database (theme_settings table)
    |
    | GET /api/admin/theme  (on every app mount)
    v
ThemeStore.loadFromDB()  (Zustand store, client-side)
    |
    | applyToDOM(config)
    v
document.documentElement CSS custom properties
    |
    | var(--color-primary) etc.
    v
Tailwind CSS + component styles
```

### Step 1: Database

All theme values live in the `theme_settings` table as key-value text pairs. The migration seeds 36 default values. Admins edit these via the Theming Editor at `/admin/settings/theming`.

### Step 2: API

`GET /api/admin/theme` reads all rows and returns them as a flat object:
```json
{
  "data": {
    "color_primary": "#C9A84C",
    "font_heading": "Cormorant Garamond",
    ...
  }
}
```

This route uses `createAdminClient()` (service role) to bypass RLS, because theme data must be readable even before a user session is established (the ThemeProvider mounts at the root layout level).

`PATCH /api/admin/theme` accepts a partial key-value object and upserts changed keys. It requires admin authentication. Old and new values are recorded in `audit_logs`.

### Step 3: ThemeStore

The Zustand `ThemeStore` (`src/lib/stores/theme.store.ts`) holds the live theme in memory. `ThemeProvider` (`src/components/layout/ThemeProvider.tsx`) is mounted in the root layout and calls `loadFromDB()` on mount.

The store also holds a `CSS_VAR_MAP` — a complete mapping from database key names to CSS custom property names:
```typescript
const CSS_VAR_MAP: Record<keyof ThemeConfig, string> = {
  color_primary: '--color-primary',
  font_heading:  '--font-heading',
  // ...
}
```

### Step 4: DOM Application

`applyToDOM(config)` iterates every key and calls:
```javascript
document.documentElement.style.setProperty(cssVar, value)
```

Special handling:
- **Font families**: `'Cormorant Garamond', Georgia, serif` (fallback appended automatically based on key name)
- **Animation duration**: `300` (from DB) becomes `300ms` on the CSS var `--animation-duration`
- **Animations enabled**: `'true'` becomes `1` on `--animations-enabled` (for use in CSS `calc()`)

Changes made in the Theming Editor call `updateKey()` for instant live preview. Saving calls `PATCH /api/admin/theme` to persist.

---

## Complete List of Theme Variables

### Colors

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| color_primary | --color-primary | #C9A84C | Gold accent — buttons, highlights, links |
| color_primary_foreground | --color-primary-foreground | #0A0A0A | Text on primary-colored backgrounds |
| color_secondary | --color-secondary | #1A1A2E | Secondary surfaces — cards, sidebars |
| color_secondary_foreground | --color-secondary-foreground | #E8E8E8 | Text on secondary-colored backgrounds |
| color_accent | --color-accent | #C9A84C | Same as primary by default; override for distinct accent |
| color_accent_foreground | --color-accent-foreground | #0A0A0A | Text on accent backgrounds |
| color_background | --color-background | #0A0A0A | Page background |
| color_foreground | --color-foreground | #F0EDE6 | Default text color (warm white) |
| color_card | --color-card | #141414 | Card and panel background |
| color_card_foreground | --color-card-foreground | #F0EDE6 | Text within cards |
| color_border | --color-border | #2A2A2A | Borders, dividers |
| color_muted | --color-muted | #1C1C1C | Muted/subdued background |
| color_muted_foreground | --color-muted-foreground | #8A8A8A | Secondary/placeholder text |
| color_destructive | --color-destructive | #E53E3E | Error and delete actions |
| color_success | --color-success | #38A169 | Success states and confirmations |

### Typography

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| font_heading | --font-heading | Cormorant Garamond, Georgia, serif | Heading font family |
| font_body | --font-body | Inter, system-ui, sans-serif | Body text font family |
| font_mono | --font-mono | JetBrains Mono, monospace | Code and data font family |
| font_size_base | --font-size-base | 16px | Root font size (1rem base) |
| font_weight_heading | --font-weight-heading | 600 | Heading font weight |
| line_height_base | --line-height-base | 1.6 | Body line height |
| letter_spacing_heading | --letter-spacing-heading | 0.02em | Heading letter spacing |

### Spacing

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| border_radius | --border-radius | 0.5rem | Default border radius for UI components |
| spacing_unit | --spacing-unit | 4px | Base spacing unit (multiply for larger spacing) |

### Animations

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| animations_enabled | --animations-enabled | true | Master animation toggle ('true'/'false' in DB; 1/0 as CSS var) |
| animation_duration | --animation-duration | 300 | Duration in ms (stored as raw number; CSS var has 'ms' suffix) |
| animation_easing | --animation-easing | easeOut | CSS easing function name or cubic-bezier() value |

### Sound Effects

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| sounds_enabled | --sounds-enabled-raw | true | Master sound toggle |
| sound_volume | --sound-volume-raw | 0.4 | Global SFX volume (0.0–1.0) |
| sound_click_url | --sound-click-url | /sounds/click.mp3 | Click/interaction sound |
| sound_success_url | --sound-success-url | /sounds/success.mp3 | Success action sound |
| sound_error_url | --sound-error-url | /sounds/error.mp3 | Error/failure sound |
| sound_checkin_url | --sound-checkin-url | /sounds/checkin.mp3 | Check-in confirmation sound |

### Soundtrack

| DB Key | CSS Variable | Default | Description |
|---|---|---|---|
| soundtrack_enabled | --soundtrack-enabled-raw | false | Whether ambient soundtrack is active |
| soundtrack_url | --soundtrack-url | (empty) | URL of the soundtrack audio file |
| soundtrack_volume | --soundtrack-volume-raw | 0.2 | Soundtrack volume (0.0–1.0) |
| soundtrack_autoplay | --soundtrack-autoplay-raw | false | Autoplay on page load |

---

## How to Change Colors

### Via the Admin UI

1. Log in as admin
2. Navigate to Settings > Theming
3. Click any color swatch to open the color picker
4. Changes are previewed in real time
5. Click "Save" to persist to the database

### Via SQL (direct)

```sql
UPDATE theme_settings
SET value = '#7C3AED', updated_at = NOW()
WHERE key = 'color_primary';
```

After a SQL change, the theme will update the next time a user loads the app (or on the next ThemeProvider mount cycle).

### Via the API

```bash
curl -X PATCH https://yourapp.vercel.app/api/admin/theme   -H "Content-Type: application/json"   -H "Cookie: <your-admin-session-cookie>"   -d '{"color_primary": "#7C3AED", "color_accent": "#7C3AED"}'
```

---

## How to Change Fonts

### Choosing a Font

The system supports any font that is:
- A system font (no extra loading needed), OR
- A Google Font (add the `@import` to `src/app/globals.css`), OR
- A self-hosted font (add to `public/fonts/` and add `@font-face` in globals.css)

### Adding a Google Font

1. Add the import to `src/app/globals.css`:
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&display=swap');
   ```

2. Update the theme setting (admin UI or SQL):
   ```sql
   UPDATE theme_settings SET value = 'Playfair Display' WHERE key = 'font_heading';
   ```

   The ThemeStore will automatically append `, Georgia, serif` as a fallback.

---

## How to Add or Replace Sound Effects

### Replace an Existing Sound

1. Place your new `.mp3` file in `public/sounds/`
2. Update the URL in theme_settings:
   ```sql
   UPDATE theme_settings SET value = '/sounds/my-new-checkin.mp3' WHERE key = 'sound_checkin_url';
   ```
3. Or update it in the admin Theming panel under the "Sound" category
4. The SoundStore will pick up the new URL on next load

### Add Sounds from an External URL

Sound URLs can be absolute URLs pointing to a CDN or external host:
```sql
UPDATE theme_settings SET value = 'https://cdn.example.com/sounds/fanfare.mp3' WHERE key = 'sound_success_url';
```

Ensure the URL is CORS-accessible from your app domain.

### Important Notes on Sound Files

- Files must be in a browser-compatible format: `.mp3` is recommended; `.ogg` and `.wav` also work
- Howler.js loads sounds lazily (not on server, not until `loadSounds()` is called client-side)
- The SoundStore uses `html5: false` for sound effects (in-memory, low latency) and `html5: true` for the soundtrack (streaming)
- If a sound URL 404s, the store logs a warning and continues; no UI error is shown

---

## How to Add a Soundtrack

1. Upload your soundtrack file somewhere accessible (Supabase Storage, S3, or `public/sounds/`)
2. Update the soundtrack settings:
   ```sql
   UPDATE theme_settings SET value = '/sounds/ambient-jazz.mp3' WHERE key = 'soundtrack_url';
   UPDATE theme_settings SET value = 'true' WHERE key = 'soundtrack_enabled';
   UPDATE theme_settings SET value = '0.3' WHERE key = 'soundtrack_volume';
   UPDATE theme_settings SET value = 'true' WHERE key = 'soundtrack_autoplay';
   ```
3. Alternatively, use the admin Theming panel's Soundtrack section
4. The `SoundtrackPlayer` component in the admin bar will show play/pause controls when a URL is set

The soundtrack fades in over 1500ms on play and fades out over 1500ms on pause (handled by Howler's `.fade()` method in the SoundtrackStore).

For very large audio files, use Supabase Storage or an external CDN — `public/sounds/` is fine for small files but adds to the build output.

---

## CSS Variable Naming Convention

Database keys use underscores: `color_primary`, `font_heading`

CSS variables use hyphens: `--color-primary`, `--font-heading`

The mapping is defined in `CSS_VAR_MAP` in `src/lib/stores/theme.store.ts`. There is no automatic conversion — every key must have an explicit entry in the map.

Some variables have a `-raw` suffix, meaning they store a raw value that needs JavaScript interpretation (e.g., `--sounds-enabled-raw` stores `'true'`/`'false'` as strings; the SoundStore reads these and converts to booleans).

---

## Adding New Theme Settings

To add a new theme variable:

1. **Add the DB row** in the migration or via SQL:
   ```sql
   INSERT INTO theme_settings (key, value, category, label)
   VALUES ('color_highlight', '#FFD700', 'color', 'Highlight Color');
   ```

2. **Add the TypeScript type** in `src/lib/types/index.ts`:
   ```typescript
   export interface ThemeConfig {
     // ... existing keys ...
     color_highlight: string
   }
   ```

3. **Add the CSS var mapping** in `src/lib/stores/theme.store.ts`:
   ```typescript
   const CSS_VAR_MAP: Record<keyof ThemeConfig, string> = {
     // ... existing entries ...
     color_highlight: '--color-highlight',
   }
   ```

4. **Add the default** in the `defaultTheme` object in the same file:
   ```typescript
   const defaultTheme: ThemeConfig = {
     // ... existing defaults ...
     color_highlight: '#FFD700',
   }
   ```

5. **Use it in CSS/Tailwind**: Reference `var(--color-highlight)` in any CSS or use an arbitrary Tailwind value:
   ```tsx
   <div style={{ background: 'var(--color-highlight)' }} />
   ```

6. **Update the admin Theming editor** if you want it to appear as an editable field in the UI (add a new entry in the ThemingEditor component's category sections).
