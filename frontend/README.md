# Contour alignment SPA

Single-page React + TypeScript application for visualising multi-channel
contours and interactively aligning them across frequency.

## Development

```bash
cd frontend
npm install
npm run dev
```

The dev server will start on the default Vite port (usually `5173`). The app
expects the backend API to be available under `/api`.

## Backend API

The frontend calls:

- `GET /api/contours`

The JSON contract is documented in `CONTOUR_API.md`. In short, the backend
should:

- Read FITS/HDF5 data.
- Use the FITS header to derive x/y ranges and physical coordinates.
- Precompute contour polygons per channel and level.
- Return a `MultiChannelData` object matching the TypeScript types in
  `src/types.ts`.

## Controls

- **Control P0 joystick**
  - Controls `Px0` and `Py0` over the range ~`[-2e19, 2e19]` on each axis.
  - Influences a \(1 / f^2\) term so it has strong frequency-dependent impact.
- **Control P1 joystick**
  - Controls `Px1` and `Py1` over the range `[-1500, 1500]`.
  - Acts as a frequency-independent offset.
- **Control pad (bottom)**
  - `Contour level`: which contour level index/value to render.
  - `Channel range`: inclusive start/end channel indices.
  - `Channel cadence`: step size when sampling channels to draw (e.g. `5`
    means every 5th channel).

For each channel with centre frequency `freqHz`, the frontend computes
frequency-dependent offsets:

- `x_offset = px0 * (1 / freqHz^2) + px1`
- `y_offset = py0 * (1 / freqHz^2) + py1`

Every contour point \((x, y)\) is shifted to \((x + x_\text{offset},
y + y_\text{offset})\) before rendering with D3. Moving P0 and P1 smoothly
updates all contours in the visible channel range so you can visually align
structures across frequency.*** End Patch```} />
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
