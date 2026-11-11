/** Keep WebKit's editing menu only on text controls. Application menus still
 * receive the event: cancelling the browser default must not stop bubbling. */
export function suppressBrowserMenu(event: {target: EventTarget | null; preventDefault(): void}) {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const input = target.closest('input, textarea');
    if (input instanceof HTMLTextAreaElement && !input.disabled) return;
    if (input instanceof HTMLInputElement && !input.disabled &&
        ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(input.type)) return;
    if (target.isContentEditable) return;
  }
  event.preventDefault();
}
