/**
 * Temporary bootstrap for the documentation app.
 * Renders a placeholder view until the schema-driven explorer is implemented.
 */
const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  root.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 2rem;">
      <h1>Altrage Bridge Docs</h1>
      <p>Schema-driven explorer coming soon.</p>
    </main>
  `;
}

console.info('[docs] Bootstrapped placeholder renderer');
