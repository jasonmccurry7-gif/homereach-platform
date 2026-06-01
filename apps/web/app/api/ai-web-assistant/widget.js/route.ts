const widgetScript = `(() => {
  const script = document.currentScript || document.querySelector('script[data-assistant-key]');
  const key = script?.getAttribute('data-assistant-key') || 'pending';
  if (document.querySelector('[data-homereach-ai-assistant-root]')) return;

  const root = document.createElement('div');
  root.setAttribute('data-homereach-ai-assistant-root', key);
  root.style.position = 'fixed';
  root.style.right = '18px';
  root.style.bottom = '18px';
  root.style.zIndex = '2147483000';
  root.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'AI Assistant demo pending activation';
  button.style.border = '0';
  button.style.borderRadius = '12px';
  button.style.background = '#0f172a';
  button.style.color = '#ffffff';
  button.style.boxShadow = '0 20px 40px rgba(15,23,42,.25)';
  button.style.padding = '12px 14px';
  button.style.fontSize = '13px';
  button.style.fontWeight = '800';
  button.style.cursor = 'default';
  button.title = 'HomeReach production assistant requires domain approval and activation before live lead capture.';

  root.appendChild(button);
  document.body.appendChild(root);
})();`;

export async function GET() {
  return new Response(widgetScript, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
