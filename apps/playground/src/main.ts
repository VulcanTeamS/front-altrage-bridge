/**
 * Temporary bootstrap for the playground app.
 * Creates a placeholder developer overlay that will later host interactive tooling.
 */
const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  root.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 2rem;">
      <h1>Altrage Bridge Playground</h1>
      <p>Bridge integrators will be able to simulate ALT:V and RageMP events here.</p>
    </main>
  `;
}

console.info('[playground] Bootstrapped placeholder renderer');
