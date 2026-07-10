/** SSR entry used only by scripts/prerender.mjs (smoke test). */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

export function render(route) {
  return renderToString(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}
